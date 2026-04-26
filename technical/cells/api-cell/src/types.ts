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

export interface ApiOperation {
  resource: string
  action: string
  name: string
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
  operations?: ApiOperation[]
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

export interface ResourceAction {
  name: string
  description?: string
  type?: 'read' | 'write' | 'destructive' | string
}

/**
 * Operational/Product Core noun primitive. Resources carry both attributes and
 * the catalog of actions that can be performed on them.
 *
 * The api-cell historically called this `Noun`; the renamed `CoreResource`
 * replaces it. (Resources from Product API DNA are a different shape — see
 * `Resource` above — this one mirrors the operational `Resource`.)
 */
export interface CoreResource {
  name: string
  description?: string
  domain?: string
  attributes?: Attribute[]
  actions?: ResourceAction[]
  parent?: string
  examples?: Record<string, unknown>[]
}

export interface Domain {
  name: string
  path: string
  description?: string
}

export interface AllowEntry {
  role?: string
  ownership?: boolean
  flags?: string[]
}

export interface Condition {
  attribute: string
  operator: string
  value?: unknown
}

export interface Rule {
  /**
   * The Operation this rule applies to, expressed as `Resource.Action`.
   * Replaces the old `capability` field — same wire shape, new name.
   */
  operation: string
  name?: string
  description?: string
  type?: 'access' | 'condition'
  allow?: AllowEntry[]
  conditions?: Condition[]
}

export interface Change {
  attribute: string
  set: unknown
}

/**
 * A core operation — a Resource:Action pair with the optional state mutations
 * (`changes`) it applies. Replaces the old Capability + Outcome split.
 */
export interface CoreOperation {
  resource: string
  action: string
  name?: string
  description?: string
  changes?: Change[]
}

export interface Trigger {
  operation?: string
  process?: string
  description?: string
  source: 'user' | 'schedule' | 'webhook' | 'operation' | string
  schedule?: string
  event?: string
  after?: string
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

export interface ProductCoreDNA {
  domain: Domain
  resources?: CoreResource[]
  operations?: CoreOperation[]
  triggers?: Trigger[]
  rules?: Rule[]
  relationships?: Relationship[]
}

// ── Auth config (extracted from Technical DNA auth provider) ──────────────────

export interface AuthProviderConfig {
  domain: string
  audience: string
  roleClaim: string
}

// ── Adapter interface ─────────────────────────────────────────────────────────

export interface ApiCellAdapter {
  generate(api: ProductApiDNA, core: ProductCoreDNA, outputDir: string, authConfig?: AuthProviderConfig): void
}
