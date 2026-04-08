import * as fs from 'fs'
import * as path from 'path'
import { DnaValidator } from '@cell/dna-validator'
import { OperationalDNA, EventBusCellAdapter, EventBusAdapterConfig } from './types'
import * as nodeEventBusAdapter from './adapters/node/event-bus'

interface TechnicalCell {
  name: string
  dna: string
  adapter: {
    type: string
    config?: EventBusAdapterConfig & Record<string, unknown>
  }
}

interface TechnicalDNA {
  cells: TechnicalCell[]
}

const ADAPTERS: Record<string, EventBusCellAdapter> = {
  'node/event-bus': nodeEventBusAdapter,
}

function resolveAdapter(type: string): EventBusCellAdapter {
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

  // ── Resolve DNA base directory ──────────────────────────────────────────────
  const dnaBase = path.join(path.dirname(path.resolve(technicalPath)), '..', '..', 'dna')

  // ── Load and validate Operational DNA ───────────────────────────────────────
  const operationalRaw = loadDna(dnaBase, cell.dna)
  const opValidation = validator.validate(operationalRaw, 'operational')
  if (!opValidation.valid) {
    const errs = opValidation.errors.map(e => `  ${e.instancePath} ${e.message}`).join('\n')
    throw new Error(`Invalid Operational DNA:\n${errs}`)
  }

  const operational = operationalRaw as OperationalDNA
  if (!operational.signals || operational.signals.length === 0) {
    console.log(`⚠ No signals defined in Operational DNA — nothing to generate.`)
    return
  }

  // ── Resolve adapter and generate ────────────────────────────────────────────
  const adapterConfig: EventBusAdapterConfig = (cell.adapter.config ?? {}) as EventBusAdapterConfig
  const adapter = resolveAdapter(cell.adapter.type)
  fs.mkdirSync(path.resolve(outputDir), { recursive: true })
  adapter.generate(operational, adapterConfig, path.resolve(outputDir))

  console.log(`✓ Generated ${cellName} → ${outputDir}`)
}
