import * as path from 'path'
import { spawnSync } from 'child_process'
import { resolveDomain, loadLayer } from './context'
import { ParsedArgs, flag, boolFlag } from './args'
import { emit, emitError, emitOk } from './output'
import { DEVELOP_HELP } from './help'

interface CellPlan {
  name: string
  adapter: string
  workspace: string
  outputDir: string
  technicalPath: string
}

/**
 * Resolve the workspace package that provides a given adapter.type.
 * Convention: adapter-type prefix identifies the cell package.
 */
function workspaceForAdapter(adapterType: string): string | undefined {
  if (adapterType.startsWith('node/')) return '@cell/api-cell'
  if (adapterType.startsWith('ruby/')) return '@cell/api-cell'
  if (adapterType.startsWith('python/')) return '@cell/api-cell'
  if (adapterType === 'postgres') return '@cell/db-cell'
  if (adapterType.startsWith('vite/') || adapterType.startsWith('next/')) return '@cell/ui-cell'
  return undefined
}

/**
 * Output directory convention: output/<domain>-<cell-suffix>/
 * where cell-suffix = cell.name with "-cell" suffix stripped.
 *   api-cell         → output/<domain>-api
 *   api-cell-nestjs  → output/<domain>-api-nestjs
 *   db-cell          → output/<domain>-db
 *   ui-cell          → output/<domain>-ui
 */
function outputDirFor(cellName: string, domain: string, root: string): string {
  const suffix = cellName.replace(/-cell/g, '').replace(/^-|-$/g, '')
  return path.join(root, 'output', `${domain}-${suffix}`)
}

function planCells(domain: string, cellFilter?: string): CellPlan[] {
  const paths = resolveDomain(domain)
  const technical = loadLayer(paths, 'technical')
  const cells = technical.cells ?? []

  return cells
    .filter((c: any) => !cellFilter || c.name === cellFilter)
    .map((cell: any) => {
      const workspace = workspaceForAdapter(cell.adapter.type)
      if (!workspace) {
        throw new Error(
          `No cba workspace registered for adapter type "${cell.adapter.type}" (cell: ${cell.name})`,
        )
      }
      return {
        name: cell.name,
        adapter: cell.adapter.type,
        workspace,
        outputDir: outputDirFor(cell.name, domain, paths.root),
        technicalPath: paths.files.technical,
      }
    })
}

export function runDevelop(argv: string[], args: ParsedArgs): void {
  const json = boolFlag(args, 'json')
  const opts = { json }

  if (boolFlag(args, 'help')) {
    console.log(DEVELOP_HELP)
    return
  }

  const [domain] = argv
  if (!domain) {
    emitError('Usage: cba develop <domain> [--cell <name>] [--dry-run]', opts)
    process.exit(1)
  }

  const cellFilter = flag(args, 'cell')
  const dryRun = boolFlag(args, 'dry-run')

  let plans: CellPlan[]
  try {
    plans = planCells(domain, cellFilter)
  } catch (err) {
    emitError((err as Error).message, opts)
    process.exit(1)
  }

  if (plans.length === 0) {
    emitError(
      cellFilter
        ? `Cell "${cellFilter}" not found in technical DNA of ${domain}`
        : `No cells declared in technical DNA of ${domain}`,
      opts,
    )
    process.exit(1)
  }

  if (dryRun) {
    emit({ domain, dryRun: true, plans }, opts, () => {
      const lines = [`cba develop ${domain} — dry run (${plans.length} cell(s))`]
      for (const p of plans) {
        lines.push(``, `  ${p.name}  (${p.adapter})`)
        lines.push(`    workspace : ${p.workspace}`)
        lines.push(`    output    : ${path.relative(process.cwd(), p.outputDir)}`)
      }
      return lines.join('\n')
    })
    return
  }

  // Execute each cell's generator
  const results: Array<{ cell: string; ok: boolean; code: number }> = []
  for (const p of plans) {
    if (!json) console.log(`→ ${p.name} (${p.adapter}) → ${path.relative(process.cwd(), p.outputDir)}`)
    const result = spawnSync(
      'npx',
      [
        'ts-node',
        '-r',
        'tsconfig-paths/register',
        'src/index.ts',
        p.technicalPath,
        p.name,
        p.outputDir,
      ],
      {
        cwd: workspaceDir(p.workspace),
        stdio: json ? 'pipe' : 'inherit',
        env: process.env,
      },
    )
    results.push({ cell: p.name, ok: result.status === 0, code: result.status ?? 1 })
    if (result.status !== 0) {
      if (json) {
        emitError(`Cell "${p.name}" generation failed`, opts, { results })
      } else {
        console.error(`✗ Cell "${p.name}" generation failed`)
      }
      process.exit(1)
    }
  }

  emitOk({ domain, results }, opts, () => `✓ Generated ${results.length} cell(s) for ${domain}`)
}

function workspaceDir(workspace: string): string {
  // All cell workspaces live under technical/cells/<name>
  // All package workspaces live under packages/<name>
  const { findRepoRoot } = require('./context')
  const root = findRepoRoot()
  const name = workspace.replace('@cell/', '')
  if (name === 'dna-validator' || name === 'cba') {
    return path.join(root, 'packages', name)
  }
  return path.join(root, 'technical/cells', name)
}
