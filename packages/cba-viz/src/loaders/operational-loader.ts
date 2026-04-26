/**
 * Operational DNA types + loader.
 *
 * Field names and shapes mirror `@dna-codes/schemas/operational/*.json` exactly.
 * The RJSF-driven inspector form round-trips data through these interfaces back
 * to the schema, so any drift breaks editing silently. If you change a schema,
 * update the corresponding interface here and re-run tsc.
 */

import { migrateOperationalDNA } from './migrate-to-uuid.ts'

// ── Primitive types (mirror @dna-codes/schemas/operational/*.json) ─────────

export type ActionType = 'read' | 'write' | 'destructive'

export interface Action {
  name: string
  description?: string
  type?: ActionType
  idempotent?: boolean
  input?: Attribute[]
  output?: Attribute[]
}

export interface Attribute {
  name: string
  type: 'string' | 'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'enum' | 'reference'
  description?: string
  required?: boolean
  /** Only valid when type === 'enum'. */
  values?: string[]
  /** Only valid when type === 'reference'. */
  resource?: string
}

/**
 * The four operational "noun" primitives — Resource, Person, Role, Group —
 * share a common shape. Role adds optional scope/system/cardinality/excludes
 * fields; Person adds an optional `resource` link.
 */
export interface NounLike {
  id?: string
  name: string
  description?: string
  /** Dot-separated domain path this noun lives in. */
  domain?: string
  parent?: string
  attributes?: Attribute[]
  actions?: Action[]
  examples?: Array<Record<string, unknown>>
}

export type Resource = NounLike

export interface Person extends NounLike {
  /** Optional Resource template the Person is backed by (e.g. system actors). */
  resource?: string
}

export interface Role extends NounLike {
  /** Group / Person / Resource the Role is exercised within (string or string[]). */
  scope?: string | string[]
  /** True for non-human actors (jobs, services). */
  system?: boolean
  /** When system, optional Resource template the Role is backed by. */
  resource?: string
  /** Per-scope-instance constraints. */
  cardinality?: 'one' | 'many'
  required?: boolean
  excludes?: string[]
}

export type Group = NounLike

export interface Domain {
  name: string
  description?: string
  path?: string
  domains?: Domain[]
  resources?: Resource[]
  persons?: Person[]
  roles?: Role[]
  groups?: Group[]
}

export interface Membership {
  id?: string
  name: string
  person: string
  role: string
  /** Required when Role.scope is multi-valued. */
  group?: string
}

export interface OperationChange {
  attribute: string
  set?: unknown
}

export interface Operation {
  id?: string
  /** Canonical `Target.Action` form. */
  name: string
  /** Any noun primitive (Resource/Person/Role/Group) or Process. */
  target: string
  /** Action name on the target's actions[] catalog. */
  action: string
  description?: string
  changes?: OperationChange[]
  domain?: string
}

export type TriggerSource = 'user' | 'schedule' | 'webhook' | 'operation'

export interface Trigger {
  id?: string
  /** Targets either an Operation (ad-hoc invocation) or a Process (kicks off SOP). */
  operation?: string
  process?: string
  source: TriggerSource
  description?: string
  /** Required when source === 'schedule'. Cron expression. */
  schedule?: string
  /** Required when source === 'webhook'. */
  event?: string
  /** Required when source === 'operation'. Upstream Operation name. */
  after?: string
}

export type RuleType = 'access' | 'condition'

export interface RuleAllow {
  /** Role or Person name (any actorable primitive). */
  role?: string
  ownership?: boolean
}

export interface RuleCondition {
  attribute: string
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'present' | 'absent'
  value?: unknown
}

export interface Rule {
  id?: string
  name?: string
  /** Operation this Rule constrains. */
  operation: string
  description?: string
  type?: RuleType
  /** Populated when type === 'access'. */
  allow?: RuleAllow[]
  /** Populated when type === 'condition'. */
  conditions?: RuleCondition[]
}

export interface Task {
  id?: string
  name: string
  description?: string
  /** Role or Person (any actorable primitive). */
  actor: string
  operation: string
  domain?: string
}

export interface ProcessStep {
  id: string
  task: string
  description?: string
  depends_on?: string[]
  conditions?: string[]
  /** Step id to jump to on condition failure, or "abort". */
  else?: string
}

export interface Process {
  id?: string
  name: string
  description?: string
  domain?: string
  /** Role or Person who owns the process. */
  operator: string
  /** Step id where execution begins (Amazon-States-Language convention). */
  startStep: string
  steps: ProcessStep[]
}

export interface Relationship {
  id?: string
  name: string
  from: string
  to: string
  cardinality: 'one-to-one' | 'many-to-one' | 'one-to-many' | 'many-to-many'
  attribute: string
  description?: string
  inverse?: string
}

// ── Layout overlay ──────────────────────────────────────────────────────
//
// We persist node positions alongside content in the operational.json
// document, mirroring the `views[]` pattern technical.json already uses.
// `elements` is keyed by the stable id the mapper assigns (e.g.
// `resource:Loan`, `operation:Loan.Approve`, `trigger:<id>`).

export interface OperationalLayoutElement {
  position: { x: number; y: number }
  size?: { width: number; height: number }
}

export interface OperationalLayout {
  name: string
  elements: Record<string, OperationalLayoutElement>
}

// ── Document root ───────────────────────────────────────────────────────

export interface OperationalDNA {
  domain: Domain
  memberships?: Membership[]
  operations?: Operation[]
  triggers?: Trigger[]
  rules?: Rule[]
  tasks?: Task[]
  processes?: Process[]
  relationships?: Relationship[]
  /** Layout overlay — non-canonical, rides alongside content. */
  layouts?: OperationalLayout[]
}

/**
 * Minimal runtime validation — just enough to fail fast on a structurally
 * broken file. Full schema validation happens on edit via RJSF's ajv
 * validator, not on initial load.
 */
export function parseOperationalDNA(json: unknown): OperationalDNA {
  const data = json as OperationalDNA
  if (!data || typeof data !== 'object' || !data.domain) {
    throw new Error('Invalid operational DNA: missing "domain" at document root')
  }
  return migrateOperationalDNA(data)
}

/**
 * Fetch the operational layer for a domain from the dev server.
 * The middleware reads `dna/<domain>/operational.json` verbatim.
 */
export async function loadOperationalDNA(domain: string): Promise<OperationalDNA> {
  const response = await fetch(`/api/dna/operational/${encodeURIComponent(domain)}`)
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Failed to load operational DNA for "${domain}": ${response.status} ${body}`)
  }
  const json = await response.json()
  return parseOperationalDNA(json)
}
