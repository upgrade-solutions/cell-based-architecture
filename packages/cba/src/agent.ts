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
 *   cba agent operational              # shorthand for operational/AGENTS.md
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
 *   api-cell|ui-cell|db-cell|event-bus-cell
 *                                  → technical/cells/<name>/AGENTS.md
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
  const rel = path.relative(root, file).replace(/\\/g, '/')
  if (rel === 'operational/AGENTS.md') return 'operational'
  if (rel === 'product/AGENTS.md') return 'product'
  if (rel === 'technical/AGENTS.md') return 'technical'
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

  // Layer-level
  for (const layer of ['operational', 'product', 'technical']) {
    const f = path.join(root, layer, 'AGENTS.md')
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
