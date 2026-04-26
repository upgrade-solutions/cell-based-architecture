import { dia } from '@joint/plus'
import type {
  ProductApiDNA,
  Resource,
  Endpoint,
  Operation,
} from '../loaders/product-loader.ts'
import { ResourceShape } from '../shapes/product/ResourceShape.ts'
import { EndpointShape, METHOD_COLORS } from '../shapes/product/EndpointShape.ts'
import { ZoneContainer } from '../shapes/ZoneContainer.ts'

// ── Stable graph-element IDs ───────────────────────────────────────────

export const PRODUCT_API_ID = {
  namespace: (uuid: string) => `namespace:${uuid}`,
  resource: (uuid: string) => `resource:${uuid}`,
  endpoint: (uuid: string) => `endpoint:${uuid}`,
}

// ── Layout geometry ────────────────────────────────────────────────────
//
// Each Resource gets a vertical lane inside the namespace zone.
// Endpoints attach as satellites to the right of the resource card,
// one per row, so you can scan a Resource's full HTTP surface
// vertically. Resources stack horizontally by document order.
//
// Operations (Resource.Action pairs) are not rendered as shapes —
// they're conceptual glue between Resources and Endpoints, surfaced
// only in the inspector when an Endpoint is selected. The Endpoint
// already carries the `operation` field as a string.

const LANE_WIDTH = 520
const LANE_TOP_PAD = 64
const RESOURCE_X = 24
const RESOURCE_Y = LANE_TOP_PAD
const RESOURCE_SIZE = { width: 200, height: 60 }
const ENDPOINT_X = 24
const ENDPOINT_FIRST_Y = LANE_TOP_PAD + RESOURCE_SIZE.height + 24
const ENDPOINT_SIZE = { width: 240, height: 24 }
const ENDPOINT_ROW_GAP = 32

// ── Entry point ────────────────────────────────────────────────────────

/**
 * Convert a Product API DNA document into JointJS graph cells.
 *
 * Layout:
 *   1. Namespace zone wraps the whole graph
 *   2. One Resource card per resource (document order)
 *   3. Endpoints belonging to each Resource stack vertically below it
 *   4. Resources that have no matching endpoints still get rendered
 *      as empty lanes so orphan resources are visible
 */
export function productApiToGraphCells(dna: ProductApiDNA): dia.Cell[] {
  const cells: dia.Cell[] = []

  const resources = dna.resources ?? []
  const endpoints = dna.endpoints ?? []
  const operations = dna.operations ?? []

  // Build a resource → endpoints index. An endpoint belongs to the
  // resource named in its `operation` field (`Resource.Action`).
  const endpointsByResource = groupEndpointsByResource(endpoints, operations)

  // Build elements
  const resourceCount = resources.length
  // Namespace + lane horizontal padding. Minimum one lane so an empty
  // namespace still renders as a small placeholder.
  const totalWidth = Math.max(1, resourceCount) * LANE_WIDTH + 48
  let totalHeight = LANE_TOP_PAD + RESOURCE_SIZE.height + 32

  resources.forEach((resource, laneIdx) => {
    const laneX = laneIdx * LANE_WIDTH + 24

    const resId = PRODUCT_API_ID.resource(resource.id!)
    const resEl = createResource(resId, resource, laneX + RESOURCE_X, RESOURCE_Y)
    cells.push(resEl)

    const resourceEndpoints = endpointsByResource.get(resource.name) ?? []
    resourceEndpoints.forEach((endpoint, i) => {
      const ey = ENDPOINT_FIRST_Y + i * ENDPOINT_ROW_GAP
      const ex = laneX + ENDPOINT_X
      const epId = PRODUCT_API_ID.endpoint(endpoint.id!)
      cells.push(createEndpoint(epId, endpoint, ex, ey))

      const bottom = ey + ENDPOINT_SIZE.height + 40
      if (bottom > totalHeight) totalHeight = bottom
    })
  })

  // Namespace zone wrapping everything
  const namespaceEl = createNamespaceZone(dna, totalWidth, totalHeight)
  namespaceEl.set('z', 0)

  for (const cell of cells) {
    if (cell.isElement()) {
      namespaceEl.embed(cell as dia.Element)
      ;(cell as dia.Element).set('z', 2)
    }
  }

  return [namespaceEl, ...cells]
}

// ── Element factories ──────────────────────────────────────────────────

function createNamespaceZone(dna: ProductApiDNA, width: number, height: number): dia.Element {
  const ns = dna.namespace
  const nsId = PRODUCT_API_ID.namespace(ns.id!)
  const el = new ZoneContainer({
    id: nsId,
    position: { x: 0, y: 0 },
    size: { width, height },
    attrs: {
      body: {
        fill: 'rgba(99, 102, 241, 0.06)',
        stroke: '#6366f1',
        strokeWidth: 2,
      },
      headerBg: {
        fill: 'rgba(99, 102, 241, 0.18)',
      },
      label: {
        text: `${ns.name.toUpperCase()}  ${ns.path}`,
        fill: '#a5b4fc',
      },
    },
  })
  el.set('dna', {
    kind: 'namespace',
    id: nsId,
    layer: 'product-api',
    name: ns.name,
    description: ns.description,
    source: ns,
  })
  return el
}

function createResource(id: string, resource: Resource, x: number, y: number): dia.Element {
  const fieldCount = resource.fields?.length ?? 0
  const actionCount = resource.actions?.length ?? 0
  const badge = fieldCount > 0 || actionCount > 0
    ? `${fieldCount}f ${actionCount}a`
    : ''
  const el = new ResourceShape({
    id,
    position: { x, y },
    size: RESOURCE_SIZE,
    attrs: {
      label: { text: resource.name },
      countLabel: { text: badge },
    },
  })
  el.set('dna', {
    kind: 'resource',
    id,
    layer: 'product-api',
    name: resource.name,
    description: resource.description,
    source: resource,
  })
  return el
}

function createEndpoint(id: string, endpoint: Endpoint, x: number, y: number): dia.Element {
  const methodColor = METHOD_COLORS[endpoint.method] ?? '#64748b'
  const el = new EndpointShape({
    id,
    position: { x, y },
    size: ENDPOINT_SIZE,
    attrs: {
      methodBadge: { fill: methodColor },
      methodLabel: { text: endpoint.method },
      pathLabel: { text: endpoint.path },
    },
  })
  el.set('dna', {
    kind: 'endpoint',
    id,
    layer: 'product-api',
    name: `${endpoint.method} ${endpoint.path}`,
    description: endpoint.description,
    source: endpoint,
  })
  return el
}

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Build a Resource → Endpoint[] index. Endpoint.operation is a
 * `Resource.Action` string, so we split on the dot and key by resource.
 * Falls back to matching against the operations array when the
 * operation string doesn't look like `Resource.Action` (e.g. for
 * operations defined with a custom name).
 */
function groupEndpointsByResource(
  endpoints: Endpoint[],
  operations: Operation[],
): Map<string, Endpoint[]> {
  const opByName = new Map<string, Operation>()
  for (const op of operations) {
    const target = op.target ?? op.resource
    const name = op.name ?? `${target ?? ''}.${op.action}`
    opByName.set(name, op)
  }

  const map = new Map<string, Endpoint[]>()
  for (const endpoint of endpoints) {
    // Primary: parse `Resource.Action` directly from the operation string.
    const direct = endpoint.operation.split('.')[0]
    let resource: string | undefined = direct
    // Fallback: look up the operation to find its resource when the
    // naming doesn't match the dotted convention.
    if (!resource) {
      const op = opByName.get(endpoint.operation)
      if (op) resource = op.target ?? op.resource
    }
    if (!resource) continue
    const list = map.get(resource) ?? []
    list.push(endpoint)
    map.set(resource, list)
  }
  return map
}
