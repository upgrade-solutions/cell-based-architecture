// ── Product Core DNA types (subset used by event-bus-cell) ───────────────────
// The event-bus-cell reads Product Core DNA — it does not read Operational DNA
// directly. See product/AGENTS.md for the layering contract.

export interface Signal {
  name: string
  capability: string
  description?: string
  payload: PayloadField[]
}

export interface PayloadField {
  name: string
  type: 'string' | 'text' | 'number' | 'boolean' | 'date' | 'datetime'
  description?: string
}

export interface Outcome {
  capability: string
  description?: string
  changes: unknown[]
  initiates?: string[]
  emits?: string[]
}

export interface Cause {
  capability: string
  source: string
  signal?: string
  description?: string
}

export interface Domain {
  name: string
  path: string
  description?: string
}

export interface ProductCoreDNA {
  domain: Domain
  nouns?: { name: string }[]
  capabilities?: { name: string; noun: string; verb: string }[]
  signals?: Signal[]
  outcomes?: Outcome[]
  causes?: Cause[]
}

// ── Adapter interface ─────────────────────────────────────────────────────────

export interface EventBusCellAdapter {
  generate(
    core: ProductCoreDNA,
    config: EventBusAdapterConfig,
    outputDir: string,
  ): void
}

export interface EventBusAdapterConfig {
  engine?: string
  domains?: string[]
}
