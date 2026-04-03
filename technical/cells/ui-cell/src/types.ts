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

// ── Adapter interface ─────────────────────────────────────────────────────────

export interface UiCellAdapter {
  generate(ui: ProductUiDNA, outputDir: string): void
}
