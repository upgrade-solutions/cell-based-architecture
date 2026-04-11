import * as fs from 'fs'
import * as path from 'path'
import { DnaValidator } from '@cell/dna-validator'
import { ProductApiDNA, ProductCoreDNA, AuthProviderConfig, SignalDispatchConfig, ApiCellAdapter } from './types'
import * as nestjsAdapter from './adapters/node/nestjs'
import * as expressAdapter from './adapters/node/express'
import * as railsAdapter from './adapters/ruby/rails'
import * as fastapiAdapter from './adapters/python/fastapi'

interface TechnicalCell {
  name: string
  dna: string
  adapter: {
    type: string
    config?: {
      core_dna?: string
      [key: string]: unknown
    }
  }
}

interface TechnicalProvider {
  name: string
  type: string
  config?: Record<string, unknown>
}

interface TechnicalDNA {
  providers?: TechnicalProvider[]
  cells: TechnicalCell[]
}

const ADAPTERS: Record<string, ApiCellAdapter> = {
  'node/nestjs': nestjsAdapter,
  'node/express': expressAdapter,
  'ruby/rails': railsAdapter,
  'python/fastapi': fastapiAdapter,
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

  // ── Load and validate Product API DNA ──────────────────────────────────────
  const apiDnaRaw = loadDna(dnaBase, cell.dna)
  const apiValidation = validator.validate(apiDnaRaw, 'product/api')
  if (!apiValidation.valid) {
    const errs = apiValidation.errors.map(e => `  ${e.instancePath} ${e.message}`).join('\n')
    throw new Error(`Invalid Product API DNA:\n${errs}`)
  }

  // ── Load and validate Product Core DNA ─────────────────────────────────────
  const coreRef = cell.adapter.config?.core_dna
  if (!coreRef) {
    throw new Error(`Cell "${cellName}" adapter config is missing "core_dna"`)
  }
  const coreRaw = loadDna(dnaBase, coreRef)
  const coreValidation = validator.validate(coreRaw, 'product/core')
  if (!coreValidation.valid) {
    const errs = coreValidation.errors.map(e => `  ${e.instancePath} ${e.message}`).join('\n')
    throw new Error(`Invalid Product Core DNA:\n${errs}`)
  }

  // ── Extract auth provider config ────────────────────────────────────────────
  const authProvider = (technicalRaw.providers ?? []).find(p => p.type === 'auth')
  const authConfig: AuthProviderConfig | undefined = authProvider?.config
    ? {
        domain: authProvider.config.domain as string,
        audience: authProvider.config.audience as string,
        roleClaim: (authProvider.config.roleClaim as string) ?? 'roles',
      }
    : undefined

  // ── Extract signal dispatch config ──────────────────────────────────────────
  const signalDispatch = cell.adapter.config?.signal_dispatch as SignalDispatchConfig | undefined

  // ── Resolve adapter and generate ────────────────────────────────────────────
  const adapter = resolveAdapter(cell.adapter.type)
  fs.mkdirSync(path.resolve(outputDir), { recursive: true })
  adapter.generate(apiDnaRaw as ProductApiDNA, coreRaw as ProductCoreDNA, path.resolve(outputDir), authConfig, signalDispatch)

  console.log(`✓ Generated ${cellName} → ${outputDir}`)
}
