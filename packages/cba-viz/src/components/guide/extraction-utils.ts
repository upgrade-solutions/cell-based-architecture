import type { OperationalDNA, Domain } from '../../loaders/operational-loader.ts'
import type { Extraction, PrimitiveType } from './types.ts'

// ── Auto-extraction from text ───────────────────────────────────────────

const ROLE_SUFFIXES = [
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

  // Roles: capitalized phrase ending in a role suffix
  const rolePattern = new RegExp(
    `\\b([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)*\\s+(?:${ROLE_SUFFIXES.join('|')}))\\b`,
    'g',
  )
  for (const m of text.matchAll(rolePattern)) {
    push('role', m[1].trim())
  }

  // Resources: capitalized multi-word phrases that aren't roles
  const resourcePattern = /\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]+){0,2})\b/g
  const capturedRoles = new Set(results.filter((r) => r.primitiveType === 'role').map((r) => r.text.toLowerCase()))
  const resourceCandidates = new Map<string, number>()
  for (const m of text.matchAll(resourcePattern)) {
    const candidate = m[1].trim()
    if (capturedRoles.has(candidate.toLowerCase())) continue
    if (ROLE_SUFFIXES.some((s) => candidate.endsWith(s))) continue
    if (candidate.split(/\s+/).length > 3) continue
    if (/^(The|This|That|These|Those|When|If|After|Before|During|Each)\s/.test(candidate)) continue
    resourceCandidates.set(candidate, (resourceCandidates.get(candidate) ?? 0) + 1)
  }
  for (const [name] of resourceCandidates) {
    push('resource', name)
  }

  // Operations: <Target>.<Action> patterns
  const opPattern = /\b([A-Z][a-zA-Z]+\.[A-Z][a-zA-Z]+)\b/g
  for (const m of text.matchAll(opPattern)) {
    push('operation', m[1])
  }

  // Actions: action verbs detected in text, linked to nearest preceding resource
  const resourceNames = [...resourceCandidates.keys()]
  const verbPattern = new RegExp(`\\b(${ACTION_VERBS.join('|')})s?\\b`, 'gi')
  for (const m of text.matchAll(verbPattern)) {
    const verbWord = m[1].toLowerCase()
    const idx = m.index ?? 0
    const preceding = text.substring(Math.max(0, idx - 80), idx)
    let parentNoun: string | undefined
    for (let i = resourceNames.length - 1; i >= 0; i--) {
      if (preceding.includes(resourceNames[i])) {
        parentNoun = resourceNames[i]
          .replace(/[^a-zA-Z0-9\s]/g, '')
          .split(/\s+/).filter(Boolean)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join('')
        break
      }
    }
    const verbPascal = verbWord.charAt(0).toUpperCase() + verbWord.slice(1)
    push('action', verbPascal, parentNoun)
  }

  // Rules
  for (const pattern of RULE_PATTERNS) {
    for (const m of text.matchAll(pattern)) {
      const fragment = m[0].trim().replace(/\s+/g, ' ')
      if (fragment.length > 150) continue
      push('rule', fragment)
    }
  }

  // Processes
  const procPattern = new RegExp(
    `\\b([A-Z][a-zA-Z]+(?:\\s+[A-Z][a-zA-Z]+){0,3}\\s+(?:${PROCESS_WORDS.join('|')}))\\b`,
    'gi',
  )
  for (const m of text.matchAll(procPattern)) {
    push('process', m[1].trim())
  }

  return results
}

function findLeafDomain(domain: Domain): Domain {
  if (!domain.domains || domain.domains.length === 0) return domain
  for (const child of domain.domains) {
    const leaf = findLeafDomain(child)
    if ((leaf.resources?.length ?? 0) + (leaf.persons?.length ?? 0) + (leaf.roles?.length ?? 0) + (leaf.groups?.length ?? 0) > 0) {
      return leaf
    }
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
        domain: { name: 'discovered', path: 'discovered', resources: [], persons: [], roles: [], groups: [] },
        operations: [],
        triggers: [],
        rules: [],
        tasks: [],
        processes: [],
        memberships: [],
        relationships: [],
      }

  const leaf = findLeafDomain(base.domain)
  if (!leaf.resources) leaf.resources = []
  if (!leaf.persons) leaf.persons = []
  if (!leaf.roles) leaf.roles = []
  if (!leaf.groups) leaf.groups = []
  if (!base.operations) base.operations = []
  if (!base.triggers) base.triggers = []
  if (!base.rules) base.rules = []
  if (!base.tasks) base.tasks = []
  if (!base.processes) base.processes = []
  if (!base.memberships) base.memberships = []
  if (!base.relationships) base.relationships = []

  const existingResourceNames = new Set(leaf.resources.map((n) => n.name))
  const existingRoleNames = new Set(leaf.roles.map((n) => n.name))
  const existingPersonNames = new Set(leaf.persons.map((n) => n.name))
  const existingOpNames = new Set(base.operations.map((o) => o.name))
  const existingTaskNames = new Set(base.tasks.map((t) => t.name))
  const existingProcessNames = new Set(base.processes.map((p) => p.name))

  for (const ext of approved) {
    switch (ext.primitiveType) {
      case 'resource': {
        const name = toPascalCase(ext.text)
        if (!existingResourceNames.has(name)) {
          leaf.resources.push({ name, description: ext.text, attributes: [], actions: [] })
          existingResourceNames.add(name)
        }
        break
      }
      case 'role': {
        const name = toPascalCase(ext.text)
        if (!existingRoleNames.has(name)) {
          leaf.roles.push({ name, description: ext.text, attributes: [], actions: [] })
          existingRoleNames.add(name)
        }
        break
      }
      case 'person': {
        const name = toKebabCase(ext.text)
        if (!existingPersonNames.has(name)) {
          leaf.persons.push({ name, description: ext.text, attributes: [], actions: [] })
          existingPersonNames.add(name)
        }
        break
      }
      case 'group': {
        const name = toPascalCase(ext.text)
        if (!leaf.groups.some((g) => g.name === name)) {
          leaf.groups.push({ name, description: ext.text, attributes: [], actions: [] })
        }
        break
      }
      case 'attribute': {
        if (ext.parentNoun) {
          const noun = leaf.resources.find((n) => n.name === ext.parentNoun)
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
      case 'action': {
        if (ext.parentNoun) {
          const noun = leaf.resources.find((n) => n.name === ext.parentNoun)
          if (noun) {
            if (!noun.actions) noun.actions = []
            const actionName = toPascalCase(ext.text)
            if (!noun.actions.some((a) => a.name === actionName)) {
              noun.actions.push({ name: actionName, description: ext.text })
            }
          }
        }
        break
      }
      case 'operation': {
        const parts = ext.text.split('.')
        if (parts.length === 2) {
          const [target, action] = parts.map(toPascalCase)
          const name = `${target}.${action}`
          if (!existingOpNames.has(name)) {
            base.operations.push({ name, target, action, description: ext.text })
            existingOpNames.add(name)
          }
        }
        break
      }
      case 'task': {
        const name = toKebabCase(ext.text)
        if (!existingTaskNames.has(name)) {
          base.tasks.push({ name, description: ext.text, actor: '', operation: '' })
          existingTaskNames.add(name)
        }
        break
      }
      case 'process': {
        const name = toPascalCase(ext.text)
        if (!existingProcessNames.has(name)) {
          base.processes.push({ name, description: ext.text, operator: '', startStep: '', steps: [] })
          existingProcessNames.add(name)
        }
        break
      }
      case 'rule': {
        base.rules.push({ operation: '', type: 'condition', description: ext.text })
        break
      }
      case 'trigger': {
        base.triggers.push({ source: 'user', description: ext.text })
        break
      }
      case 'membership':
      case 'relationship': {
        // No-op for now — memberships/relationships need richer
        // multi-field extraction beyond the current sentence-fragment
        // shape. Surface them as discovered text but don't auto-create.
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
