import * as fs from 'fs'
import * as path from 'path'
import { resolveDomain, loadLayer, DomainPaths } from '../context'

export interface ResolvedConstruct {
  name: string
  category: string
  type: string
  provider: string
  config?: Record<string, any>
  environment?: string
  description?: string
}

export interface ResolvedVariable {
  name: string
  source: 'literal' | 'secret' | 'env' | 'output'
  value?: string
  required?: boolean
  environment?: string
}

export interface ResolvedCell {
  name: string
  description?: string
  adapterType: string
  adapterConfig?: Record<string, any>
  constructs: string[]
  variables: ResolvedVariable[]
  outputs: Array<{ name: string; cell: string; value: string }>
  outputDir: string
}

export interface ResolvedProvider {
  name: string
  type: string
  region?: string
  description?: string
  config?: Record<string, any>
}

export interface ResolvedScript {
  name: string
  equation: string
  construct: string
  runtime: string
  handler: string
  environment?: string
}

export interface EnvironmentPlan {
  domain: string
  environment: string
  paths: DomainPaths
  constructs: ResolvedConstruct[]
  cells: ResolvedCell[]
  variables: ResolvedVariable[]
  providers: ResolvedProvider[]
  scripts: ResolvedScript[]
  deployDir: string
}

/**
 * Build a delivery plan for a given domain + environment.
 *
 * Environment overlay rule: entries with matching `environment` field override
 * entries with no `environment` field (the default). This applies to Constructs
 * and Variables. Cells have no environment field — they always apply.
 */
export function buildPlan(domain: string, environment: string): EnvironmentPlan {
  const paths = resolveDomain(domain)
  const technical = loadLayer(paths, 'technical')

  // Validate environment exists
  const envs = (technical.environments ?? []) as Array<{ name: string }>
  if (!envs.some((e) => e.name === environment)) {
    const names = envs.map((e) => e.name).join(', ') || '(none)'
    throw new Error(
      `Environment "${environment}" not declared in technical DNA. Available: ${names}`,
    )
  }

  return {
    domain,
    environment,
    paths,
    constructs: overlayByName(technical.constructs ?? [], environment),
    variables: overlayByName(technical.variables ?? [], environment),
    cells: (technical.cells ?? []).map((c: any) => resolveCell(c, domain, paths.root, environment)),
    providers: (technical.providers ?? []).map((p: any) => ({
      name: p.name,
      type: p.type,
      region: p.region,
      description: p.description,
      config: p.config,
    })),
    scripts: overlayByName(technical.scripts ?? [], environment),
    deployDir: path.join(paths.root, 'output', `${domain}-deploy`),
  }
}

/**
 * Overlay logic: for each distinct `name`, prefer the entry whose
 * `environment` matches the target env; fall back to the entry with no
 * `environment` field.
 */
function overlayByName<T extends { name: string; environment?: string }>(
  items: T[],
  environment: string,
): T[] {
  const byName = new Map<string, T>()
  for (const item of items) {
    if (item.environment && item.environment !== environment) continue
    const existing = byName.get(item.name)
    // env-specific wins over default
    if (!existing || (item.environment && !existing.environment)) {
      byName.set(item.name, item)
    }
  }
  return Array.from(byName.values())
}

function resolveCell(cell: any, domain: string, root: string, environment: string): ResolvedCell {
  const suffix = cell.name.replace(/-cell/g, '').replace(/^-|-$/g, '')
  const outputDir = path.join(root, 'output', `${domain}-${suffix}`)
  return {
    name: cell.name,
    description: cell.description,
    adapterType: cell.adapter.type,
    adapterConfig: cell.adapter.config,
    constructs: cell.constructs ?? [],
    variables: overlayByName(cell.variables ?? [], environment),
    outputs: cell.outputs ?? [],
    outputDir,
  }
}

/**
 * Verify that every cell in the plan has been developed (output dir exists
 * with a canonical artifact). Returns a list of missing cells.
 *
 * Canonical artifact per adapter family:
 *   node/*, vite/*, next/*  → package.json (node project)
 *   postgres                 → docker-compose.yml (infra-only, no node deps)
 */
export function checkArtifacts(plan: EnvironmentPlan): string[] {
  const missing: string[] = []
  for (const cell of plan.cells) {
    const marker = canonicalArtifactFor(cell.adapterType)
    if (!fs.existsSync(path.join(cell.outputDir, marker))) {
      missing.push(cell.name)
    }
  }
  return missing
}

/**
 * Look up a named profile from the technical DNA's `profiles` map.
 * Returns the cell name list, or null if the profile doesn't exist.
 */
export function resolveProfile(domain: string, profileName: string): string[] | null {
  const paths = resolveDomain(domain)
  const technical = loadLayer(paths, 'technical')
  const profiles = technical.profiles as Record<string, string[]> | undefined
  if (!profiles || !(profileName in profiles)) return null
  return profiles[profileName]
}

function canonicalArtifactFor(adapterType: string): string {
  if (adapterType === 'postgres') return 'docker-compose.yml'
  if (adapterType.startsWith('ruby/')) return 'Gemfile'
  if (adapterType.startsWith('python/')) return 'requirements.txt'
  return 'package.json'
}
