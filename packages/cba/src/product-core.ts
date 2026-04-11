import * as fs from 'fs'
import { DomainPaths, loadLayer } from './context'

/**
 * Product Core materializer.
 *
 * Derives `product.core.json` from `operational.json` + the product surfaces
 * (`product.api.json`, `product.ui.json`). Product core is the self-contained
 * slice of operational DNA transitively referenced by the product layer — it
 * is the contract that downstream cells read INSTEAD of operational DNA.
 *
 * Product core is ALWAYS DERIVED, never hand-authored. Running this module
 * (via `cba product core materialize` or automatically during `cba develop`)
 * overwrites `product.core.json` with the current projection of operational
 * DNA.
 *
 * See `product/AGENTS.md` for the layer contract.
 */

export interface ProductCoreDNA {
  domain: { name: string; path: string; description?: string }
  nouns: any[]
  capabilities?: any[]
  causes?: any[]
  rules?: any[]
  outcomes?: any[]
  lifecycles?: any[]
  equations?: any[]
  signals?: any[]
  relationships?: any[]
}

/**
 * Materialize product.core.json from operational + surfaces.
 *
 * Algorithm:
 * 1. Flatten the operational domain tree into a flat list of Nouns
 * 2. Walk product.api (resources[].noun) and product.ui (pages[].resource → api.resources[].noun)
 *    to collect the set of referenced Noun names. If no surfaces reference anything, default
 *    to including every Noun in the domain.
 * 3. Expand the referenced set via Relationships (transitive closure — a Noun reachable
 *    from a referenced Noun via any relationship is included)
 * 4. Filter capabilities/causes/rules/outcomes/lifecycles/signals/relationships to the set
 *    that applies to the referenced Nouns
 * 5. Pick the deepest domain node that contains at least one referenced Noun as the
 *    core's `domain` field
 */
export function materializeProductCore(
  operational: any,
  api?: any,
  ui?: any,
): ProductCoreDNA {
  if (!operational?.domain) {
    throw new Error('materializeProductCore: operational.domain is required')
  }

  // 1. Flatten nouns from the domain tree — annotate each with its domain path
  const allNouns = flattenNouns(operational.domain)
  const nounByName = new Map<string, any>(allNouns.map((n) => [n.name, n]))

  // 2. Collect referenced Noun names from surfaces
  const referencedNouns = new Set<string>()

  // from product.api: resources[].noun
  for (const r of api?.resources ?? []) {
    if (r.noun) referencedNouns.add(r.noun)
  }

  // from product.ui: pages[].resource → api.resources[].name → .noun
  const resourceToNoun = new Map<string, string>()
  for (const r of api?.resources ?? []) {
    if (r.noun) resourceToNoun.set(r.name, r.noun)
  }
  for (const p of ui?.pages ?? []) {
    if (p.resource) {
      const noun = resourceToNoun.get(p.resource)
      if (noun) referencedNouns.add(noun)
    }
  }

  // Fallback: if nothing referenced (surfaces empty or missing), include every noun
  if (referencedNouns.size === 0) {
    for (const n of allNouns) referencedNouns.add(n.name)
  }

  // 3. Transitive closure via Relationships
  const relationships = operational.relationships ?? []
  let grew = true
  while (grew) {
    grew = false
    for (const rel of relationships) {
      if (referencedNouns.has(rel.from) && !referencedNouns.has(rel.to)) {
        referencedNouns.add(rel.to)
        grew = true
      }
      if (referencedNouns.has(rel.to) && !referencedNouns.has(rel.from)) {
        referencedNouns.add(rel.from)
        grew = true
      }
    }
  }

  // 4. Build the filtered primitive arrays
  const nouns = [...referencedNouns]
    .map((n) => nounByName.get(n))
    .filter((n): n is any => !!n)

  const capabilities = (operational.capabilities ?? []).filter((c: any) =>
    referencedNouns.has(c.noun),
  )
  const capabilityNames = new Set<string>(capabilities.map((c: any) => c.name))

  const causes = (operational.causes ?? []).filter((c: any) =>
    capabilityNames.has(c.capability),
  )
  const rules = (operational.rules ?? []).filter((r: any) =>
    capabilityNames.has(r.capability),
  )
  const outcomes = (operational.outcomes ?? []).filter((o: any) =>
    capabilityNames.has(o.capability),
  )
  const lifecycles = (operational.lifecycles ?? []).filter((l: any) =>
    referencedNouns.has(l.noun),
  )

  // Equations are technology-agnostic named computations — include the full set.
  // The cells can decide whether they need them.
  const equations = operational.equations ?? []

  // Signals: include any emitted by surfaced outcomes, subscribed by surfaced causes,
  // or whose capability is in the surfaced set.
  const emittedSignals = new Set<string>()
  for (const o of outcomes) {
    for (const s of o.emits ?? []) emittedSignals.add(s)
  }
  const subscribedSignals = new Set<string>()
  for (const c of causes) {
    if (c.source === 'signal' && c.signal) subscribedSignals.add(c.signal)
  }
  const signals = (operational.signals ?? []).filter(
    (s: any) =>
      emittedSignals.has(s.name) ||
      subscribedSignals.has(s.name) ||
      capabilityNames.has(s.capability),
  )

  const rels = (operational.relationships ?? []).filter(
    (r: any) => referencedNouns.has(r.from) && referencedNouns.has(r.to),
  )

  // 5. Pick the domain node for `core.domain`
  const domainInfo = pickDomain(operational.domain, nouns)

  const core: ProductCoreDNA = {
    domain: domainInfo,
    nouns,
  }
  if (capabilities.length) core.capabilities = capabilities
  if (causes.length) core.causes = causes
  if (rules.length) core.rules = rules
  if (outcomes.length) core.outcomes = outcomes
  if (lifecycles.length) core.lifecycles = lifecycles
  if (equations.length) core.equations = equations
  if (signals.length) core.signals = signals
  if (rels.length) core.relationships = rels

  return core
}

function flattenNouns(domain: any): any[] {
  const out: any[] = []
  const walk = (d: any): void => {
    const dpath = d.path || d.name
    for (const n of d.nouns ?? []) {
      // Spread so we don't mutate the source; keep the Noun's own `domain`
      // field if present, otherwise inject the containing domain path.
      out.push({ ...n, domain: n.domain ?? dpath })
    }
    for (const sub of d.domains ?? []) walk(sub)
  }
  walk(domain)
  return out
}

/**
 * Pick the deepest domain node that contains at least one referenced Noun.
 * For single-domain platforms, this is the leaf domain the Nouns live under.
 * For multi-domain platforms (Phase 6+), this picks the deepest single node
 * — cross-domain handling is tracked separately.
 */
function pickDomain(
  root: any,
  referencedNouns: any[],
): { name: string; path: string; description?: string } {
  const nounDomains = new Set<string>(
    referencedNouns
      .map((n) => n.domain)
      .filter((d): d is string => typeof d === 'string'),
  )

  let best: any = root
  let bestDepth = (root.path || root.name || '').split('.').length

  const walk = (d: any): void => {
    const dpath = d.path || d.name || ''
    const depth = dpath.split('.').length
    if (nounDomains.has(dpath) && depth >= bestDepth) {
      best = d
      bestDepth = depth
    }
    for (const sub of d.domains ?? []) walk(sub)
  }
  walk(root)

  const out: { name: string; path: string; description?: string } = {
    name: best.name,
    path: best.path || best.name,
  }
  if (best.description) out.description = best.description
  return out
}

/**
 * Read operational.json + optional product surfaces from a domain, materialize
 * product.core.json, and write it to the domain directory. Returns the materialized
 * core document.
 *
 * If operational.json is missing, throws. If product surfaces are missing, the
 * materializer falls back to including every Noun in the domain.
 */
export function materializeAndSaveProductCore(paths: DomainPaths): ProductCoreDNA {
  const operational = loadLayer(paths, 'operational')

  let api: any | undefined
  let ui: any | undefined
  try {
    if (fs.existsSync(paths.files['product.api'])) {
      api = loadLayer(paths, 'product.api')
    }
  } catch {
    /* optional */
  }
  try {
    if (fs.existsSync(paths.files['product.ui'])) {
      ui = loadLayer(paths, 'product.ui')
    }
  } catch {
    /* optional */
  }

  const core = materializeProductCore(operational, api, ui)
  fs.writeFileSync(
    paths.files['product.core'],
    JSON.stringify(core, null, 2) + '\n',
    'utf-8',
  )
  return core
}

