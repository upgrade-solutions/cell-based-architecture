/**
 * Operational DNA mutations.
 *
 * Pure helpers that take an OperationalDNA and return a new document
 * with a primitive added or deleted. No JointJS, no React — just
 * data-in / data-out so they stay trivially unit-testable.
 *
 * Identity is UUID-based — every primitive carries a stable `id` field
 * assigned on first load. Rename is a display-name edit; references and
 * layout keys are UUID-stable and never need rewriting.
 */

import { generateId } from '../utils/uuid.ts'
import type {
  OperationalDNA,
  Domain,
  Noun,
  Capability,
  Rule,
  Outcome,
  RuleType,
} from '../loaders/operational-loader.ts'

// ── Kinds we can create / delete in this chunk ─────────────────────────

export type OperationalPrimitiveKind =
  | 'noun'
  | 'capability'
  | 'rule'
  | 'outcome'
  | 'signal'

// ── Create helpers ─────────────────────────────────────────────────────

/**
 * Deep-clone utility. JSON round-trip is fine for DNA — no functions,
 * no Dates, no Maps. Keeps the mutation helpers immutable without
 * hand-written spreads at every level.
 */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/**
 * Walk the domain hierarchy to the first leaf that carries any Nouns.
 * This mirrors `pickLeafDomain` in operational-to-graph.ts — additions
 * land in the same leaf the canvas is currently rendering.
 *
 * Returns the same Domain reference inside the cloned tree so callers
 * can mutate it in place.
 */
function findTargetLeafDomain(root: Domain): Domain {
  if (root.nouns && root.nouns.length > 0) return root
  for (const child of root.domains ?? []) {
    const found = findLeafWithNouns(child)
    if (found) return found
  }
  // No existing nouns anywhere — fall back to the deepest leaf
  return findDeepestLeaf(root)
}

function findLeafWithNouns(domain: Domain): Domain | null {
  if (domain.nouns && domain.nouns.length > 0) return domain
  for (const child of domain.domains ?? []) {
    const found = findLeafWithNouns(child)
    if (found) return found
  }
  return null
}

function findDeepestLeaf(domain: Domain): Domain {
  if (!domain.domains || domain.domains.length === 0) return domain
  return findDeepestLeaf(domain.domains[domain.domains.length - 1])
}

export interface AddNounInput {
  name: string
  description?: string
}

export function addNoun(dna: OperationalDNA, input: AddNounInput): OperationalDNA {
  const next = clone(dna)
  const leaf = findTargetLeafDomain(next.domain)
  leaf.nouns = leaf.nouns ?? []
  leaf.nouns.push({
    id: generateId(),
    name: input.name,
    description: input.description,
    domain: leaf.path ?? leaf.name,
    attributes: [],
    verbs: [],
  })
  return next
}

export interface AddCapabilityInput {
  noun: string
  verb: string
  description?: string
}

export function addCapability(dna: OperationalDNA, input: AddCapabilityInput): OperationalDNA {
  const next = clone(dna)
  next.capabilities = next.capabilities ?? []
  const name = `${input.noun}.${input.verb}`
  next.capabilities.push({
    id: generateId(),
    noun: input.noun,
    verb: input.verb,
    name,
    description: input.description,
  })
  return next
}

export interface AddRuleInput {
  capability: string
  type: RuleType
  description?: string
}

export function addRule(dna: OperationalDNA, input: AddRuleInput): OperationalDNA {
  const next = clone(dna)
  next.rules = next.rules ?? []
  const rule: Rule = {
    id: generateId(),
    capability: input.capability,
    type: input.type,
    description: input.description,
  }
  if (input.type === 'access') {
    rule.allow = [{ role: 'admin' }]
  } else {
    rule.conditions = []
  }
  next.rules.push(rule)
  return next
}

export interface AddOutcomeInput {
  capability: string
  description?: string
}

export function addOutcome(dna: OperationalDNA, input: AddOutcomeInput): OperationalDNA {
  const next = clone(dna)
  next.outcomes = next.outcomes ?? []
  const outcome: Outcome = {
    id: generateId(),
    capability: input.capability,
    description: input.description,
    changes: [{ attribute: 'status', set: 'new' }],
  }
  next.outcomes.push(outcome)
  return next
}

// ── Delete with cascade ────────────────────────────────────────────────

export interface RemovedPrimitive {
  kind: OperationalPrimitiveKind
  name: string
}

/**
 * Compute which primitives would be removed by deleting (kind, key)
 * without actually mutating anything. Drives the confirmation dialog.
 *
 * `key` is the primitive's UUID `id`.
 */
export function previewCascade(
  dna: OperationalDNA,
  kind: OperationalPrimitiveKind,
  key: string,
): RemovedPrimitive[] {
  const removed: RemovedPrimitive[] = []

  if (kind === 'noun') {
    const noun = findNounById(dna.domain, key)
    removed.push({ kind: 'noun', name: noun?.name ?? key })
    if (noun) {
      const doomedCaps = (dna.capabilities ?? []).filter((c) => c.noun === noun.name)
      for (const cap of doomedCaps) {
        const capName = cap.name ?? `${cap.noun}.${cap.verb}`
        removed.push({ kind: 'capability', name: capName })
        for (const rule of dna.rules ?? []) {
          if (rule.capability === capName) {
            removed.push({ kind: 'rule', name: `${capName} ${rule.type ?? 'access'}` })
          }
        }
        for (const outcome of dna.outcomes ?? []) {
          if (outcome.capability === capName) {
            removed.push({ kind: 'outcome', name: `${capName} outcome` })
          }
        }
      }
    }
    return removed
  }

  if (kind === 'capability') {
    const cap = (dna.capabilities ?? []).find((c) => c.id === key)
    const capName = cap ? (cap.name ?? `${cap.noun}.${cap.verb}`) : key
    removed.push({ kind: 'capability', name: capName })
    for (const rule of dna.rules ?? []) {
      if (rule.capability === capName) {
        removed.push({ kind: 'rule', name: `${capName} ${rule.type ?? 'access'}` })
      }
    }
    for (const outcome of dna.outcomes ?? []) {
      if (outcome.capability === capName) {
        removed.push({ kind: 'outcome', name: `${capName} outcome` })
      }
    }
    return removed
  }

  if (kind === 'rule') {
    const rule = (dna.rules ?? []).find((r) => r.id === key)
    removed.push({ kind: 'rule', name: rule ? `${rule.capability} ${rule.type ?? 'access'}` : key })
    return removed
  }

  if (kind === 'outcome') {
    const outcome = (dna.outcomes ?? []).find((o) => o.id === key)
    removed.push({ kind: 'outcome', name: outcome ? `${outcome.capability} outcome` : key })
    return removed
  }

  if (kind === 'signal') {
    const signal = (dna.signals ?? []).find((s) => s.id === key)
    removed.push({ kind: 'signal', name: signal?.name ?? key })
    return removed
  }

  return removed
}

/**
 * Remove a primitive (and its cascades) from the DNA.
 * `key` is the primitive's UUID `id`.
 */
export function deleteOperationalPrimitive(
  dna: OperationalDNA,
  kind: OperationalPrimitiveKind,
  key: string,
): { dna: OperationalDNA; removed: RemovedPrimitive[] } {
  const next = clone(dna)
  const removed: RemovedPrimitive[] = []

  if (kind === 'noun') {
    let nounName: string | undefined
    walkDomains(next.domain, (domain) => {
      if (domain.nouns) {
        const found = domain.nouns.find((n) => n.id === key)
        if (found) nounName = found.name
        domain.nouns = domain.nouns.filter((n) => n.id !== key)
      }
    })
    removed.push({ kind: 'noun', name: nounName ?? key })

    if (nounName) {
      const doomedCapNames = new Set<string>()
      next.capabilities = (next.capabilities ?? []).filter((cap) => {
        if (cap.noun === nounName) {
          const name = cap.name ?? `${cap.noun}.${cap.verb}`
          doomedCapNames.add(name)
          removed.push({ kind: 'capability', name })
          return false
        }
        return true
      })

      next.rules = (next.rules ?? []).filter((rule) => {
        if (doomedCapNames.has(rule.capability)) {
          removed.push({ kind: 'rule', name: `${rule.capability} ${rule.type ?? 'access'}` })
          return false
        }
        return true
      })
      next.outcomes = (next.outcomes ?? []).filter((outcome) => {
        if (doomedCapNames.has(outcome.capability)) {
          removed.push({ kind: 'outcome', name: `${outcome.capability} outcome` })
          return false
        }
        return true
      })
      next.causes = (next.causes ?? []).filter((cause) => {
        if (doomedCapNames.has(cause.capability)) return false
        if (cause.after && doomedCapNames.has(cause.after)) return false
        return true
      })

      walkNouns(next.domain, (noun) => {
        for (const attr of noun.attributes ?? []) {
          if (attr.type === 'reference' && attr.noun === nounName) {
            delete attr.noun
          }
        }
      })
    }

    return { dna: next, removed }
  }

  if (kind === 'capability') {
    const cap = (next.capabilities ?? []).find((c) => c.id === key)
    const capName = cap ? (cap.name ?? `${cap.noun}.${cap.verb}`) : undefined
    next.capabilities = (next.capabilities ?? []).filter((c) => c.id !== key)
    if (capName) removed.push({ kind: 'capability', name: capName })

    if (capName) {
      next.rules = (next.rules ?? []).filter((rule) => {
        if (rule.capability === capName) {
          removed.push({ kind: 'rule', name: `${capName} ${rule.type ?? 'access'}` })
          return false
        }
        return true
      })
      next.outcomes = (next.outcomes ?? []).filter((outcome) => {
        if (outcome.capability === capName) {
          removed.push({ kind: 'outcome', name: `${capName} outcome` })
          return false
        }
        return true
      })
      next.causes = (next.causes ?? []).filter((cause) => {
        if (cause.capability === capName) return false
        if (cause.after === capName) return false
        return true
      })
      for (const outcome of next.outcomes ?? []) {
        if (outcome.initiates) {
          outcome.initiates = outcome.initiates.filter((c) => c !== capName)
        }
      }
    }

    return { dna: next, removed }
  }

  if (kind === 'rule') {
    const target = (next.rules ?? []).find((r) => r.id === key)
    if (target) {
      next.rules = (next.rules ?? []).filter((r) => r.id !== key)
      removed.push({ kind: 'rule', name: `${target.capability} ${target.type ?? 'access'}` })
    }
    return { dna: next, removed }
  }

  if (kind === 'outcome') {
    const target = (next.outcomes ?? []).find((o) => o.id === key)
    if (target) {
      next.outcomes = (next.outcomes ?? []).filter((o) => o.id !== key)
      removed.push({ kind: 'outcome', name: `${target.capability} outcome` })
    }
    return { dna: next, removed }
  }

  if (kind === 'signal') {
    const target = (next.signals ?? []).find((s) => s.id === key)
    if (target) {
      next.signals = (next.signals ?? []).filter((s) => s.id !== key)
      removed.push({ kind: 'signal', name: target.name })
    }
    return { dna: next, removed }
  }

  return { dna: next, removed }
}

// ── Helpers ───────────────────────────────────────────────────────────

function findNounById(domain: Domain, id: string): Noun | null {
  for (const noun of domain.nouns ?? []) {
    if (noun.id === id) return noun
  }
  for (const child of domain.domains ?? []) {
    const found = findNounById(child, id)
    if (found) return found
  }
  return null
}

function walkNouns(domain: Domain, fn: (noun: Noun) => void): void {
  for (const noun of domain.nouns ?? []) fn(noun)
  for (const child of domain.domains ?? []) walkNouns(child, fn)
}

function walkDomains(domain: Domain, fn: (domain: Domain) => void): void {
  fn(domain)
  for (const child of domain.domains ?? []) walkDomains(child, fn)
}

// ── Convenience: enumerate existing primitives ────────────────────────
//
// The create dialog needs to populate dropdowns (noun list for
// "Capability", capability list for "Rule" / "Outcome"). Centralizing
// here keeps the dialog code stupid.

export function listNouns(dna: OperationalDNA): Noun[] {
  const out: Noun[] = []
  walkNouns(dna.domain, (n) => out.push(n))
  return out
}

export function listCapabilities(dna: OperationalDNA): Capability[] {
  return dna.capabilities ?? []
}
