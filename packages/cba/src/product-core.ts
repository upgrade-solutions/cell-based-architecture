import * as fs from 'fs'
import { DomainPaths, loadLayer } from './context'

/**
 * Product Core materializer.
 *
 * Derives `product.core.json` from `operational.json` + the product surfaces
 * (`product.api.json`, `product.ui.json`). Product Core is the self-contained
 * slice of operational DNA transitively referenced by the product layer — it
 * is the contract that downstream cells read INSTEAD of operational DNA.
 *
 * Product Core is ALWAYS DERIVED, never hand-authored. Running this module
 * (via `cba product core materialize` or automatically during `cba develop`)
 * overwrites `product.core.json` with the current projection.
 *
 * The shape of Product Core matches `@dna-codes/dna-core`'s ProductCoreDNA:
 *   { domain, resources?, operations?, triggers?, relationships? }
 *
 * The earlier model (capabilities, outcomes, signals, equations, lifecycles)
 * is gone — operations subsume capabilities, operation.changes[] subsumes
 * outcomes, and signals/lifecycles/equations were removed from the canonical
 * DNA model.
 */

export interface ProductCoreDNA {
  domain: { name: string; path: string; description?: string }
  resources?: any[]
  operations?: any[]
  triggers?: any[]
  rules?: any[]
  relationships?: any[]
}

/**
 * Materialize product.core.json from operational + surfaces.
 *
 * Algorithm:
 * 1. Flatten the operational domain tree into a flat list of Resources
 *    (annotating each with the domain path it lives under).
 * 2. Walk product.api (resources[].resource) and product.ui (pages[].resource
 *    → api.resources[].resource) to collect surfaced Resource names. Default
 *    to all resources if no surfaces reference anything.
 * 3. Expand the surfaced set via Relationships — a Resource reachable from a
 *    surfaced Resource via any Relationship is included (transitive closure).
 * 4. Filter Operations to those whose `target` is a surfaced Resource.
 * 5. Filter Triggers to those that fire surfaced Operations or Processes
 *    that operate on surfaced Resources.
 * 6. Filter Relationships to ones whose endpoints are both surfaced.
 * 7. Pick the deepest single domain node that contains at least one
 *    surfaced Resource as the core's `domain` field.
 */
export function materializeProductCore(
  operational: any,
  api?: any,
  ui?: any,
): ProductCoreDNA {
  if (!operational?.domain) {
    throw new Error('materializeProductCore: operational.domain is required')
  }

  // 1. Flatten resources from the domain tree, annotating each with its domain path
  const allResources = flattenResources(operational.domain)
  const resourceByName = new Map<string, any>(allResources.map((r) => [r.name, r]))

  // 2. Collect surfaced Resource names from product surfaces
  const surfaced = new Set<string>()

  for (const r of api?.resources ?? []) {
    if (r.resource) surfaced.add(r.resource)
  }

  // product.ui pages reference Product API resource names; resolve through to operational
  const apiResourceToOpResource = new Map<string, string>()
  for (const r of api?.resources ?? []) {
    if (r.resource) apiResourceToOpResource.set(r.name, r.resource)
  }
  for (const p of ui?.pages ?? []) {
    if (p.resource) {
      const opResource = apiResourceToOpResource.get(p.resource)
      if (opResource) surfaced.add(opResource)
    }
  }

  // Fallback: if no surface references anything, surface every Resource
  if (surfaced.size === 0) {
    for (const r of allResources) surfaced.add(r.name)
  }

  // 3. Transitive closure via Relationships
  const relationships = operational.relationships ?? []
  let grew = true
  while (grew) {
    grew = false
    for (const rel of relationships) {
      if (surfaced.has(rel.from) && !surfaced.has(rel.to) && resourceByName.has(rel.to)) {
        surfaced.add(rel.to)
        grew = true
      }
      if (surfaced.has(rel.to) && !surfaced.has(rel.from) && resourceByName.has(rel.from)) {
        surfaced.add(rel.from)
        grew = true
      }
    }
  }

  // 4. Build the surfaced Resource list (preserve operational.json declaration order)
  const resources = allResources.filter((r) => surfaced.has(r.name))

  // 5. Filter Operations to those targeting a surfaced Resource. Product
  //    Core Operations require a `resource` field (the target as a Resource);
  //    rewrite operational `target` → `resource` while preserving the rest.
  const operations = (operational.operations ?? [])
    .filter((op: any) => surfaced.has(op.target))
    .map((op: any) => {
      const projected: any = { ...op, resource: op.target }
      delete projected.target
      return projected
    })
  const operationNames = new Set<string>(operations.map((op: any) => op.name))

  // 6a. Filter Rules to those constraining surfaced Operations
  const rules = (operational.rules ?? []).filter((r: any) => operationNames.has(r.operation))

  // 6. Filter Triggers to those firing surfaced Operations / surfaced Processes
  const surfacedProcessNames = new Set<string>()
  for (const proc of operational.processes ?? []) {
    // A Process is surfaced if any of its tasks bind to a surfaced Operation
    const taskNames = new Set<string>((proc.steps ?? []).map((s: any) => s.task))
    for (const task of operational.tasks ?? []) {
      if (taskNames.has(task.name) && operationNames.has(task.operation)) {
        surfacedProcessNames.add(proc.name)
        break
      }
    }
  }
  const triggers = (operational.triggers ?? []).filter(
    (t: any) =>
      (t.operation && operationNames.has(t.operation)) ||
      (t.process && surfacedProcessNames.has(t.process)),
  )

  // 7. Filter Relationships to ones with both endpoints surfaced
  const rels = relationships.filter((r: any) => surfaced.has(r.from) && surfaced.has(r.to))

  // 8. Pick the domain node for `core.domain`
  const domainInfo = pickDomain(operational.domain, resources)

  const core: ProductCoreDNA = { domain: domainInfo }
  if (resources.length) core.resources = resources
  if (operations.length) core.operations = operations
  if (triggers.length) core.triggers = triggers
  if (rules.length) core.rules = rules
  if (rels.length) core.relationships = rels

  return core
}

function flattenResources(domain: any): any[] {
  const out: any[] = []
  const walk = (d: any): void => {
    const dpath = d.path || d.name
    for (const r of d.resources ?? []) {
      // Spread so we don't mutate the source. The `domain` annotation is for
      // the materializer's own use — strip it before writing product.core
      // so the output stays clean.
      out.push({ ...r, _domain: r._domain ?? dpath })
    }
    for (const sub of d.domains ?? []) walk(sub)
  }
  walk(domain)
  return out.map(({ _domain, ...rest }) => rest)
}

/**
 * Pick the deepest domain node that contains at least one surfaced Resource.
 * For single-domain platforms, this is the leaf domain the Resources live under.
 */
function pickDomain(
  root: any,
  surfaced: any[],
): { name: string; path: string; description?: string } {
  // Re-scan the tree for surfaced names so we know which domains contain them
  const surfacedNames = new Set<string>(surfaced.map((r) => r.name))
  const domainsContainingSurfaced = new Set<string>()
  const walk = (d: any): void => {
    const dpath = d.path || d.name || ''
    for (const r of d.resources ?? []) {
      if (surfacedNames.has(r.name)) domainsContainingSurfaced.add(dpath)
    }
    for (const sub of d.domains ?? []) walk(sub)
  }
  walk(root)

  let best: any = root
  let bestDepth = (root.path || root.name || '').split('.').length
  const visit = (d: any): void => {
    const dpath = d.path || d.name || ''
    const depth = dpath.split('.').length
    if (domainsContainingSurfaced.has(dpath) && depth >= bestDepth) {
      best = d
      bestDepth = depth
    }
    for (const sub of d.domains ?? []) visit(sub)
  }
  visit(root)

  const out: { name: string; path: string; description?: string } = {
    name: best.name,
    path: best.path || best.name,
  }
  if (best.description) out.description = best.description
  return out
}

/**
 * Read operational.json + optional product surfaces from a domain, materialize
 * product.core.json, and write it to the domain directory.
 */
export function materializeAndSaveProductCore(paths: DomainPaths): ProductCoreDNA {
  const operational = loadLayer(paths, 'operational')

  let api: any | undefined
  let ui: any | undefined
  try { if (fs.existsSync(paths.files['product.api'])) api = loadLayer(paths, 'product.api') } catch { /* optional */ }
  try { if (fs.existsSync(paths.files['product.ui'])) ui = loadLayer(paths, 'product.ui') } catch { /* optional */ }

  const core = materializeProductCore(operational, api, ui)
  fs.writeFileSync(
    paths.files['product.core'],
    JSON.stringify(core, null, 2) + '\n',
    'utf-8',
  )
  return core
}
