import { dia } from '@joint/plus'
import type { ArchView, NodeStatus } from '../loaders/dna-loader.ts'
import { ShapesFactory } from '../shapes/ShapesFactory.ts'

/**
 * Edge status = the weakest of its endpoint statuses.
 *   deployed > planned > proposed
 * An edge connecting two deployed nodes is deployed. If either endpoint
 * is planned or proposed, the edge demotes to that level — the
 * connection can't really exist if one end hasn't been built. Missing
 * endpoint defaults to 'planned' (matches what deriveView sets).
 */
const STATUS_RANK: Record<NodeStatus, number> = {
  deployed: 2,
  planned: 1,
  proposed: 0,
}
function weakerStatus(a: NodeStatus, b: NodeStatus): NodeStatus {
  return STATUS_RANK[a] <= STATUS_RANK[b] ? a : b
}

/**
 * Convert an Architecture DNA view into JointJS graph cells.
 *
 * Processing order:
 * 1. Create zone containers first (they go behind everything)
 * 2. Create nodes
 * 3. Embed nodes into their zone containers
 * 4. Create connections (links)
 */
export function viewToGraphCells(view: ArchView): dia.Cell[] {
  const factory = new ShapesFactory()
  const cells: dia.Cell[] = []

  // 1. Zones — create containers and compute bounding boxes from child nodes.
  //
  // Z-order: boundary zones (e.g. VPC) render behind tier zones (Compute,
  // Storage) so nested layers read visually. A boundary zone wrapping the
  // whole graph must draw first / lowest; tier zones draw on top; nodes
  // on top of those; links on top of everything.
  const zoneElements: dia.Element[] = []
  const nodeToZone = new Map<string, string>()

  for (const zone of view.zones ?? []) {
    for (const nodeId of zone.nodes) {
      nodeToZone.set(nodeId, zone.id)
    }

    // If zone has explicit position/size, use them
    // Otherwise, auto-calculate after nodes are placed
    const zoneEl = factory.createZone(zone)
    zoneEl.set('z', zone.type === 'boundary' ? 0 : 1)
    zoneElements.push(zoneEl)
    cells.push(zoneEl)
  }

  // 2. Nodes
  const nodeElements: dia.Element[] = []
  for (const node of view.nodes) {
    const el = factory.createNode(node)
    el.set('z', 2) // nodes above zones
    // Store DNA metadata for inspector
    el.set('dna', {
      id: node.id,
      name: node.name,
      type: node.type,
      status: node.status,
      source: node.source,
      description: node.description,
      metadata: node.metadata,
    })
    nodeElements.push(el)
    cells.push(el)
  }

  // 3. Embed + auto-fit zones in two passes.
  //
  // JointJS only allows each cell to have one parent, so we can't embed a
  // node into both its tier zone AND the boundary zone that wraps the
  // whole graph. Instead:
  //
  //   Pass A — tier zones (Compute, Storage) embed their nodes and fit
  //             around them directly.
  //   Pass B — boundary zones (Docker / VPC) embed the tier zones whose
  //             nodes overlap the boundary's node set, and fit around those
  //             tier zones. This gives us proper visual nesting (boundary >
  //             tier > node) and makes drag-move propagate correctly.
  const tierZones = (view.zones ?? []).filter(z => z.type !== 'boundary')
  const boundaryZones = (view.zones ?? []).filter(z => z.type === 'boundary')

  // Pass A: tier zones
  for (const zone of tierZones) {
    const zoneEl = zoneElements.find(z => z.id === zone.id)
    if (!zoneEl) continue

    const childEls = nodeElements.filter(n => zone.nodes.includes(n.id as string))
    if (childEls.length === 0) continue

    for (const child of childEls) {
      zoneEl.embed(child)
    }

    if (!zone.position || !zone.size) {
      fitZoneToChildren(zoneEl, childEls)
    }
  }

  // Pass B: boundary zones. Fit around their contained tier zones (not raw
  // nodes), with extra top padding so the boundary header doesn't collide
  // with the inner tier headers.
  for (const zone of boundaryZones) {
    const zoneEl = zoneElements.find(z => z.id === zone.id)
    if (!zoneEl) continue

    const zoneNodeIds = new Set(zone.nodes)
    const containedTierEls: dia.Element[] = []
    for (const tier of tierZones) {
      // A tier belongs to this boundary if any of its nodes is in the
      // boundary's node set. In practice boundaries claim all nodes, so
      // every tier is contained.
      if (tier.nodes.some(id => zoneNodeIds.has(id))) {
        const el = zoneElements.find(z => z.id === tier.id)
        if (el) containedTierEls.push(el)
      }
    }

    if (containedTierEls.length === 0) continue

    for (const tierEl of containedTierEls) {
      zoneEl.embed(tierEl)
    }

    if (!zone.position || !zone.size) {
      fitZoneToChildren(zoneEl, containedTierEls, { top: 56, right: 36, bottom: 36, left: 36 })
    }
  }

  // 4. Connections. Compute each edge's effective status from its endpoints
  // at render time so it stays in sync with whatever live status polling
  // has written onto the nodes in DNA.
  const nodeStatus = new Map<string, NodeStatus>()
  for (const node of view.nodes) {
    nodeStatus.set(node.id, (node.status ?? 'planned') as NodeStatus)
  }

  for (const conn of view.connections ?? []) {
    const sourceStatus = nodeStatus.get(conn.source) ?? 'planned'
    const targetStatus = nodeStatus.get(conn.target) ?? 'planned'
    const edgeStatus = weakerStatus(sourceStatus, targetStatus)

    const link = factory.createConnection({ ...conn, status: edgeStatus })
    link.set('z', 3) // links above everything
    link.set('dna', {
      id: conn.id,
      type: conn.type,
      label: conn.label,
      status: edgeStatus,
    })
    cells.push(link)
  }

  return cells
}

/**
 * Auto-fit a zone container to surround its child elements with padding.
 */
function fitZoneToChildren(
  zone: dia.Element,
  children: dia.Element[],
  padding: { top: number; right: number; bottom: number; left: number } = { top: 40, right: 20, bottom: 20, left: 20 },
) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const child of children) {
    const pos = child.position()
    const size = child.size()
    minX = Math.min(minX, pos.x)
    minY = Math.min(minY, pos.y)
    maxX = Math.max(maxX, pos.x + size.width)
    maxY = Math.max(maxY, pos.y + size.height)
  }

  zone.position(minX - padding.left, minY - padding.top)
  zone.resize(
    maxX - minX + padding.left + padding.right,
    maxY - minY + padding.top + padding.bottom,
  )
}
