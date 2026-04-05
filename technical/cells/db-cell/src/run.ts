import * as fs from 'fs'
import * as path from 'path'
import { DnaValidator } from '@cell/dna-validator'
import { OperationalDNA, DbCellAdapter, DbAdapterConfig, DbConstructConfig } from './types'
import * as postgresAdapter from './adapters/postgres'

interface TechnicalCell {
  name: string
  dna: string
  adapter: {
    type: string
    config?: DbAdapterConfig & Record<string, unknown>
  }
  constructs?: string[]
}

interface Construct {
  name: string
  category: string
  type: string
  config?: DbConstructConfig & Record<string, unknown>
  environment?: string
}

interface TechnicalDNA {
  cells: TechnicalCell[]
  constructs?: Construct[]
}

const ADAPTERS: Record<string, DbCellAdapter> = {
  postgres: postgresAdapter,
}

function resolveAdapter(type: string): DbCellAdapter {
  const adapter = ADAPTERS[type]
  if (!adapter) {
    throw new Error(
      `Unknown adapter: "${type}". Available: ${Object.keys(ADAPTERS).join(', ')}`
    )
  }
  return adapter
}

function loadDna(dnaBase: string, ref: string): unknown {
  const resolved = path.resolve(dnaBase, `${ref}.json`)
  if (!fs.existsSync(resolved)) {
    throw new Error(`DNA file not found: ${resolved}`)
  }
  return JSON.parse(fs.readFileSync(resolved, 'utf-8'))
}

export function run(technicalPath: string, cellName: string, outputDir: string): void {
  const validator = new DnaValidator()

  // ── Load Technical DNA ──────────────────────────────────────────────────────
  const technicalRaw = JSON.parse(
    fs.readFileSync(path.resolve(technicalPath), 'utf-8')
  ) as TechnicalDNA

  const cell = technicalRaw.cells.find(c => c.name === cellName)
  if (!cell) {
    throw new Error(
      `Cell "${cellName}" not found. Available: ${technicalRaw.cells.map(c => c.name).join(', ')}`
    )
  }

  // ── Resolve DNA base directory (sibling of technical.json) ─────────────────
  const dnaBase = path.join(path.dirname(path.resolve(technicalPath)), '..', '..', 'dna')

  // ── Load and validate Operational DNA ──────────────────────────────────────
  const operationalRaw = loadDna(dnaBase, cell.dna)
  const opValidation = validator.validate(operationalRaw, 'operational')
  if (!opValidation.valid) {
    const errs = opValidation.errors.map(e => `  ${e.instancePath} ${e.message}`).join('\n')
    throw new Error(`Invalid Operational DNA:\n${errs}`)
  }

  // ── Resolve construct config ───────────────────────────────────────────────
  const adapterConfig = (cell.adapter.config ?? {}) as DbAdapterConfig
  const constructName = adapterConfig.construct
  const construct = (technicalRaw.constructs ?? []).find(
    c => c.name === constructName && c.type === 'database' && !c.environment
  )
  const constructConfig: DbConstructConfig = (construct?.config as DbConstructConfig) ?? {
    engine: 'postgres',
    version: '16',
  }

  // ── Resolve adapter and generate ────────────────────────────────────────────
  const adapter = resolveAdapter(cell.adapter.type)
  fs.mkdirSync(path.resolve(outputDir), { recursive: true })
  adapter.generate(
    operationalRaw as OperationalDNA,
    adapterConfig,
    constructConfig,
    path.resolve(outputDir),
  )

  console.log(`✓ Generated ${cellName} → ${outputDir}`)
}
