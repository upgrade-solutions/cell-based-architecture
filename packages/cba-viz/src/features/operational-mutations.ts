/**
 * Operational DNA mutations — Phase 5c.4 Chunk 1.
 *
 * Pure helpers that take an OperationalDNA and return a new document
 * with a primitive added, renamed, or deleted. No JointJS, no React —
 * just data-in / data-out so they stay trivially unit-testable.
 *
 * ─── Identity caveat ────────────────────────────────────────────────
 *
 * THIS CHUNK USES NAME-BASED REFERENCES throughout. A Capability refers
 * to its Noun by `noun: "Loan"`; a Rule refers to its Capability by
 * `capability: "Loan.Approve"`. Rename works by walking the document
 * and rewriting every field that carries one of these references.
 *
 * The downside is obvious: a user-visible string is also the identity,
 * and anything pointing at it has to know. The rename walk below has to
 * be kept in lockstep with the operational schema — adding a new field
 * that carries a Noun or Capability name means updating `renameNoun`
 * and/or `renameCapability`.
 *
 * Stable UUID identity is a future chunk. When it lands:
 *   - Add a `__uuid` to each primitive on load
 *   - Refs become `capabilityId` / `nounId` instead of `capability` /
 *     `noun`
 *   - Rename collapses to "edit the display name, leave refs alone"
 *   - This file's rename helpers become no-ops except for lifecycle
 *     `steps[]` and equation `input[]` which encode semantic meaning
 *     beyond pure identity (still rewrite those).
 *
 * Until then, all rename logic lives here and nowhere else.
 */

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
    capability: input.capability,
    description: input.description,
    changes: [{ attribute: 'status', set: 'new' }],
  }
  next.outcomes.push(outcome)
  return next
}

// ── Rename with referential integrity ──────────────────────────────────

/**
 * Rewrite every reference to a Noun when its name changes. The canvas
 * cells reference primitives by name (not by stable UUID), so this
 * walk touches every field that could carry the old name:
 *
 *   - Noun.name itself
 *   - Capability.noun, Capability.name (prefix of `Noun.Verb`)
 *   - Rule.capability (prefix via `Noun.Verb`)
 *   - Outcome.capability + Outcome.initiates[]
 *   - Cause.capability + Cause.after
 *   - Signal.capability
 *   - Lifecycle.noun + Lifecycle.steps[] (each step is `Noun.Verb`)
 *   - Relationship.from + Relationship.to
 *   - Attribute.noun on reference attributes (on ALL nouns across the doc)
 *   - OperationalLayout.elements keyed by `noun:<name>` /
 *     `capability:<Noun.Verb>`
 *
 * Safe to call with `oldName === newName` — just returns a clone.
 */
export function renameNoun(dna: OperationalDNA, oldName: string, newName: string): OperationalDNA {
  if (oldName === newName) return clone(dna)
  const next = clone(dna)

  // Helper — rewrite a capability string "OldNoun.Verb" → "NewNoun.Verb"
  const rewriteCap = (capName: string): string => {
    const idx = capName.indexOf('.')
    if (idx < 0) return capName
    const nounPart = capName.slice(0, idx)
    if (nounPart !== oldName) return capName
    return `${newName}.${capName.slice(idx + 1)}`
  }

  // 1. The Noun itself — walk the domain tree
  walkNouns(next.domain, (noun) => {
    if (noun.name === oldName) noun.name = newName
    // Also rewrite any reference attribute on any noun that points to
    // the old name — this is the only Noun → Noun cross-reference we
    // support in schema.
    for (const attr of noun.attributes ?? []) {
      if (attr.type === 'reference' && attr.noun === oldName) {
        attr.noun = newName
      }
    }
  })

  // 2. Capabilities — noun field + redundant name prefix
  for (const cap of next.capabilities ?? []) {
    if (cap.noun === oldName) cap.noun = newName
    if (cap.name) cap.name = rewriteCap(cap.name)
  }

  // 3. Rules — capability prefix
  for (const rule of next.rules ?? []) {
    rule.capability = rewriteCap(rule.capability)
  }

  // 4. Outcomes — capability prefix + initiates[]
  for (const outcome of next.outcomes ?? []) {
    outcome.capability = rewriteCap(outcome.capability)
    if (outcome.initiates) {
      outcome.initiates = outcome.initiates.map(rewriteCap)
    }
  }

  // 5. Causes — capability + after prefix
  for (const cause of next.causes ?? []) {
    cause.capability = rewriteCap(cause.capability)
    if (cause.after) cause.after = rewriteCap(cause.after)
  }

  // 6. Signals — capability prefix (signals also encode Noun in their
  // fully-qualified name like `domain.Noun.PastVerb`, but that's a
  // display convention, not a schema reference — leave names untouched).
  for (const signal of next.signals ?? []) {
    signal.capability = rewriteCap(signal.capability)
  }

  // 7. Lifecycles — noun + steps[]
  for (const lifecycle of next.lifecycles ?? []) {
    if (lifecycle.noun === oldName) lifecycle.noun = newName
    if (lifecycle.steps) {
      lifecycle.steps = lifecycle.steps.map(rewriteCap)
    }
    for (const branch of lifecycle.branches ?? []) {
      // Branches carry state names, not Noun names — no rewrite
      void branch
    }
  }

  // 8. Relationships — from + to are noun names
  for (const rel of next.relationships ?? []) {
    if (rel.from === oldName) rel.from = newName
    if (rel.to === oldName) rel.to = newName
  }

  // 9. Layout overlay keys
  for (const layout of next.layouts ?? []) {
    const rewritten: typeof layout.elements = {}
    for (const [key, val] of Object.entries(layout.elements)) {
      if (key === `noun:${oldName}`) {
        rewritten[`noun:${newName}`] = val
      } else if (key.startsWith('capability:')) {
        const capName = key.slice('capability:'.length)
        const nextCap = rewriteCap(capName)
        rewritten[`capability:${nextCap}`] = val
      } else if (key.startsWith('rule:') || key.startsWith('outcome:')) {
        // rule:<Noun.Verb>:<i> / outcome:<Noun.Verb>:<i>
        const [prefix, ...rest] = key.split(':')
        // rest might contain further colons (unlikely) — join back
        const suffix = rest.join(':')
        const lastColon = suffix.lastIndexOf(':')
        if (lastColon < 0) {
          rewritten[key] = val
          continue
        }
        const capPart = suffix.slice(0, lastColon)
        const idxPart = suffix.slice(lastColon + 1)
        rewritten[`${prefix}:${rewriteCap(capPart)}:${idxPart}`] = val
      } else {
        rewritten[key] = val
      }
    }
    layout.elements = rewritten
  }

  return next
}

/**
 * Rewrite every reference to a Capability when its `Noun.Verb` name
 * changes. Capabilities are referenced via the same `Noun.Verb` string
 * everywhere, so this is a simpler walk than renameNoun — no field-
 * specific logic, just "anywhere that stores a capability name".
 *
 * Note: if the caller is renaming because they changed the Verb, they
 * should pass the old and new full `Noun.Verb` names, not the verb
 * alone. If they changed the Noun, they should call `renameNoun`
 * instead (which handles the cascade through the Noun field too).
 */
export function renameCapability(dna: OperationalDNA, oldName: string, newName: string): OperationalDNA {
  if (oldName === newName) return clone(dna)
  const next = clone(dna)

  // Parse the new name to update noun/verb fields on the Capability itself
  const [newNoun, ...verbRest] = newName.split('.')
  const newVerb = verbRest.join('.')

  for (const cap of next.capabilities ?? []) {
    const capName = cap.name ?? `${cap.noun}.${cap.verb}`
    if (capName === oldName) {
      cap.noun = newNoun ?? cap.noun
      cap.verb = newVerb ?? cap.verb
      cap.name = newName
    }
  }

  for (const rule of next.rules ?? []) {
    if (rule.capability === oldName) rule.capability = newName
  }

  for (const outcome of next.outcomes ?? []) {
    if (outcome.capability === oldName) outcome.capability = newName
    if (outcome.initiates) {
      outcome.initiates = outcome.initiates.map((c) => (c === oldName ? newName : c))
    }
  }

  for (const cause of next.causes ?? []) {
    if (cause.capability === oldName) cause.capability = newName
    if (cause.after === oldName) cause.after = newName
  }

  for (const signal of next.signals ?? []) {
    if (signal.capability === oldName) signal.capability = newName
  }

  for (const lifecycle of next.lifecycles ?? []) {
    if (lifecycle.steps) {
      lifecycle.steps = lifecycle.steps.map((s) => (s === oldName ? newName : s))
    }
  }

  // Layout overlay keys
  for (const layout of next.layouts ?? []) {
    const rewritten: typeof layout.elements = {}
    for (const [key, val] of Object.entries(layout.elements)) {
      if (key === `capability:${oldName}`) {
        rewritten[`capability:${newName}`] = val
      } else if (key.startsWith('rule:') || key.startsWith('outcome:')) {
        const [prefix, ...rest] = key.split(':')
        const suffix = rest.join(':')
        const lastColon = suffix.lastIndexOf(':')
        if (lastColon < 0) {
          rewritten[key] = val
          continue
        }
        const capPart = suffix.slice(0, lastColon)
        const idxPart = suffix.slice(lastColon + 1)
        if (capPart === oldName) {
          rewritten[`${prefix}:${newName}:${idxPart}`] = val
        } else {
          rewritten[key] = val
        }
      } else {
        rewritten[key] = val
      }
    }
    layout.elements = rewritten
  }

  return next
}

// ── Delete with cascade ────────────────────────────────────────────────

export interface RemovedPrimitive {
  kind: OperationalPrimitiveKind
  name: string
}

/**
 * Compute which primitives would be removed by deleting (kind, key)
 * without actually mutating anything. Drives the confirmation dialog
 * so users can see the blast radius before committing.
 *
 * `key` is the primary string identity of the primitive:
 *   - noun       → Noun.name
 *   - capability → `Noun.Verb`
 *   - rule       → unique id `rule:<Noun.Verb>:<index>`
 *   - outcome    → unique id `outcome:<Noun.Verb>:<index>`
 *   - signal     → Signal.name (fully qualified)
 */
export function previewCascade(
  dna: OperationalDNA,
  kind: OperationalPrimitiveKind,
  key: string,
): RemovedPrimitive[] {
  const removed: RemovedPrimitive[] = []

  if (kind === 'noun') {
    removed.push({ kind: 'noun', name: key })
    const doomedCaps = (dna.capabilities ?? []).filter((c) => c.noun === key)
    for (const cap of doomedCaps) {
      const capName = cap.name ?? `${cap.noun}.${cap.verb}`
      removed.push({ kind: 'capability', name: capName })
      // Each doomed capability cascades its rules + outcomes
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
    return removed
  }

  if (kind === 'capability') {
    removed.push({ kind: 'capability', name: key })
    for (const rule of dna.rules ?? []) {
      if (rule.capability === key) {
        removed.push({ kind: 'rule', name: `${key} ${rule.type ?? 'access'}` })
      }
    }
    for (const outcome of dna.outcomes ?? []) {
      if (outcome.capability === key) {
        removed.push({ kind: 'outcome', name: `${key} outcome` })
      }
    }
    return removed
  }

  if (kind === 'rule') {
    removed.push({ kind: 'rule', name: key })
    return removed
  }

  if (kind === 'outcome') {
    removed.push({ kind: 'outcome', name: key })
    return removed
  }

  if (kind === 'signal') {
    removed.push({ kind: 'signal', name: key })
    return removed
  }

  return removed
}

/**
 * Remove a primitive (and its cascades) from the DNA. Returns both the
 * new document and the list of what got removed so the caller can
 * surface an undo hint or a toast if it wants to.
 *
 * Cascade rules — narrow on purpose for this chunk:
 *   - noun → its capabilities → their rules + outcomes
 *   - capability → its rules + outcomes + causes that reference it
 *     (either `capability` or `after`)
 *   - rule / outcome / signal → just the one entity, no cascade
 *
 * `key` format matches `previewCascade`:
 *   - noun: Noun.name
 *   - capability: `Noun.Verb`
 *   - rule: `rule:<Noun.Verb>:<idx>` (matches operational-to-graph ID)
 *   - outcome: `outcome:<Noun.Verb>:<idx>`
 *   - signal: Signal.name
 */
export function deleteOperationalPrimitive(
  dna: OperationalDNA,
  kind: OperationalPrimitiveKind,
  key: string,
): { dna: OperationalDNA; removed: RemovedPrimitive[] } {
  const next = clone(dna)
  const removed: RemovedPrimitive[] = []

  if (kind === 'noun') {
    // Remove the noun from wherever it lives in the domain tree
    walkDomains(next.domain, (domain) => {
      if (domain.nouns) {
        domain.nouns = domain.nouns.filter((n) => n.name !== key)
      }
    })
    removed.push({ kind: 'noun', name: key })

    // Cascade: find all capabilities on this noun
    const doomedCapNames = new Set<string>()
    next.capabilities = (next.capabilities ?? []).filter((cap) => {
      if (cap.noun === key) {
        const name = cap.name ?? `${cap.noun}.${cap.verb}`
        doomedCapNames.add(name)
        removed.push({ kind: 'capability', name })
        return false
      }
      return true
    })

    // Cascade: rules + outcomes whose capability is in the doomed set
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

    // Cascade: causes anchored on doomed capabilities
    next.causes = (next.causes ?? []).filter((cause) => {
      if (doomedCapNames.has(cause.capability)) return false
      if (cause.after && doomedCapNames.has(cause.after)) return false
      return true
    })

    // Also prune dangling reference attributes on surviving nouns
    walkNouns(next.domain, (noun) => {
      for (const attr of noun.attributes ?? []) {
        if (attr.type === 'reference' && attr.noun === key) {
          // Drop the `noun` reference but keep the attribute shell —
          // leaving a broken ref would fail schema validation. The
          // user can reassign or delete the attribute via the form.
          delete attr.noun
        }
      }
    })

    return { dna: next, removed }
  }

  if (kind === 'capability') {
    next.capabilities = (next.capabilities ?? []).filter((cap) => {
      const name = cap.name ?? `${cap.noun}.${cap.verb}`
      return name !== key
    })
    removed.push({ kind: 'capability', name: key })

    next.rules = (next.rules ?? []).filter((rule) => {
      if (rule.capability === key) {
        removed.push({ kind: 'rule', name: `${key} ${rule.type ?? 'access'}` })
        return false
      }
      return true
    })
    next.outcomes = (next.outcomes ?? []).filter((outcome) => {
      if (outcome.capability === key) {
        removed.push({ kind: 'outcome', name: `${key} outcome` })
        return false
      }
      return true
    })
    next.causes = (next.causes ?? []).filter((cause) => {
      if (cause.capability === key) return false
      if (cause.after === key) return false
      return true
    })
    // Outcomes from other capabilities may initiate this one —
    // strip the dangling reference rather than cascading further.
    for (const outcome of next.outcomes ?? []) {
      if (outcome.initiates) {
        outcome.initiates = outcome.initiates.filter((c) => c !== key)
      }
    }

    return { dna: next, removed }
  }

  if (kind === 'rule') {
    // key format: `rule:<Noun.Verb>:<index>`
    const parsed = parseIndexedId(key, 'rule')
    if (!parsed) return { dna: next, removed }
    const { capability, index } = parsed
    const matching = (next.rules ?? []).filter((r) => r.capability === capability)
    const target = matching[index]
    if (target) {
      next.rules = (next.rules ?? []).filter((r) => r !== target)
      removed.push({ kind: 'rule', name: `${capability} ${target.type ?? 'access'}` })
    }
    return { dna: next, removed }
  }

  if (kind === 'outcome') {
    const parsed = parseIndexedId(key, 'outcome')
    if (!parsed) return { dna: next, removed }
    const { capability, index } = parsed
    const matching = (next.outcomes ?? []).filter((o) => o.capability === capability)
    const target = matching[index]
    if (target) {
      next.outcomes = (next.outcomes ?? []).filter((o) => o !== target)
      removed.push({ kind: 'outcome', name: `${capability} outcome` })
    }
    return { dna: next, removed }
  }

  if (kind === 'signal') {
    next.signals = (next.signals ?? []).filter((s) => s.name !== key)
    removed.push({ kind: 'signal', name: key })
    return { dna: next, removed }
  }

  return { dna: next, removed }
}

// ── Parsing helpers ────────────────────────────────────────────────────

/**
 * Parse an id like `rule:Loan.Approve:0` → { capability: 'Loan.Approve', index: 0 }
 * Capability names contain at most one dot but rule ids put the cap in the
 * middle, so we split on the FIRST and LAST colons.
 */
function parseIndexedId(id: string, expectedPrefix: 'rule' | 'outcome'): { capability: string; index: number } | null {
  const firstColon = id.indexOf(':')
  if (firstColon < 0) return null
  const prefix = id.slice(0, firstColon)
  if (prefix !== expectedPrefix) return null
  const rest = id.slice(firstColon + 1)
  const lastColon = rest.lastIndexOf(':')
  if (lastColon < 0) return null
  const capability = rest.slice(0, lastColon)
  const index = Number(rest.slice(lastColon + 1))
  if (!Number.isFinite(index)) return null
  return { capability, index }
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
