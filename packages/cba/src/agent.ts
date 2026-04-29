/**
 * cba agent — find and describe the AGENTS.md contract for a given concern.
 *
 * Each concern boundary in the repo (operational layer, product layer, each
 * cell, each domain demo) has an AGENTS.md file that defines the prompt-level
 * contract for a sub-agent that owns that scope. This command resolves those
 * contracts so an orchestrating agent (Claude Code, etc.) can load the right
 * prompt and dispatch the right subagent type.
 *
 * Usage:
 *   cba agent list                     # list every AGENTS.md in the repo
 *   cba agent <name-or-path>           # show the contract for a concern
 *   cba agent dna-core                 # shorthand for @dna-codes/dna-core's AGENTS.md (dispatcher)
 *   cba agent operational              # shorthand for @dna-codes/dna-core/docs/operational.md
 *   cba agent api-cell                 # shorthand for technical/cells/api-cell/AGENTS.md
 *   cba agent dna                      # shorthand for dna/AGENTS.md (DNA generator meta-agent)
 *
 * This command does NOT spawn a sub-agent itself — spawning is the caller's
 * responsibility (Claude Code's Agent tool, etc.). It just resolves the
 * contract file so the caller knows what to load and what subagent_type to use.
 */
import * as fs from 'fs'
import * as path from 'path'
import { ParsedArgs, boolFlag } from './args'
import { emit, emitError, emitOk } from './output'
import { findRepoRoot } from './context'
import { AGENT_HELP } from './help'

/**
 * The three DNA layer docs (operational, product, technical) live inside the
 * @dna-codes/dna-core package. This resolver points lookups at the installed
 * package so agent-mode resolution still works.
 */
const DNA_CORE_ROOT = path.dirname(require.resolve('@dna-codes/dna-core/package.json'))
const DNA_DOCS_ROOT = path.join(DNA_CORE_ROOT, 'docs')
const DNA_CORE_AGENTS = path.join(DNA_CORE_ROOT, 'AGENTS.md')
const DNA_LAYERS = ['operational', 'product', 'technical'] as const
type DnaLayer = (typeof DNA_LAYERS)[number]

function dnaLayerDoc(layer: DnaLayer): string {
  return path.join(DNA_DOCS_ROOT, `${layer}.md`)
}

interface AgentContract {
  concern: string
  file: string
  title: string
  content: string
}

export function runAgent(argv: string[], args: ParsedArgs): void {
  const opts = { json: boolFlag(args, 'json') }

  if (boolFlag(args, 'help')) {
    console.log(AGENT_HELP)
    return
  }

  const [sub, ...rest] = argv

  if (!sub || sub === 'list') {
    runList(opts)
    return
  }

  runShow(sub, rest, opts)
}

/**
 * `cba agent list` — walk the repo and find every AGENTS.md file.
 * Returns them in layer order (operational → product → technical → cells → dna).
 */
function runList(opts: { json: boolean }): void {
  const root = findRepoRoot()
  const contracts = findAllAgentsFiles(root)

  emit(
    { contracts: contracts.map(({ file, concern, title }) => ({ concern, title, file })) },
    opts,
    () => {
      if (!contracts.length) return '(no AGENTS.md files found)'
      const lines = ['AGENTS.md contracts found:', '']
      for (const c of contracts) {
        const rel = path.relative(root, c.file)
        lines.push(`  ${c.concern.padEnd(28)} ${rel}`)
      }
      lines.push('')
      lines.push('Use "cba agent <concern>" to view a contract.')
      return lines.join('\n')
    },
  )
}

/**
 * `cba agent <name-or-path>` — resolve a name or path to an AGENTS.md file
 * and print its contents. Shorthand names are resolved against the layer/cell
 * directory conventions.
 */
function runShow(nameOrPath: string, _rest: string[], opts: { json: boolean }): void {
  const root = findRepoRoot()
  const resolved = resolveAgentFile(nameOrPath, root)

  if (!resolved) {
    const known = findAllAgentsFiles(root)
      .map((c) => c.concern)
      .join(', ')
    emitError(
      `No AGENTS.md found for "${nameOrPath}". Known concerns: ${known}`,
      opts,
    )
    process.exit(1)
  }

  const content = fs.readFileSync(resolved.file, 'utf-8')
  const title = extractTitle(content) ?? resolved.concern

  const contract: AgentContract = {
    concern: resolved.concern,
    file: resolved.file,
    title,
    content,
  }

  emitOk(
    {
      concern: contract.concern,
      file: path.relative(root, contract.file),
      title: contract.title,
      content: contract.content,
    },
    opts,
    () => {
      return [
        `AGENTS.md: ${contract.concern}`,
        `  file:  ${path.relative(root, contract.file)}`,
        `  title: ${contract.title}`,
        '',
        contract.content,
      ].join('\n')
    },
  )
}

// ── Resolution ───────────────────────────────────────────────────────────────

/**
 * Resolve a name or path to an AGENTS.md file.
 * Shorthand names map to the conventional directory layout:
 *
 *   operational                    → operational/AGENTS.md
 *   product                        → product/AGENTS.md
 *   technical                      → technical/AGENTS.md
 *   dna                            → dna/AGENTS.md (DNA generator meta-agent)
 *   api-cell|ui-cell|db-cell        → technical/cells/<name>/AGENTS.md
 *   any absolute or relative path to an AGENTS.md file
 */
function resolveAgentFile(
  nameOrPath: string,
  root: string,
): { concern: string; file: string } | undefined {
  // Explicit path to an AGENTS.md file
  if (nameOrPath.endsWith('AGENTS.md') || nameOrPath.includes('/')) {
    const asAbs = path.isAbsolute(nameOrPath)
      ? nameOrPath
      : path.join(root, nameOrPath)
    if (fs.existsSync(asAbs) && fs.statSync(asAbs).isFile()) {
      return { concern: concernFor(asAbs, root), file: asAbs }
    }
    // Try appending /AGENTS.md if they passed a directory-shaped path
    const asDirFile = path.join(asAbs, 'AGENTS.md')
    if (fs.existsSync(asDirFile)) {
      return { concern: concernFor(asDirFile, root), file: asDirFile }
    }
  }

  // DNA layer docs — shipped inside @dna-codes/dna-core
  if ((DNA_LAYERS as readonly string[]).includes(nameOrPath)) {
    const f = dnaLayerDoc(nameOrPath as DnaLayer)
    if (fs.existsSync(f)) return { concern: nameOrPath, file: f }
  }

  // @dna-codes/dna-core package-level contract (dispatcher across the three layers)
  if (nameOrPath === 'dna-core' || nameOrPath === '@dna-codes/dna-core') {
    if (fs.existsSync(DNA_CORE_AGENTS)) return { concern: 'dna-core', file: DNA_CORE_AGENTS }
  }

  // Short name resolution
  const candidates = [
    path.join(root, nameOrPath, 'AGENTS.md'),
    path.join(root, 'technical/cells', nameOrPath, 'AGENTS.md'),
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return { concern: concernFor(candidate, root), file: candidate }
    }
  }

  return undefined
}

/**
 * Derive a human-readable concern name from the path of an AGENTS.md file.
 * Used for listing and error messages.
 */
function concernFor(file: string, root: string): string {
  // @dna-codes/dna-core package-level contract
  if (file === DNA_CORE_AGENTS) return 'dna-core'
  // DNA layer docs shipped inside @dna-codes/dna-core
  if (file.startsWith(DNA_DOCS_ROOT + path.sep)) {
    const base = path.basename(file, '.md')
    if ((DNA_LAYERS as readonly string[]).includes(base)) return base
  }
  const rel = path.relative(root, file).replace(/\\/g, '/')
  if (rel === 'dna/AGENTS.md') return 'dna'
  const cellMatch = rel.match(/^technical\/cells\/([^/]+)\/AGENTS\.md$/)
  if (cellMatch) return `cell:${cellMatch[1]}`
  return rel.replace(/\/AGENTS\.md$/, '')
}

/**
 * Walk the known concern directories and collect every AGENTS.md file in
 * a stable order: operational → product → technical → technical/cells → dna.
 */
function findAllAgentsFiles(root: string): AgentContract[] {
  const candidates: string[] = []

  // @dna-codes/dna-core package-level contract — listed before the per-layer docs so
  // a reader scanning top-down gets the dispatcher first.
  if (fs.existsSync(DNA_CORE_AGENTS)) candidates.push(DNA_CORE_AGENTS)

  // Layer-level — shipped inside @dna-codes/dna-core
  for (const layer of DNA_LAYERS) {
    const f = dnaLayerDoc(layer)
    if (fs.existsSync(f)) candidates.push(f)
  }

  // Cell-level
  const cellsDir = path.join(root, 'technical/cells')
  if (fs.existsSync(cellsDir)) {
    for (const entry of fs.readdirSync(cellsDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory()) continue
      const f = path.join(cellsDir, entry.name, 'AGENTS.md')
      if (fs.existsSync(f)) candidates.push(f)
    }
  }

  // DNA directory — just the top-level contract. Per-domain AGENTS.md files
  // are not supported; dna/AGENTS.md is a meta-agent that orchestrates DNA
  // generation for any domain under dna/.
  const dnaAgents = path.join(root, 'dna/AGENTS.md')
  if (fs.existsSync(dnaAgents)) candidates.push(dnaAgents)

  return candidates.map((file) => {
    const content = fs.readFileSync(file, 'utf-8')
    return {
      concern: concernFor(file, root),
      file,
      title: extractTitle(content) ?? concernFor(file, root),
      content: '',
    }
  })
}

function extractTitle(content: string): string | undefined {
  const h1 = content.match(/^#\s+(.+)$/m)
  return h1?.[1]?.trim()
}
