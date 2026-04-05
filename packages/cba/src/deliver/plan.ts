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

export interface EnvironmentPlan {
  domain: string
  environment: string
  paths: DomainPaths
  constructs: ResolvedConstruct[]
  cells: ResolvedCell[]
  variables: ResolvedVariable[]
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
 * with at least a package.json). Returns a list of missing cells.
 */
export function checkArtifacts(plan: EnvironmentPlan): string[] {
  const missing: string[] = []
  for (const cell of plan.cells) {
    const pkgJson = path.join(cell.outputDir, 'package.json')
    if (!fs.existsSync(pkgJson)) {
      missing.push(cell.name)
    }
  }
  return missing
}
