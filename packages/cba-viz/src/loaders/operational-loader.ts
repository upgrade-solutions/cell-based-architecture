/**
 * Operational DNA types + loader.
 *
 * Field names and shapes must match `operational/schemas/*.json` exactly.
 * The RJSF-driven inspector form round-trips data through these interfaces
 * back to the schema, so any drift breaks editing silently. If you change
 * a schema, update the corresponding interface here and re-run tsc.
 */

// ── Primitive types (mirror operational/schemas/*.json) ─────────────────

export interface Attribute {
  name: string
  type: 'string' | 'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'enum' | 'reference'
  description?: string
  required?: boolean
  /** Only valid when type === 'enum'. */
  values?: string[]
  /** Only valid when type === 'reference'. */
  noun?: string
}

export interface Verb {
  name: string
  description?: string
  noun?: string
  input?: Attribute[]
  output?: Attribute[]
}

export interface Noun {
  name: string
  description?: string
  /** Dot-separated domain path this noun lives in. */
  domain?: string
  attributes?: Attribute[]
  verbs?: Verb[]
  examples?: Array<Record<string, unknown>>
}

export interface Domain {
  name: string
  description?: string
  path?: string
  domains?: Domain[]
  nouns?: Noun[]
}

export interface Capability {
  /** Noun this capability applies to. */
  noun: string
  /** Verb performed on the noun. */
  verb: string
  /** Canonical `Noun.Verb` form. Redundant with noun+verb but stored for fast lookup. */
  name?: string
  description?: string
}

export type CauseSource = 'user' | 'schedule' | 'webhook' | 'capability' | 'signal'

export interface Cause {
  capability: string
  description?: string
  source: CauseSource
  /** Required when source === 'schedule'. Cron expression. */
  schedule?: string
  /** Required when source === 'webhook'. */
  event?: string
  /** Required when source === 'capability'. Upstream `Noun.Verb`. */
  after?: string
  /** Required when source === 'signal'. Fully qualified signal name. */
  signal?: string
  condition?: RuleCondition
}

export type RuleType = 'access' | 'condition'

export interface RuleAllow {
  role?: string
  ownership?: boolean
}

export interface RuleCondition {
  attribute: string
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'present' | 'absent'
  value?: unknown
}

export interface Rule {
  capability: string
  description?: string
  type?: RuleType
  /** Populated when type === 'access'. */
  allow?: RuleAllow[]
  /** Populated when type === 'condition'. */
  conditions?: RuleCondition[]
}

export interface OutcomeChange {
  attribute: string
  set: unknown
}

export interface Outcome {
  capability: string
  description?: string
  changes: OutcomeChange[]
  /** Downstream `Noun.Verb` capabilities to initiate synchronously. */
  initiates?: string[]
  /** Fully qualified signal names to emit asynchronously. */
  emits?: string[]
}

export interface SignalPayloadField {
  name: string
  type: 'string' | 'text' | 'number' | 'boolean' | 'date' | 'datetime'
  description?: string
}

export interface Signal {
  /** Fully qualified name: `domain.Noun.PastTenseVerb`. */
  name: string
  /** The `Noun.Verb` capability whose success publishes this signal. */
  capability: string
  description?: string
  payload: SignalPayloadField[]
}

export interface Position {
  name: string
  description?: string
  domain?: string
  reports_to?: string
  roles?: string[]
}

export interface Person {
  name: string
  display_name?: string
  position: string
  email?: string
  domain?: string
  active?: boolean
}

export interface Task {
  name: string
  description?: string
  position: string
  capability: string
  domain?: string
}

export interface ProcessStep {
  id: string
  task: string
  description?: string
  depends_on?: string[]
  branch?: { when: string; else?: string }
}

export interface Process {
  name: string
  description?: string
  domain?: string
  operator: string
  steps: ProcessStep[]
  emits?: string[]
}

export interface Relationship {
  name: string
  from: string
  to: string
  cardinality: 'one-to-one' | 'many-to-one' | 'one-to-many' | 'many-to-many'
  attribute: string
  description?: string
  inverse?: string
}

export interface EquationOutput {
  name: string
  type: 'string' | 'number' | 'boolean' | 'date' | 'datetime'
}

export interface Equation {
  name: string
  description?: string
  input: string[]
  output: EquationOutput
}

// ── Layout overlay ──────────────────────────────────────────────────────
//
// We persist node positions alongside content in the operational.json
// document, mirroring the `views[]` pattern technical.json already uses.
// `elements` is keyed by the stable id the mapper assigns (e.g.
// `noun:Loan`, `capability:Loan.Approve`, `signal:lending.Loan.Disbursed`).

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
  capabilities?: Capability[]
  causes?: Cause[]
  rules?: Rule[]
  outcomes?: Outcome[]
  equations?: Equation[]
  signals?: Signal[]
  relationships?: Relationship[]
  positions?: Position[]
  persons?: Person[]
  tasks?: Task[]
  processes?: Process[]
  /** Phase 1 layout overlay — non-canonical, rides alongside content. */
  layouts?: OperationalLayout[]
}

/**
 * Minimal runtime validation — just enough to fail fast on a
 * structurally broken file. Full schema validation happens on edit via
 * RJSF's ajv validator, not on initial load.
 */
export function parseOperationalDNA(json: unknown): OperationalDNA {
  const data = json as OperationalDNA
  if (!data || typeof data !== 'object' || !data.domain) {
    throw new Error('Invalid operational DNA: missing "domain" at document root')
  }
  return data
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
