import type { OperationalDNA, Domain } from '../../loaders/operational-loader.ts'
import type { Extraction, PrimitiveType } from './types.ts'

// ── Auto-extraction from text ───────────────────────────────────────────

const POSITION_SUFFIXES = [
  'Manager', 'Specialist', 'Officer', 'Attorney', 'Agent', 'Representative',
  'Administrator', 'Admin', 'Analyst', 'Clerk', 'Supervisor', 'Director',
  'Coordinator', 'Paralegal', 'Associate', 'Partner', 'Assistant', 'Lead',
  'Underwriter', 'Processor', 'Reviewer', 'Approver',
]

const ACTION_VERBS = [
  'submit', 'review', 'approve', 'reject', 'file', 'upload', 'verify',
  'assign', 'register', 'dismiss', 'update', 'create', 'send', 'notify',
  'qualify', 'withdraw', 'assess', 'disburse', 'repay', 'default', 'close',
  'onboard', 'activate', 'deactivate', 'advance', 'initiate', 'complete',
  'process', 'cancel', 'suspend', 'apply',
]

const RULE_PATTERNS = [
  /\b(?:must|only|required to|cannot|may not|shall|should|needs to)\b[^.!?\n]{5,120}/gi,
  /\b(?:when|unless|if)\s+[^,.!?\n]{5,80}[,.]/gi,
]

const PROCESS_WORDS = ['process', 'workflow', 'procedure', 'flow', 'pipeline']

interface AutoExtractionInput {
  text: string
}

export function autoExtract({ text }: AutoExtractionInput): Extraction[] {
  if (!text || text.trim().length < 10) return []

  const results: Extraction[] = []
  const seen = new Set<string>()

  const push = (type: PrimitiveType, fragment: string, parentNoun?: string) => {
    const key = `${type}:${fragment.toLowerCase()}`
    if (seen.has(key)) return
    seen.add(key)
    results.push({
      id: crypto.randomUUID(),
      text: fragment,
      primitiveType: type,
      confidence: 'suggested',
      approved: true,
      parentNoun,
    })
  }

  // Positions: capitalized word(s) ending in a position suffix
  const posPattern = new RegExp(
    `\\b([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)*\\s+(?:${POSITION_SUFFIXES.join('|')}))\\b`,
    'g',
  )
  for (const m of text.matchAll(posPattern)) {
    push('position', m[1].trim())
  }

  // Nouns: capitalized multi-word phrases or Title Case words that aren't positions
  const nounPattern = /\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]+){0,2})\b/g
  const capturedPositions = new Set(results.filter((r) => r.primitiveType === 'position').map((r) => r.text.toLowerCase()))
  const nounCandidates = new Map<string, number>()
  for (const m of text.matchAll(nounPattern)) {
    const candidate = m[1].trim()
    if (capturedPositions.has(candidate.toLowerCase())) continue
    if (POSITION_SUFFIXES.some((s) => candidate.endsWith(s))) continue
    if (candidate.split(/\s+/).length > 3) continue
    // skip common sentence-starters
    if (/^(The|This|That|These|Those|When|If|After|Before|During|Each)\s/.test(candidate)) continue
    nounCandidates.set(candidate, (nounCandidates.get(candidate) ?? 0) + 1)
  }
  // Only include noun candidates that appear 1+ times (keep generous for short docs)
  for (const [noun] of nounCandidates) {
    push('noun', noun)
  }

  // Capabilities: <Noun>.<Verb> patterns (already-formatted)
  const capPattern = /\b([A-Z][a-zA-Z]+\.[A-Z][a-zA-Z]+)\b/g
  for (const m of text.matchAll(capPattern)) {
    push('capability', m[1])
  }

  // Verbs: action verbs detected in text, linked to nearest preceding Noun
  const nounNames = [...nounCandidates.keys()]
  const verbPattern = new RegExp(`\\b(${ACTION_VERBS.join('|')})s?\\b`, 'gi')
  for (const m of text.matchAll(verbPattern)) {
    const verbWord = m[1].toLowerCase()
    const idx = m.index ?? 0
    // Find closest preceding noun within 80 chars
    const preceding = text.substring(Math.max(0, idx - 80), idx)
    let parentNoun: string | undefined
    for (let i = nounNames.length - 1; i >= 0; i--) {
      if (preceding.includes(nounNames[i])) {
        parentNoun = nounNames[i].replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('')
        break
      }
    }
    const verbPascal = verbWord.charAt(0).toUpperCase() + verbWord.slice(1)
    push('verb', verbPascal, parentNoun)
  }

  // Rules: sentences containing modal/conditional keywords
  for (const pattern of RULE_PATTERNS) {
    for (const m of text.matchAll(pattern)) {
      const fragment = m[0].trim().replace(/\s+/g, ' ')
      if (fragment.length > 150) continue
      push('rule', fragment)
    }
  }

  // Processes: capitalized phrases containing "process" or similar words
  const procPattern = new RegExp(
    `\\b([A-Z][a-zA-Z]+(?:\\s+[A-Z][a-zA-Z]+){0,3}\\s+(?:${PROCESS_WORDS.join('|')}))\\b`,
    'gi',
  )
  for (const m of text.matchAll(procPattern)) {
    push('process', m[1].trim())
  }

  // Signals: "after X" / "once X" / "when X is Xed"
  const signalPattern = /\b(?:after|once)\s+([a-zA-Z ]{5,40})(?:is|has|\s+completes?|\s+finishes?)/gi
  for (const m of text.matchAll(signalPattern)) {
    push('signal', m[0].trim())
  }

  return results
}

function findLeafDomain(domain: Domain): Domain {
  if (!domain.domains || domain.domains.length === 0) return domain
  for (const child of domain.domains) {
    const leaf = findLeafDomain(child)
    if (leaf.nouns && leaf.nouns.length > 0) return leaf
  }
  return findLeafDomain(domain.domains[domain.domains.length - 1])
}

export function extractionsToDna(
  extractions: Extraction[],
  existing: OperationalDNA | null,
): OperationalDNA {
  const approved = extractions.filter((e) => e.approved)

  const base: OperationalDNA = existing
    ? JSON.parse(JSON.stringify(existing))
    : {
        domain: { name: 'discovered', path: 'discovered', nouns: [] },
        capabilities: [],
        causes: [],
        rules: [],
        outcomes: [],
        equations: [],
        signals: [],
        relationships: [],
        positions: [],
        persons: [],
        tasks: [],
        processes: [],
      }

  const leaf = findLeafDomain(base.domain)
  if (!leaf.nouns) leaf.nouns = []
  if (!base.capabilities) base.capabilities = []
  if (!base.positions) base.positions = []
  if (!base.persons) base.persons = []
  if (!base.tasks) base.tasks = []
  if (!base.processes) base.processes = []
  if (!base.rules) base.rules = []
  if (!base.causes) base.causes = []
  if (!base.outcomes) base.outcomes = []
  if (!base.signals) base.signals = []
  if (!base.relationships) base.relationships = []

  const existingNounNames = new Set(leaf.nouns.map((n) => n.name))
  const existingCapNames = new Set(base.capabilities.map((c) => c.name))
  const existingPosNames = new Set(base.positions.map((p) => p.name))
  const existingTaskNames = new Set(base.tasks.map((t) => t.name))
  const existingProcessNames = new Set(base.processes.map((p) => p.name))

  for (const ext of approved) {
    switch (ext.primitiveType) {
      case 'noun': {
        const name = toPascalCase(ext.text)
        if (!existingNounNames.has(name)) {
          leaf.nouns.push({ name, description: ext.text, attributes: [], verbs: [] })
          existingNounNames.add(name)
        }
        break
      }
      case 'attribute': {
        if (ext.parentNoun) {
          const noun = leaf.nouns.find((n) => n.name === ext.parentNoun)
          if (noun) {
            if (!noun.attributes) noun.attributes = []
            const attrName = toSnakeCase(ext.text)
            if (!noun.attributes.some((a) => a.name === attrName)) {
              noun.attributes.push({ name: attrName, type: 'string' })
            }
          }
        }
        break
      }
      case 'verb': {
        if (ext.parentNoun) {
          const noun = leaf.nouns.find((n) => n.name === ext.parentNoun)
          if (noun) {
            if (!noun.verbs) noun.verbs = []
            const verbName = toPascalCase(ext.text)
            if (!noun.verbs.some((v) => v.name === verbName)) {
              noun.verbs.push({ name: verbName, description: ext.text })
            }
          }
        }
        break
      }
      case 'capability': {
        const parts = ext.text.split('.')
        if (parts.length === 2) {
          const [noun, verb] = parts.map(toPascalCase)
          const name = `${noun}.${verb}`
          if (!existingCapNames.has(name)) {
            base.capabilities.push({ noun, verb, name, description: ext.text })
            existingCapNames.add(name)
          }
        }
        break
      }
      case 'position': {
        const name = toPascalCase(ext.text)
        if (!existingPosNames.has(name)) {
          base.positions.push({ name, description: ext.text })
          existingPosNames.add(name)
        }
        break
      }
      case 'person': {
        const kebab = toKebabCase(ext.text)
        if (!base.persons.some((p) => p.name === kebab)) {
          base.persons.push({ name: kebab, display_name: ext.text, position: ext.parentNoun ?? '' })
        }
        break
      }
      case 'task': {
        const name = toKebabCase(ext.text)
        if (!existingTaskNames.has(name)) {
          base.tasks.push({ name, description: ext.text, position: '', capability: '' })
          existingTaskNames.add(name)
        }
        break
      }
      case 'process': {
        const name = toPascalCase(ext.text)
        if (!existingProcessNames.has(name)) {
          base.processes.push({ name, description: ext.text, operator: '', steps: [] })
          existingProcessNames.add(name)
        }
        break
      }
      case 'rule': {
        base.rules.push({ capability: '', type: 'condition', description: ext.text })
        break
      }
      case 'cause': {
        base.causes.push({ capability: '', source: 'user' as const, description: ext.text })
        break
      }
      case 'outcome': {
        base.outcomes.push({ capability: '', description: ext.text, changes: [] })
        break
      }
      case 'signal': {
        break
      }
      case 'relationship': {
        break
      }
    }
  }

  return base
}

function toPascalCase(s: string): string {
  return s
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('')
}

function toSnakeCase(s: string): string {
  return s
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

function toKebabCase(s: string): string {
  return s
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
}
