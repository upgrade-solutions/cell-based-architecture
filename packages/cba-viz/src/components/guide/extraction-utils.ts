import type { OperationalDNA, Domain } from '../../loaders/operational-loader.ts'
import type { Extraction } from './types.ts'

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
