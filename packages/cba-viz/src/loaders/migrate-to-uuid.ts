/**
 * Transparent UUID migration for DNA documents.
 *
 * On first load, primitives without an `id` field get a stable UUID assigned.
 * Layout keys are re-keyed from name-based (`resource:Loan`,
 * `operation:Loan.Approve`) to UUID-based (`resource:<uuid>`,
 * `operation:<uuid>`).
 *
 * Idempotent — primitives with an `id` are left as-is. Safe on every load.
 */

import { generateId } from '../utils/uuid.ts'
import type {
  OperationalDNA,
  Domain,
  NounLike,
  OperationalLayout,
} from './operational-loader.ts'
import type {
  ProductApiDNA,
  ProductUiDNA,
} from './product-loader.ts'

function ensureId<T extends { id?: string }>(obj: T): T {
  if (!obj.id) obj.id = generateId()
  return obj
}

// ── Operational DNA ───────────────────────────────────────────────────

export function migrateOperationalDNA(dna: OperationalDNA): OperationalDNA {
  // Build lookup maps while assigning IDs (single pass)
  const nounIdByName = new Map<string, string>()
  const opIdByName = new Map<string, string>()

  // 1. Assign IDs to every noun primitive (Resource/Person/Role/Group)
  //    in the domain tree
  walkNouns(dna.domain, (noun) => {
    ensureId(noun)
    nounIdByName.set(noun.name, noun.id!)
  })

  // 2. Operations
  for (const op of dna.operations ?? []) {
    ensureId(op)
    opIdByName.set(op.name, op.id!)
  }

  // 3. Top-level activities + relationships + memberships
  for (const trigger of dna.triggers ?? []) ensureId(trigger)
  for (const rule of dna.rules ?? []) ensureId(rule)
  for (const task of dna.tasks ?? []) ensureId(task)
  for (const proc of dna.processes ?? []) ensureId(proc)
  for (const rel of dna.relationships ?? []) ensureId(rel)
  for (const m of dna.memberships ?? []) ensureId(m)

  // 4. Re-key layout overlay from legacy name-based to UUID-based
  for (const layout of dna.layouts ?? []) {
    migrateOperationalLayout(layout, nounIdByName, opIdByName)
  }

  return dna
}

function migrateOperationalLayout(
  layout: OperationalLayout,
  nounIds: Map<string, string>,
  opIds: Map<string, string>,
): void {
  const rewritten: typeof layout.elements = {}
  for (const [key, val] of Object.entries(layout.elements)) {
    const newKey = migrateLayoutKey(key, nounIds, opIds)
    rewritten[newKey] = val
  }
  layout.elements = rewritten
}

function migrateLayoutKey(
  key: string,
  nounIds: Map<string, string>,
  opIds: Map<string, string>,
): string {
  // Already migrated (contains a UUID-like segment)
  if (key.includes('-') && key.split(':').some(s => s.length === 36)) return key

  // Legacy `noun:Foo` → `resource:Foo` rename, then UUID lookup
  if (key.startsWith('noun:') || key.startsWith('resource:')) {
    const name = key.slice(key.indexOf(':') + 1)
    const uuid = nounIds.get(name)
    return uuid ? `resource:${uuid}` : `resource:${name}`
  }

  // Legacy `capability:` → `operation:` rename, then UUID lookup
  if (key.startsWith('capability:') || key.startsWith('operation:')) {
    const name = key.slice(key.indexOf(':') + 1)
    const uuid = opIds.get(name)
    return uuid ? `operation:${uuid}` : `operation:${name}`
  }

  // rule:<OpName>:<idx> — rewrite key to use the operation UUID
  if (key.startsWith('rule:')) {
    const firstColon = key.indexOf(':')
    const rest = key.slice(firstColon + 1)
    const lastColon = rest.lastIndexOf(':')
    if (lastColon < 0) return key
    const opName = rest.slice(0, lastColon)
    const idx = rest.slice(lastColon + 1)
    const uuid = opIds.get(opName)
    return uuid ? `rule:${uuid}:${idx}` : key
  }

  // Drop legacy outcome:* and signal:* layout keys — those primitives are gone
  if (key.startsWith('outcome:') || key.startsWith('signal:') || key.startsWith('cause:')) {
    return ''
  }

  return key
}

function walkNouns(domain: Domain, fn: (noun: NounLike) => void): void {
  for (const r of domain.resources ?? []) fn(r)
  for (const p of domain.persons ?? []) fn(p)
  for (const r of domain.roles ?? []) fn(r)
  for (const g of domain.groups ?? []) fn(g)
  for (const child of domain.domains ?? []) walkNouns(child, fn)
}

// ── Product API DNA ───────────────────────────────────────────────────

export function migrateProductApiDNA(dna: ProductApiDNA): ProductApiDNA {
  if (dna.namespace) ensureId(dna.namespace)
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
