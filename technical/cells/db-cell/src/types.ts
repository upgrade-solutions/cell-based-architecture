// ── Product Core DNA ────────────────────────────────────────────────────────
// db-cell is infrastructure-only — it validates Product Core DNA but does not
// read from it. Schema and seed are owned by api-cell.

export type ProductCoreDNA = unknown

// ── Database construct config ───────────────────────────────────────────────

export interface DbConstructConfig {
  engine: string
  version?: string
  instance_class?: string
  port?: number
}

export interface DbAdapterConfig {
  construct: string
  database: string
  app_role?: string
  app_password?: string
  port?: number
}

// ── Adapter interface ───────────────────────────────────────────────────────

export interface DbCellAdapter {
  generate(
    core: ProductCoreDNA,
    adapterConfig: DbAdapterConfig,
    constructConfig: DbConstructConfig,
    outputDir: string,
  ): void
}
