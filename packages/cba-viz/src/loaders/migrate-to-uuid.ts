/**
 * Transparent UUID migration for DNA documents.
 *
 * On first load, primitives without an `id` field get a stable UUID
 * assigned. Layout keys are re-keyed from name-based
 * (`noun:Loan`, `capability:Loan.Approve`) to UUID-based
 * (`noun:<uuid>`, `capability:<uuid>`).
 *
 * Idempotent — if a primitive already has an `id`, it's left as-is.
 * Safe to run on every load.
 */

import { generateId } from '../utils/uuid.ts'
import type {
  OperationalDNA,
  Domain,
  Noun,
  Capability,
  Rule,
  Outcome,
  Signal,
  Cause,
  Relationship,
  Equation,
  OperationalLayout,
} from './operational-loader.ts'
import type {
  ProductApiDNA,
  ProductUiDNA,
  Resource,
  Operation,
  Endpoint,
  Namespace,
  Page,
  Block,
  Route,
} from './product-loader.ts'

function ensureId<T extends { id?: string }>(obj: T): T {
  if (!obj.id) obj.id = generateId()
  return obj
}

// ── Operational DNA ───────────────────────────────────────────────────

export function migrateOperationalDNA(dna: OperationalDNA): OperationalDNA {
  // Build lookup maps while assigning IDs (single pass)
  const nounIdByName = new Map<string, string>()
  const capIdByName = new Map<string, string>()
  const signalIdByName = new Map<string, string>()

  // 1. Assign IDs to all nouns in the domain tree
  walkNouns(dna.domain, (noun) => {
    ensureId(noun)
    nounIdByName.set(noun.name, noun.id!)
  })

  // 2. Capabilities
  for (const cap of dna.capabilities ?? []) {
    ensureId(cap)
    const name = cap.name ?? `${cap.noun}.${cap.verb}`
    capIdByName.set(name, cap.id!)
  }

  // 3. Rules, Outcomes, Causes, Signals, Relationships, Equations
  for (const rule of dna.rules ?? []) ensureId(rule)
  for (const outcome of dna.outcomes ?? []) ensureId(outcome)
  for (const cause of dna.causes ?? []) ensureId(cause)
  for (const signal of dna.signals ?? []) {
    ensureId(signal)
    signalIdByName.set(signal.name, signal.id!)
  }
  for (const rel of dna.relationships ?? []) ensureId(rel)
  for (const eq of dna.equations ?? []) ensureId(eq)

  // 4. Re-key layout overlay from name-based to UUID-based
  for (const layout of dna.layouts ?? []) {
    migrateOperationalLayout(layout, nounIdByName, capIdByName)
  }

  return dna
}

function migrateOperationalLayout(
  layout: OperationalLayout,
  nounIds: Map<string, string>,
  capIds: Map<string, string>,
): void {
  const rewritten: typeof layout.elements = {}
  for (const [key, val] of Object.entries(layout.elements)) {
    const newKey = migrateLayoutKey(key, nounIds, capIds)
    rewritten[newKey] = val
  }
  layout.elements = rewritten
}

function migrateLayoutKey(
  key: string,
  nounIds: Map<string, string>,
  capIds: Map<string, string>,
): string {
  // Already migrated (contains a UUID-like segment)
  if (key.includes('-') && key.split(':').some(s => s.length === 36)) return key

  if (key.startsWith('noun:')) {
    const name = key.slice('noun:'.length)
    const uuid = nounIds.get(name)
    return uuid ? `noun:${uuid}` : key
  }

  if (key.startsWith('capability:')) {
    const name = key.slice('capability:'.length)
    const uuid = capIds.get(name)
    return uuid ? `capability:${uuid}` : key
  }

  // rule:<CapName>:<idx> and outcome:<CapName>:<idx>
  // These become rule:<capUuid>:<idx> and outcome:<capUuid>:<idx>
  if (key.startsWith('rule:') || key.startsWith('outcome:')) {
    const firstColon = key.indexOf(':')
    const prefix = key.slice(0, firstColon)
    const rest = key.slice(firstColon + 1)
    const lastColon = rest.lastIndexOf(':')
    if (lastColon < 0) return key
    const capName = rest.slice(0, lastColon)
    const idx = rest.slice(lastColon + 1)
    const uuid = capIds.get(capName)
    return uuid ? `${prefix}:${uuid}:${idx}` : key
  }

  if (key.startsWith('signal:')) {
    // Signals aren't typically in layouts, but handle defensively
    return key
  }

  // Domain keys, unknown keys — pass through
  return key
}

function walkNouns(domain: Domain, fn: (noun: Noun) => void): void {
  for (const noun of domain.nouns ?? []) fn(noun)
  for (const child of domain.domains ?? []) walkNouns(child, fn)
}

// ── Product API DNA ───────────────────────────────────────────────────

export function migrateProductApiDNA(dna: ProductApiDNA): ProductApiDNA {
  ensureId(dna.namespace)
  for (const resource of dna.resources ?? []) ensureId(resource)
  for (const operation of dna.operations ?? []) ensureId(operation)
  for (const endpoint of dna.endpoints ?? []) ensureId(endpoint)
  return dna
}

// ── Product UI DNA ────────────────────────────────────────────────────

export function migrateProductUiDNA(dna: ProductUiDNA): ProductUiDNA {
  for (const page of dna.pages ?? []) {
    ensureId(page)
    for (const block of page.blocks ?? []) ensureId(block)
  }
  for (const route of dna.routes ?? []) ensureId(route)
  return dna
}
