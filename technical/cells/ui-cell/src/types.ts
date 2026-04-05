// ── Product UI DNA ────────────────────────────────────────────────────────────

export interface Field {
  name: string
  label: string
  type: string
  required?: boolean
  values?: string[]
}

export interface Block {
  name: string
  type: 'form' | 'table' | 'detail' | 'actions' | 'empty-state' | string
  description?: string
  operation?: string
  fields?: Field[]
  rowLink?: string
}

export interface Page {
  name: string
  resource: string
  description?: string
  blocks: Block[]
}

export interface Layout {
  name: string
  type: 'sidebar' | 'full-width' | string
  description?: string
}

export interface Route {
  path: string
  page: string
  description?: string
}

export interface ProductUiDNA {
  layout: Layout
  pages: Page[]
  routes: Route[]
}

// ── Operational DNA (minimal — used for stub extraction) ──────────────────────

export interface Attribute {
  name: string
  type: string
  required?: boolean
  values?: string[]
  description?: string
}

export interface Noun {
  name: string
  description?: string
  attributes?: Attribute[]
  examples?: Record<string, unknown>[]
}

export interface Domain {
  name: string
  path?: string
  description?: string
  nouns?: Noun[]
  domains?: Domain[]
}

export interface OperationalDNA {
  domain: Domain
}

// ── Product API DNA (minimal — used for operation→endpoint resolution) ───────

export interface ApiEndpoint {
  method: string
  path: string
  operation: string
  description?: string
  params?: { name: string; in: string; type: string; required?: boolean }[]
  request?: { name: string; fields: { name: string; type: string; required?: boolean }[] }
  response?: { name: string; fields: { name: string; type: string }[] }
}

export interface ApiResource {
  name: string
  noun: string
  actions: { name: string; verb?: string; description?: string }[]
}

export interface ProductApiDNA {
  namespace: { name: string; path: string }
  resources: ApiResource[]
  endpoints: ApiEndpoint[]
}

// ── Cell context — passed from run.ts to the adapter ─────────────────────────

export interface UiCellContext {
  uiFetchPath: string           // e.g. /dna/lending/product.ui.json
  apiFetchPath?: string         // e.g. /dna/lending/product.api.json
  operationalFetchPath?: string // e.g. /dna/lending/operational.json
  apiBase?: string              // e.g. http://localhost:3001
  dnaSourceDir: string          // absolute path to the dna/ directory
}

// ── Adapter interface ─────────────────────────────────────────────────────────

export interface UiCellAdapter {
  generate(ui: ProductUiDNA, outputDir: string, operational?: OperationalDNA, ctx?: UiCellContext): void
}
