// ── Product API DNA ───────────────────────────────────────────────────────────

export interface Field {
  name: string
  label: string
  type: string
  required?: boolean
  values?: string[]
}

export interface Action {
  name: string
  verb?: string
  description?: string
}

export interface Resource {
  name: string
  description?: string
  noun?: string
  fields: Field[]
  actions: Action[]
}

export interface Operation {
  resource: string
  action: string
  name: string
  capability?: string
  description?: string
}

export interface Param {
  name: string
  in: 'path' | 'query' | 'header'
  type: string
  required?: boolean
  description?: string
}

export interface RequestSchema {
  name: string
  fields: Field[]
}

export interface Endpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  operation: string
  description?: string
  params?: Param[]
  request?: RequestSchema
  response?: RequestSchema
}

export interface Namespace {
  name: string
  path: string
  domain?: string
  description?: string
  resources?: string[]
}

export interface ProductApiDNA {
  namespace: Namespace
  resources?: Resource[]
  operations?: Operation[]
  endpoints: Endpoint[]
}

// ── Product Core DNA ──────────────────────────────────────────────────────────
// Cells read Product Core DNA — a self-contained slice of operational DNA
// derived by the product-core-materializer. See product/AGENTS.md.

export interface Attribute {
  name: string
  type: string
  required?: boolean
  values?: string[]
  description?: string
}

export interface Verb {
  name: string
  description?: string
}

export interface Noun {
  name: string
  description?: string
  domain?: string
  attributes?: Attribute[]
  verbs?: Verb[]
  examples?: Record<string, unknown>[]
}

export interface Domain {
  name: string
  path: string
  description?: string
}

export interface AllowEntry {
  role: string
  ownership?: boolean
}

export interface Condition {
  attribute: string
  operator: string
  value?: unknown
}

export interface Rule {
  capability: string
  description?: string
  type?: 'access' | 'condition'
  allow?: AllowEntry[]
  conditions?: Condition[]
}

export interface Change {
  attribute: string
  set: unknown
}

export interface Outcome {
  capability: string
  description?: string
  changes: Change[]
  initiates?: string[]
  emits?: string[]
}

export interface Signal {
  name: string
  capability: string
  description?: string
  payload: { name: string; type: string; description?: string }[]
}

export interface Cause {
  capability: string
  source: string
  signal?: string
  description?: string
}

export interface ProductCoreDNA {
  domain: Domain
  nouns?: Noun[]
  capabilities?: { name: string; noun: string; verb: string }[]
  causes?: Cause[]
  rules?: Rule[]
  outcomes?: Outcome[]
  lifecycles?: unknown[]
  signals?: Signal[]
  relationships?: unknown[]
}

// ── Auth config (extracted from Technical DNA auth provider) ──────────────────

export interface AuthProviderConfig {
  domain: string
  audience: string
  roleClaim: string
}

// ── Signal dispatch config ────────────────────────────────────────────────────

/**
 * Maps Signal names to arrays of subscriber base URLs.
 * Used by the signal middleware to HTTP POST signals to subscriber APIs
 * (Pattern A — HTTP push). Configured in Technical DNA under the cell's
 * adapter config as `signal_dispatch`.
 *
 * Example:
 * ```json
 * {
 *   "lending.Loan.Disbursed": ["http://payments-api:3002"],
 *   "lending.Loan.Defaulted": ["http://collections-api:3003"]
 * }
 * ```
 */
export type SignalDispatchConfig = Record<string, string[]>

// ── Adapter interface ─────────────────────────────────────────────────────────

export interface ApiCellAdapter {
  generate(api: ProductApiDNA, core: ProductCoreDNA, outputDir: string, authConfig?: AuthProviderConfig, signalDispatch?: SignalDispatchConfig): void
}
