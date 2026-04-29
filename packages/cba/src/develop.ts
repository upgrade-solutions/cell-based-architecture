import * as fs from 'fs'
import * as path from 'path'
import { spawnSync } from 'child_process'
import { resolveDomain, loadLayer } from './context'
import { ParsedArgs, flag, boolFlag } from './args'
import { emit, emitError, emitOk } from './output'
import { DEVELOP_HELP } from './help'
import { materializeAndSaveProductCore } from './product-core'

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
  if (adapterType.startsWith('node/')) return '@dna-codes/cells-api'
  if (adapterType.startsWith('ruby/')) return '@dna-codes/cells-api'
  if (adapterType.startsWith('python/')) return '@dna-codes/cells-api'
  if (adapterType === 'postgres') return '@dna-codes/cells-db'
  if (adapterType.startsWith('vite/') || adapterType.startsWith('next/')) return '@dna-codes/cells-ui'
  return undefined
}

/**
 * Output directory convention: output/<domain>/<env>/<cell-suffix>/
 * where cell-suffix = cell.name with "-cell" suffix stripped.
 *   api-cell         → output/<domain>/<env>/api
 *   api-cell-nestjs  → output/<domain>/<env>/api-nestjs
 *   db-cell          → output/<domain>/<env>/db
 *   ui-cell          → output/<domain>/<env>/ui
 *
 * Env-scoping lets dev and prod generate independently — e.g. dev api-cell
 * can be built against SQLite + RabbitMQ while prod is Postgres + EventBridge.
 */
function outputDirFor(cellName: string, domain: string, root: string, environment: string): string {
  const suffix = cellName.replace(/-cell/g, '').replace(/^-|-$/g, '')
  return path.join(root, 'output', domain, environment, suffix)
}

/**
 * Resolve the environment from --env or fall back to the first one declared
 * in technical.json. Mirrors `cba views`' fallback so `cba develop` and
 * `cba views` land on the same default when invoked without --env.
 */
function resolveEnvironment(paths: ReturnType<typeof resolveDomain>, envArg: string | undefined): string {
  if (envArg) return envArg
  const technical = loadLayer(paths, 'technical')
  const envs = (technical.environments ?? []) as Array<{ name: string }>
  return envs[0]?.name ?? 'dev'
}

/**
 * Apply the same `environment` overlay rule as `buildPlan`: entries with a
 * matching `environment` field override entries with no `environment` field.
 * Kept local to develop.ts so this command doesn't depend on deliver/plan.ts,
 * which would drag the deploy-adapter graph in.
 */
function overlayByEnv<T extends { name: string; environment?: string }>(items: T[], environment: string): T[] {
  const byName = new Map<string, T>()
  for (const item of items) {
    if (item.environment && item.environment !== environment) continue
    const existing = byName.get(item.name)
    if (!existing || (item.environment && !existing.environment)) {
      byName.set(item.name, item)
    }
  }
  return Array.from(byName.values())
}

/**
 * Materialize an env-resolved technical.json for the cell generators to read.
 *
 * Cell generators are spawned as child processes and find their cell by name
 * via `technical.cells.find(c => c.name === cellName)`. With env-scoped
 * duplicates in source technical.json, that lookup would find the first entry
 * (the default) and miss the env-specific override. Rather than teach every
 * generator about overlays, we resolve once here and hand them a flat copy.
 *
 * Written inside the env's output dir so it's discoverable when debugging a
 * generator run — "what exact config was the api-cell built with?" answers
 * with one file read.
 */
function writeResolvedTechnical(
  sourcePath: string,
  domain: string,
  environment: string,
  root: string,
): string {
  const raw = JSON.parse(fs.readFileSync(sourcePath, 'utf-8'))
  const resolved = {
    ...raw,
    cells: overlayByEnv(raw.cells ?? [], environment),
    constructs: overlayByEnv(raw.constructs ?? [], environment),
    variables: overlayByEnv(raw.variables ?? [], environment),
    scripts: overlayByEnv(raw.scripts ?? [], environment),
  }
  const envDir = path.join(root, 'output', domain, environment)
  fs.mkdirSync(envDir, { recursive: true })
  const outPath = path.join(envDir, 'technical.resolved.json')
  fs.writeFileSync(outPath, JSON.stringify(resolved, null, 2) + '\n', 'utf-8')
  return outPath
}

function planCells(
  domain: string,
  environment: string,
  cellFilter?: string,
): { plans: CellPlan[]; paths: ReturnType<typeof resolveDomain>; resolvedTechnical: string } {
  const paths = resolveDomain(domain)
  const resolvedTechnical = writeResolvedTechnical(paths.files.technical, domain, environment, paths.root)
  const technical = JSON.parse(fs.readFileSync(resolvedTechnical, 'utf-8'))
  const cells = technical.cells ?? []

  const plans = cells
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
        outputDir: outputDirFor(cell.name, domain, paths.root, environment),
        technicalPath: resolvedTechnical,
      }
    })

  return { plans, paths, resolvedTechnical }
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
    emitError('Usage: cba develop <domain> [--env <environment>] [--cell <name>] [--dry-run]', opts)
    process.exit(1)
  }

  const cellFilter = flag(args, 'cell')
  const dryRun = boolFlag(args, 'dry-run')
  const envArg = flag(args, 'env')

  let plans: CellPlan[]
  let paths: ReturnType<typeof resolveDomain>
  let environment: string
  try {
    const paths0 = resolveDomain(domain)
    environment = resolveEnvironment(paths0, envArg)
    ;({ plans, paths } = planCells(domain, environment, cellFilter))
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
    emit({ domain, environment, dryRun: true, plans }, opts, () => {
      const lines = [`cba develop ${domain} --env ${environment} — dry run (${plans.length} cell(s))`]
      for (const p of plans) {
        lines.push(``, `  ${p.name}  (${p.adapter})`)
        lines.push(`    workspace : ${p.workspace}`)
        lines.push(`    output    : ${path.relative(process.cwd(), p.outputDir)}`)
      }
      return lines.join('\n')
    })
    return
  }

  // Materialize product.core.json before invoking any cell generators.
  // Cells read product core in place of operational DNA — it must be fresh.
  try {
    materializeAndSaveProductCore(paths)
    if (!json) console.log(`→ materialized ${path.relative(process.cwd(), paths.files['product.core'])}`)
  } catch (err) {
    emitError(`Failed to materialize product.core.json: ${(err as Error).message}`, opts)
    process.exit(1)
  }

  // Execute each cell's generator. CBA_DNA_BASE tells the generator where to
  // find referenced DNA files — the resolved technical.json we pass lives
  // under output/, so the generator's own `dna/` ancestor-walk wouldn't find
  // the source tree.
  const dnaRoot = findDnaRoot(paths.files.technical)
  const results: Array<{ cell: string; ok: boolean; code: number; error?: string }> = []
  for (const p of plans) {
    if (!json) console.log(`→ ${p.name} (${p.adapter}) → ${path.relative(process.cwd(), p.outputDir)}`)
    const cwd = workspaceDir(p.workspace)
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
        cwd,
        stdio: json ? 'pipe' : 'inherit',
        env: { ...process.env, CBA_DNA_BASE: dnaRoot },
      },
    )
    if (result.error) {
      // ENOENT on cwd is the most common shape — surface the cwd so the user
      // doesn't have to dig into source to see what path was attempted.
      const detail = (result.error as NodeJS.ErrnoException).code === 'ENOENT' ? ` (cwd: ${cwd})` : ''
      const message = `Failed to spawn cell generator for "${p.name}": ${result.error.message}${detail}`
      results.push({ cell: p.name, ok: false, code: 1, error: result.error.message })
      if (json) {
        emitError(message, opts, { results })
      } else {
        console.error(`✗ ${message}`)
      }
      process.exit(1)
    }
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

/**
 * Resolve the cell-based-architecture workspace root from cba's own install
 * location, not from the consumer's cwd. When cba is installed via a `file:`
 * dep, npm symlinks `consumer/node_modules/@dna-codes/cells → cba-workspace/packages/cba`;
 * `realpathSync` follows that link back to the actual workspace so the join
 * below points at real `packages/` and `technical/cells/` siblings.
 *
 * In-workspace behavior is identical: `realpathSync` is a no-op when the
 * package isn't reached through a symlink.
 */
function cbaWorkspaceRoot(): string {
  const pkgPath = require.resolve('@dna-codes/cells/package.json')
  const realPkgPath = fs.realpathSync(pkgPath)
  return path.resolve(path.dirname(realPkgPath), '..', '..')
}

/**
 * Workspace package name → relative directory path.
 *
 * After the `rebrand-to-cells-prefix` change, package names live under the
 * `@dna-codes/*` scope but on-disk directory names didn't change (the
 * proposal explicitly kept the workspace layout — only names moved).
 * That divergence means we can't derive the directory from the name with
 * a string transform; an explicit map is the simplest stable answer.
 */
const WORKSPACE_DIRS: Record<string, string> = {
  '@dna-codes/cells': 'packages/cba',
  '@dna-codes/cells-viz': 'packages/cba-viz',
  '@dna-codes/cells-api': 'technical/cells/api-cell',
  '@dna-codes/cells-ui': 'technical/cells/ui-cell',
  '@dna-codes/cells-db': 'technical/cells/db-cell',
}

function workspaceDir(workspace: string): string {
  const root = cbaWorkspaceRoot()
  const sub = WORKSPACE_DIRS[workspace]
  if (!sub) throw new Error(`Unknown cba workspace: ${workspace}`)
  return path.join(root, sub)
}

/**
 * Walk up from a source technical.json path to find the `dna/` ancestor
 * directory. Mirrors the logic in each cell generator's `findDnaBase`, but
 * runs against the source path (not the resolved one under output/), so
 * it's guaranteed to hit the real source tree.
 */
function findDnaRoot(sourceTechnicalPath: string): string {
  let dir = path.dirname(path.resolve(sourceTechnicalPath))
  const root = path.parse(dir).root
  while (dir !== root) {
    if (path.basename(dir) === 'dna') return dir
    dir = path.dirname(dir)
  }
  throw new Error(`No "dna" ancestor directory found for ${sourceTechnicalPath}`)
}
