import * as fs from 'fs'
import * as path from 'path'
import { DnaValidator } from '@cell/dna-validator'
import { ProductUiDNA, OperationalDNA, UiCellContext, UiCellAdapter } from './types'
import * as viteReactAdapter from './adapters/vite/react'

interface TechnicalCell {
  name: string
  dna: string
  adapter: {
    type: string
    config?: Record<string, unknown>
  }
}

interface TechnicalDNA {
  cells: TechnicalCell[]
}

const ADAPTERS: Record<string, UiCellAdapter> = {
  'vite/react': viteReactAdapter,
}

function resolveAdapter(type: string): UiCellAdapter {
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

  // ── Load and validate Product UI DNA ───────────────────────────────────────
  const uiDnaRaw = loadDna(dnaBase, cell.dna)
  const uiValidation = validator.validate(uiDnaRaw, 'product/ui')
  if (!uiValidation.valid) {
    const errs = uiValidation.errors.map(e => `  ${e.instancePath} ${e.message}`).join('\n')
    throw new Error(`Invalid Product UI DNA:\n${errs}`)
  }

  // ── Optionally load and validate Operational DNA ────────────────────────────
  const operationalRef = cell.adapter.config?.operational_dna as string | undefined
  let operationalRaw: OperationalDNA | undefined

  if (operationalRef) {
    const opRaw = loadDna(dnaBase, operationalRef)
    const opValidation = validator.validate(opRaw, 'operational')
    if (!opValidation.valid) {
      const errs = opValidation.errors.map(e => `  ${e.instancePath} ${e.message}`).join('\n')
      throw new Error(`Invalid Operational DNA:\n${errs}`)
    }
    operationalRaw = opRaw as OperationalDNA
  }

  // ── Resolve API DNA reference (sibling product.api alongside product.ui) ────
  const apiRef = cell.adapter.config?.api_dna as string | undefined
  const apiFetchPath = apiRef ? `/dna/${apiRef}.json` : undefined
  const apiBase = (cell.adapter.config?.api_base as string) ?? ''

  // ── Build cell context ──────────────────────────────────────────────────────
  const ctx: UiCellContext = {
    uiFetchPath: `/dna/${cell.dna}.json`,
    apiFetchPath,
    operationalFetchPath: operationalRef ? `/dna/${operationalRef}.json` : undefined,
    apiBase,
    dnaSourceDir: dnaBase,
  }

  // ── Resolve adapter and generate ────────────────────────────────────────────
  const adapter = resolveAdapter(cell.adapter.type)
  fs.mkdirSync(path.resolve(outputDir), { recursive: true })
  adapter.generate(uiDnaRaw as ProductUiDNA, path.resolve(outputDir), operationalRaw, ctx)

  console.log(`✓ Generated ${cellName} → ${outputDir}`)
}
