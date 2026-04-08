// ── Operational DNA types (subset used by event-bus-cell) ─────────────────────

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
  path?: string
  domains?: Domain[]
  nouns?: { name: string }[]
}

export interface OperationalDNA {
  domain: Domain
  capabilities?: { name: string; noun: string; verb: string }[]
  signals?: Signal[]
  outcomes?: Outcome[]
  causes?: Cause[]
}

// ── Adapter interface ─────────────────────────────────────────────────────────

export interface EventBusCellAdapter {
  generate(
    operational: OperationalDNA,
    config: EventBusAdapterConfig,
    outputDir: string,
  ): void
}

export interface EventBusAdapterConfig {
  engine?: string
  domains?: string[]
}
