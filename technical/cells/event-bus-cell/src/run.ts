import * as fs from 'fs'
import * as path from 'path'
import { DnaValidator } from '@dna/validator'
import { ProductCoreDNA, EventBusCellAdapter, EventBusAdapterConfig } from './types'
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

/** Walk up from a technical.json path to find its `dna/` ancestor directory. */
function findDnaBase(technicalPath: string): string {
  let dir = path.dirname(path.resolve(technicalPath))
  const root = path.parse(dir).root
  while (dir !== root) {
    if (path.basename(dir) === 'dna') return dir
    dir = path.dirname(dir)
  }
  return path.join(path.dirname(path.resolve(technicalPath)), '..', '..', 'dna')
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

  // ── Resolve DNA base directory (the `dna/` ancestor of technical.json) ────
  const dnaBase = findDnaBase(technicalPath)

  // ── Load and validate Product Core DNA ──────────────────────────────────────
  const coreRaw = loadDna(dnaBase, cell.dna)
  const coreValidation = validator.validate(coreRaw, 'product/core')
  if (!coreValidation.valid) {
    const errs = coreValidation.errors.map(e => `  ${e.instancePath} ${e.message}`).join('\n')
    throw new Error(`Invalid Product Core DNA:\n${errs}`)
  }

  const core = coreRaw as ProductCoreDNA
  if (!core.signals || core.signals.length === 0) {
    console.log(`⚠ No signals defined in Product Core DNA — nothing to generate.`)
    return
  }

  // ── Resolve adapter and generate ────────────────────────────────────────────
  const adapterConfig: EventBusAdapterConfig = (cell.adapter.config ?? {}) as EventBusAdapterConfig
  const adapter = resolveAdapter(cell.adapter.type)
  fs.mkdirSync(path.resolve(outputDir), { recursive: true })
  adapter.generate(core, adapterConfig, path.resolve(outputDir))

  console.log(`✓ Generated ${cellName} → ${outputDir}`)
}
