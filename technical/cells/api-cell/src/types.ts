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

// ── Operational DNA ───────────────────────────────────────────────────────────

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
}

export interface Domain {
  name: string
  path?: string
  description?: string
  domains?: Domain[]
  nouns?: Noun[]
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

export interface OperationalDNA {
  domain: Domain
  capabilities?: unknown[]
  causes?: unknown[]
  rules?: Rule[]
  outcomes?: Outcome[]
  lifecycles?: unknown[]
  signals?: Signal[]
}

// ── Auth config (extracted from Technical DNA auth provider) ──────────────────

export interface AuthProviderConfig {
  domain: string
  audience: string
  roleClaim: string
}

// ── Adapter interface ─────────────────────────────────────────────────────────

export interface ApiCellAdapter {
  generate(api: ProductApiDNA, operational: OperationalDNA, outputDir: string, authConfig?: AuthProviderConfig): void
}
