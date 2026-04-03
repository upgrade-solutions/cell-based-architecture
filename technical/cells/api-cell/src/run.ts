import * as fs from 'fs'
import * as path from 'path'
import { DnaValidator } from '@cell/dna-validator'
import { ProductApiDNA, OperationalDNA, ApiCellAdapter } from './types'
import * as nestjsAdapter from './adapters/node/nestjs'

interface TechnicalCell {
  name: string
  dna: string
  adapter: {
    type: string
    config?: {
      operational_dna?: string
      [key: string]: unknown
    }
  }
}

interface TechnicalDNA {
  cells: TechnicalCell[]
}

const ADAPTERS: Record<string, ApiCellAdapter> = {
  'node/nestjs': nestjsAdapter,
}

function resolveAdapter(type: string): ApiCellAdapter {
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

  // ── Load and validate Product API DNA ──────────────────────────────────────
  const apiDnaRaw = loadDna(dnaBase, cell.dna)
  const apiValidation = validator.validate(apiDnaRaw, 'product/api')
  if (!apiValidation.valid) {
    const errs = apiValidation.errors.map(e => `  ${e.instancePath} ${e.message}`).join('\n')
    throw new Error(`Invalid Product API DNA:\n${errs}`)
  }

  // ── Load and validate Operational DNA (for ORM sub-adapter) ────────────────
  const operationalRef = cell.adapter.config?.operational_dna
  if (!operationalRef) {
    throw new Error(`Cell "${cellName}" adapter config is missing "operational_dna"`)
  }
  const operationalRaw = loadDna(dnaBase, operationalRef)
  const opValidation = validator.validate(operationalRaw, 'operational')
  if (!opValidation.valid) {
    const errs = opValidation.errors.map(e => `  ${e.instancePath} ${e.message}`).join('\n')
    throw new Error(`Invalid Operational DNA:\n${errs}`)
  }

  // ── Resolve adapter and generate ────────────────────────────────────────────
  const adapter = resolveAdapter(cell.adapter.type)
  fs.mkdirSync(path.resolve(outputDir), { recursive: true })
  adapter.generate(apiDnaRaw as ProductApiDNA, operationalRaw as OperationalDNA, path.resolve(outputDir))

  console.log(`✓ Generated ${cellName} → ${outputDir}`)
}
