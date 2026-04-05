// ── Operational DNA (for schema generation) ─────────────────────────────────

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
  domains?: Domain[]
  nouns?: Noun[]
}

export interface OperationalDNA {
  domain: Domain
}

// ── Database construct config ────────────────────────────────────────��──────

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
    operational: OperationalDNA,
    adapterConfig: DbAdapterConfig,
    constructConfig: DbConstructConfig,
    outputDir: string,
  ): void
}
