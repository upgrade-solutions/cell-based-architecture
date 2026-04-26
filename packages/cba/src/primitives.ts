import * as fs from 'fs'
import * as path from 'path'
import { Layer } from './context'

/**
 * Catalog of primitive types per layer + where they live in the layer document.
 *
 * Primitive *names* and *shapes* come from the @dna-codes/schemas package — we
 * don't hardcode the list of valid types. The schema files in
 * @dna-codes/schemas/{operational,product/{core,api,web},technical}/*.json
 * define what's valid; we walk those directories at module-load time to
 * discover the type set.
 *
 * What CBA *does* know is the **location** of each primitive inside its layer
 * document — that's a CBA convention, not a schema concern. The LOCATIONS map
 * encodes that convention; everything else is schema-derived.
 */

export interface PrimitiveSpec {
  type: string
  layer: Layer
  /** dotted path inside the layer document, or `domain.*.<plural>` / `views.*.<plural>` for tree-walked primitives */
  location: string
  nested?: boolean
  /** Singletons return without a `name` lookup (Namespace, Layout) */
  singleton?: boolean
  /** Children of a noun (operational actions/attributes); CBA collects these via parent-aware walks */
  childOf?: 'noun' | 'resource' | 'page'
}

/** Resolve the on-disk schemas directory bundled with @dna-codes/schemas. */
function schemasRoot(): string {
  return path.dirname(require.resolve('@dna-codes/schemas/package.json'))
}

/** Read the title-case display name from a JSON Schema file. */
function readSchemaTitle(file: string): string | null {
  try {
    const doc = JSON.parse(fs.readFileSync(file, 'utf-8'))
    if (typeof doc.title === 'string' && doc.title.length > 0) return doc.title
  } catch {
    /* fall through */
  }
  return null
}

/** Title-case a kebab/snake/lower identifier ("event-bus" → "EventBus"). */
function titleCase(name: string): string {
  return name
    .split(/[-_]/)
    .map((seg) => (seg.length === 0 ? seg : seg[0].toUpperCase() + seg.slice(1)))
    .join('')
}

/** Build a Primitive type name from a schema file basename. Prefers the schema's `title` field. */
function typeNameFor(schemaFile: string): string {
  const title = readSchemaTitle(schemaFile)
  if (title) return title
  return titleCase(path.basename(schemaFile, '.json'))
}

/**
 * CBA-convention map of primitive type → document location. Keys are
 * `<layer-segment>/<schema-basename>` matching the `@dna-codes/schemas`
 * directory layout. Schemas not listed here are treated as "child" shapes
 * (e.g. operational/action, operational/attribute) and surfaced via their
 * parent's primitive walk.
 */
const LOCATIONS: Record<string, Omit<PrimitiveSpec, 'type' | 'layer'>> = {
  // ── operational ───────────────────────────────────────────────────────
  // Domain tree (the four "noun" primitives + the tree itself)
  'operational/domain':       { location: 'domain', nested: true },
  'operational/resource':     { location: 'domain.*.resources', nested: true },
  'operational/person':       { location: 'domain.*.persons', nested: true },
  'operational/role':         { location: 'domain.*.roles', nested: true },
  'operational/group':        { location: 'domain.*.groups', nested: true },
  // Children of any noun primitive — collected during tree walk
  'operational/action':       { location: 'domain.*.<noun>.*.actions', nested: true, childOf: 'noun' },
  'operational/attribute':    { location: 'domain.*.<noun>.*.attributes', nested: true, childOf: 'noun' },
  // Top-level operational arrays
  'operational/membership':   { location: 'memberships' },
  'operational/operation':    { location: 'operations' },
  'operational/trigger':      { location: 'triggers' },
  'operational/rule':         { location: 'rules' },
  'operational/task':         { location: 'tasks' },
  'operational/process':      { location: 'processes' },
  'operational/relationship': { location: 'relationships' },

  // ── product/core ──────────────────────────────────────────────────────
  'product/core/resource':  { location: 'resources' },
  'product/core/operation': { location: 'operations' },
  'product/core/action':    { location: 'resources.*.actions', nested: true, childOf: 'resource' },
  'product/core/field':     { location: 'resources.*.fields', nested: true, childOf: 'resource' },

  // ── product/api ───────────────────────────────────────────────────────
  'product/api/namespace': { location: 'namespace', singleton: true },
  'product/api/endpoint':  { location: 'endpoints' },
  'product/api/param':     { location: 'params' },
  'product/api/schema':    { location: 'schemas' },

  // ── product/web ───────────────────────────────────────────────────────
  'product/web/layout': { location: 'layout', singleton: true },
  'product/web/page':   { location: 'pages' },
  'product/web/route':  { location: 'routes' },
  'product/web/block':  { location: 'pages.*.blocks', nested: true, childOf: 'page' },

  // ── technical ─────────────────────────────────────────────────────────
  'technical/environment': { location: 'environments' },
  'technical/provider':    { location: 'providers' },
  'technical/construct':   { location: 'constructs' },
  'technical/variable':    { location: 'variables' },
  'technical/cell':        { location: 'cells' },
  'technical/output':      { location: 'outputs' },
  'technical/view':        { location: 'views' },
  'technical/node':        { location: 'views.*.nodes', nested: true },
  'technical/connection':  { location: 'views.*.connections', nested: true },
  'technical/zone':        { location: 'views.*.zones', nested: true },
}

/** Map @dna-codes layer-segment → CBA Layer token. */
const LAYER_BY_SEGMENT: Record<string, Layer> = {
  operational: 'operational',
  'product/core': 'product.core',
  'product/api': 'product.api',
  'product/web': 'product.ui',
  technical: 'technical',
}

/** Layer segments to walk (matches the @dna-codes/schemas directory tree). */
const LAYER_SEGMENTS = ['operational', 'product/core', 'product/api', 'product/web', 'technical'] as const

/**
 * Walk the @dna-codes/schemas directory tree and build the canonical primitive
 * catalog. Each primitive's type name comes from its schema's `title` field;
 * its location comes from the LOCATIONS convention map.
 *
 * Schemas matching a layer's "envelope" file (e.g. `operational/operational.json`,
 * `product/product.api.json`) are skipped — those validate the whole document,
 * not a single primitive.
 */
function buildPrimitives(): PrimitiveSpec[] {
  const root = schemasRoot()
  const out: PrimitiveSpec[] = []
  for (const segment of LAYER_SEGMENTS) {
    const dir = path.join(root, segment)
    if (!fs.existsSync(dir)) continue
    const layer = LAYER_BY_SEGMENT[segment]
    for (const file of fs.readdirSync(dir).sort()) {
      if (!file.endsWith('.json')) continue
      const base = path.basename(file, '.json')
      // Skip the layer-envelope schemas (e.g. operational.json validates a whole doc)
      if (base === segment.split('/').pop() || base === 'operational' || base === 'technical' || base.startsWith('product.')) {
        continue
      }
      const key = `${segment}/${base}`
      const loc = LOCATIONS[key]
      if (!loc) continue
      out.push({
        type: typeNameFor(path.join(dir, file)),
        layer,
        ...loc,
      })
    }
  }
  return out
}

/** Module-load: build once. Re-exported for callers that just want to enumerate. */
export const PRIMITIVES: PrimitiveSpec[] = buildPrimitives()

export function primitivesForLayer(layer: Layer): PrimitiveSpec[] {
  return PRIMITIVES.filter((p) => p.layer === layer)
}

export function findPrimitiveSpec(layer: Layer, type: string): PrimitiveSpec | undefined {
  return PRIMITIVES.find((p) => p.layer === layer && p.type.toLowerCase() === type.toLowerCase())
}

/** Walk the operational domain tree, yielding each domain node with its dotted path. */
export function walkDomains(domain: any, visit: (node: any, path: string) => void): void {
  if (!domain) return
  visit(domain, domain.path || domain.name)
  for (const child of domain.domains ?? []) {
    walkDomains(child, visit)
  }
}

/**
 * The four operational "noun" primitives — Resource, Person, Role, Group —
 * share a common shape (name, attributes[], actions[], parent?) and live
 * inside the domain tree. CBA needs to walk all four when surfacing
 * Action/Attribute children regardless of which kind of noun owns them.
 */
const NOUN_KINDS: Array<{ key: string; label: string }> = [
  { key: 'resources', label: 'Resource' },
  { key: 'persons', label: 'Person' },
  { key: 'roles', label: 'Role' },
  { key: 'groups', label: 'Group' },
]

export interface FoundPrimitive {
  type: string
  name: string
  domainPath?: string
  node: any
}

/**
 * Collect every instance of a primitive type across a layer document.
 *
 * Handles three traversal styles:
 *   - top-level array (`location: "operations"`)
 *   - top-level singleton (`location: "namespace"`, `singleton: true`)
 *   - tree-walked (`location: "domain.*.resources"` or `"views.*.nodes"`)
 *   - parent-aware children (operational actions/attributes — collected from
 *     every Resource / Person / Role / Group in the domain tree)
 */
export function collectPrimitives(doc: any, spec: PrimitiveSpec): FoundPrimitive[] {
  if (!doc) return []

  // ── Architecture view-nested primitives (nodes, connections, zones inside views) ──
  if (spec.nested && spec.location.startsWith('views.*')) {
    const out: FoundPrimitive[] = []
    const field = spec.location.split('.').pop()!
    for (const view of doc.views ?? []) {
      for (const item of view[field] ?? []) {
        out.push({
          type: spec.type,
          name: item.name ?? item.id ?? '(unnamed)',
          domainPath: view.name,
          node: item,
        })
      }
    }
    return out
  }

  // ── Action / Attribute on any of the four noun primitives ──
  if (spec.nested && spec.childOf === 'noun') {
    const childKey = spec.location.endsWith('.actions') ? 'actions' : 'attributes'
    const out: FoundPrimitive[] = []
    walkDomains(doc.domain, (node, dpath) => {
      for (const { key, label } of NOUN_KINDS) {
        for (const noun of node[key] ?? []) {
          for (const child of noun[childKey] ?? []) {
            out.push({
              type: spec.type,
              name: child.name,
              domainPath: `${dpath}:${label}.${noun.name}`,
              node: child,
            })
          }
        }
      }
    })
    return out
  }

  // ── product/core fields/actions (children of resources) ──
  if (spec.nested && (spec.childOf === 'resource' || spec.childOf === 'page')) {
    const parentKey = spec.childOf === 'resource' ? 'resources' : 'pages'
    const childKey = spec.location.split('.').pop()!
    const out: FoundPrimitive[] = []
    for (const parent of doc[parentKey] ?? []) {
      for (const child of parent[childKey] ?? []) {
        out.push({
          type: spec.type,
          name: child.name,
          domainPath: parent.name,
          node: child,
        })
      }
    }
    return out
  }

  // ── Operational nouns (resources/persons/roles/groups) tree-walked ──
  if (spec.nested && spec.location.startsWith('domain.*')) {
    const out: FoundPrimitive[] = []
    const field = spec.location.split('.').pop()! // 'resources' | 'persons' | 'roles' | 'groups'
    walkDomains(doc.domain, (node, dpath) => {
      for (const item of node[field] ?? []) {
        out.push({ type: spec.type, name: item.name, domainPath: dpath, node: item })
      }
    })
    return out
  }

  // ── Domain itself — flatten the tree into Domain primitives ──
  if (spec.type === 'Domain') {
    const out: FoundPrimitive[] = []
    walkDomains(doc.domain, (node, dpath) => {
      out.push({ type: 'Domain', name: node.name, domainPath: dpath, node })
    })
    return out
  }

  // ── Top-level singleton (Namespace, Layout) ──
  if (spec.singleton) {
    const node = doc[spec.location]
    return node ? [{ type: spec.type, name: node.name ?? spec.type, node }] : []
  }

  // ── Top-level array ──
  const arr = doc[spec.location] ?? []
  return arr.map((item: any) => ({
    type: spec.type,
    name: item.name ?? '(unnamed)',
    node: item,
  }))
}

/** Find the domain node at a given dotted path. */
export function findDomainByPath(domain: any, targetPath: string): any | undefined {
  let found: any | undefined
  walkDomains(domain, (node, dpath) => {
    if (dpath === targetPath) found = node
  })
  return found
}

/**
 * For an operational noun primitive (Resource/Person/Role/Group), find it by
 * `name` anywhere in the domain tree. Used by the CLI to resolve `--at` paths
 * for adding Action/Attribute children.
 *
 * Returns the noun node and its kind ("resources" | "persons" | "roles" | "groups")
 * so the caller knows which child collection to mutate.
 */
export function findNounByName(
  domain: any,
  domainPath: string,
  nounName: string,
): { noun: any; kind: 'resources' | 'persons' | 'roles' | 'groups' } | undefined {
  const dom = findDomainByPath(domain, domainPath)
  if (!dom) return undefined
  for (const { key } of NOUN_KINDS) {
    const found = (dom[key] ?? []).find((n: any) => n.name === nounName)
    if (found) return { noun: found, kind: key as 'resources' | 'persons' | 'roles' | 'groups' }
  }
  return undefined
}
