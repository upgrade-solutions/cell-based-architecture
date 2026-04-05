import { Layer } from './context'

/**
 * Catalog of primitive types per layer and where they live inside the layer document.
 * Location is a dotted path to the array that holds them.
 *
 * For operational primitives that nest inside the domain tree, `location` is `domain.*`
 * meaning "walk the domain tree and collect from every domain's <plural> array".
 */
export interface PrimitiveSpec {
  type: string
  layer: Layer
  /** dotted path inside the layer document, or 'domain.*.<plural>' for tree-walked primitives */
  location: string
  nested?: boolean
}

export const PRIMITIVES: PrimitiveSpec[] = [
  // operational — domain tree
  { type: 'Domain', layer: 'operational', location: 'domain', nested: true },
  { type: 'Noun', layer: 'operational', location: 'domain.*.nouns', nested: true },
  { type: 'Verb', layer: 'operational', location: 'domain.*.nouns.*.verbs', nested: true },
  { type: 'Attribute', layer: 'operational', location: 'domain.*.nouns.*.attributes', nested: true },
  // operational — top-level arrays
  { type: 'Capability', layer: 'operational', location: 'capabilities' },
  { type: 'Trigger', layer: 'operational', location: 'triggers' },
  { type: 'Policy', layer: 'operational', location: 'policies' },
  { type: 'Rule', layer: 'operational', location: 'rules' },
  { type: 'Effect', layer: 'operational', location: 'effects' },
  { type: 'Flow', layer: 'operational', location: 'flows' },
  { type: 'Equation', layer: 'operational', location: 'equations' },

  // product.api
  { type: 'Namespace', layer: 'product.api', location: 'namespace' },
  { type: 'Resource', layer: 'product.api', location: 'resources' },
  { type: 'Operation', layer: 'product.api', location: 'operations' },
  { type: 'Endpoint', layer: 'product.api', location: 'endpoints' },
  { type: 'Schema', layer: 'product.api', location: 'schemas' },

  // product.ui
  { type: 'Layout', layer: 'product.ui', location: 'layout' },
  { type: 'Page', layer: 'product.ui', location: 'pages' },
  { type: 'Route', layer: 'product.ui', location: 'routes' },

  // technical
  { type: 'Environment', layer: 'technical', location: 'environments' },
  { type: 'Provider', layer: 'technical', location: 'providers' },
  { type: 'Construct', layer: 'technical', location: 'constructs' },
  { type: 'Variable', layer: 'technical', location: 'variables' },
  { type: 'Cell', layer: 'technical', location: 'cells' },
  { type: 'Output', layer: 'technical', location: 'outputs' },
  { type: 'Script', layer: 'technical', location: 'scripts' },
]

export function primitivesForLayer(layer: Layer): PrimitiveSpec[] {
  return PRIMITIVES.filter((p) => p.layer === layer)
}

export function findPrimitiveSpec(layer: Layer, type: string): PrimitiveSpec | undefined {
  return PRIMITIVES.find((p) => p.layer === layer && p.type.toLowerCase() === type.toLowerCase())
}

/**
 * Walk the domain tree in an operational DNA doc, yielding each domain node
 * with its path (e.g. "acme.finance.lending").
 */
export function walkDomains(
  domain: any,
  visit: (node: any, path: string) => void,
): void {
  if (!domain) return
  visit(domain, domain.path || domain.name)
  for (const child of domain.domains ?? []) {
    walkDomains(child, visit)
  }
}

export interface FoundPrimitive {
  type: string
  name: string
  domainPath?: string
  node: any
}

/**
 * Collect every instance of a primitive type across the layer document.
 * For nested operational primitives, walks the domain tree.
 */
export function collectPrimitives(
  doc: any,
  spec: PrimitiveSpec,
): FoundPrimitive[] {
  if (!doc) return []

  // Tree-walked operational primitives
  if (spec.nested && spec.location.startsWith('domain.*')) {
    const out: FoundPrimitive[] = []
    if (spec.location === 'domain.*.nouns') {
      walkDomains(doc.domain, (node, dpath) => {
        for (const n of node.nouns ?? []) {
          out.push({ type: spec.type, name: n.name, domainPath: dpath, node: n })
        }
      })
    } else if (spec.location === 'domain.*.nouns.*.verbs') {
      walkDomains(doc.domain, (node, dpath) => {
        for (const n of node.nouns ?? []) {
          for (const v of n.verbs ?? []) {
            out.push({ type: spec.type, name: v.name, domainPath: `${dpath}:${n.name}`, node: v })
          }
        }
      })
    } else if (spec.location === 'domain.*.nouns.*.attributes') {
      walkDomains(doc.domain, (node, dpath) => {
        for (const n of node.nouns ?? []) {
          for (const a of n.attributes ?? []) {
            out.push({ type: spec.type, name: a.name, domainPath: `${dpath}:${n.name}`, node: a })
          }
        }
      })
    }
    return out
  }

  // Domain itself — flatten the tree into Domain primitives
  if (spec.type === 'Domain') {
    const out: FoundPrimitive[] = []
    walkDomains(doc.domain, (node, dpath) => {
      out.push({ type: 'Domain', name: node.name, domainPath: dpath, node })
    })
    return out
  }

  // Top-level singleton (Namespace, Layout)
  if (spec.type === 'Namespace' || spec.type === 'Layout') {
    const node = doc[spec.location]
    return node ? [{ type: spec.type, name: node.name, node }] : []
  }

  // Top-level array
  const arr = doc[spec.location] ?? []
  return arr.map((item: any) => ({
    type: spec.type,
    name: item.name ?? item.capability ?? item.noun ?? '(unnamed)',
    node: item,
  }))
}

/**
 * Find the domain node at a given path (e.g. "acme.finance.lending").
 * Returns undefined if no match.
 */
export function findDomainByPath(domain: any, targetPath: string): any | undefined {
  let found: any | undefined
  walkDomains(domain, (node, dpath) => {
    if (dpath === targetPath) found = node
  })
  return found
}
