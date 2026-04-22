import * as fs from 'fs'
import * as path from 'path'
import { DnaValidator } from '@dna/validator'
import { ProductUiDNA, ProductCoreDNA, UiCellContext, UiCellAdapter } from './types'
import * as viteReactAdapter from './adapters/vite/react'
import * as viteVueAdapter from './adapters/vite/vue'
import * as nextReactAdapter from './adapters/next/react'

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
  'vite/vue': viteVueAdapter,
  'next/react': nextReactAdapter,
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

/**
 * Locate the `dna/` directory that holds referenced DNA files.
 *
 * Priority:
 *   1. `CBA_DNA_BASE` env var — set by `cba develop` when it spawns the
 *      generator against a resolved technical.json that lives under output/.
 *   2. Walk up from `technicalPath` looking for a `dna/` ancestor — the
 *      legacy path used when the cell generator is invoked directly.
 */
function findDnaBase(technicalPath: string): string {
  const fromEnv = process.env.CBA_DNA_BASE
  if (fromEnv) return path.resolve(fromEnv)
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

  // ── Resolve DNA base directory ──────────────────────────────────────────────
  const dnaBase = findDnaBase(technicalPath)

  // ── Load and validate Product UI DNA ───────────────────────────────────────
  const uiDnaRaw = loadDna(dnaBase, cell.dna)
  const uiValidation = validator.validate(uiDnaRaw, 'product/ui')
  if (!uiValidation.valid) {
    const errs = uiValidation.errors.map(e => `  ${e.instancePath} ${e.message}`).join('\n')
    throw new Error(`Invalid Product UI DNA:\n${errs}`)
  }

  // ── Optionally load and validate Product Core DNA ───────────────────────────
  const coreRef = cell.adapter.config?.core_dna as string | undefined
  let coreRaw: ProductCoreDNA | undefined

  if (coreRef) {
    const raw = loadDna(dnaBase, coreRef)
    const coreValidation = validator.validate(raw, 'product/core')
    if (!coreValidation.valid) {
      const errs = coreValidation.errors.map(e => `  ${e.instancePath} ${e.message}`).join('\n')
      throw new Error(`Invalid Product Core DNA:\n${errs}`)
    }
    coreRaw = raw as ProductCoreDNA
  }

  // ── Resolve API DNA reference (sibling product.api alongside product.ui) ────
  const apiRef = cell.adapter.config?.api_dna as string | undefined
  const apiFetchPath = apiRef ? `/dna/${apiRef}.json` : undefined
  const apiBase = (cell.adapter.config?.api_base as string) ?? ''
  const vendorComponents = (cell.adapter.config?.vendorComponents as boolean | undefined) ?? true

  // ── Resolve Operational DNA reference (explicit or sibling convention) ──────
  // Rules live in operational.json and drive the flag-aware render + click
  // guards. Prefer an explicit `operational_dna` config key; otherwise fall
  // back to the convention that each domain has a sibling `operational.json`
  // next to its `product.ui.json` (e.g. `lending/operational`).
  let operationalRef = cell.adapter.config?.operational_dna as string | undefined
  if (!operationalRef) {
    const domainPrefix = cell.dna.includes('/') ? cell.dna.split('/').slice(0, -1).join('/') : ''
    const candidate = domainPrefix ? `${domainPrefix}/operational` : 'operational'
    if (fs.existsSync(path.resolve(dnaBase, `${candidate}.json`))) {
      operationalRef = candidate
    }
  }
  const operationalFetchPath = operationalRef ? `/dna/${operationalRef}.json` : undefined

  // ── Build cell context ──────────────────────────────────────────────────────
  const ctx: UiCellContext = {
    uiFetchPath: `/dna/${cell.dna}.json`,
    apiFetchPath,
    coreFetchPath: coreRef ? `/dna/${coreRef}.json` : undefined,
    operationalFetchPath,
    apiBase,
    dnaSourceDir: dnaBase,
    vendorComponents,
  }

  // ── Resolve adapter and generate ────────────────────────────────────────────
  const adapter = resolveAdapter(cell.adapter.type)
  fs.mkdirSync(path.resolve(outputDir), { recursive: true })
  adapter.generate(uiDnaRaw as ProductUiDNA, path.resolve(outputDir), coreRaw, ctx)

  console.log(`✓ Generated ${cellName} → ${outputDir}`)
}
