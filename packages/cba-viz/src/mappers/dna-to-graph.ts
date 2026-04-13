import { dia } from '@joint/plus'
import type { ArchView } from '../loaders/dna-loader.ts'
import { ShapesFactory } from '../shapes/ShapesFactory.ts'

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

  // 3. Embed nodes into zones and auto-fit zones.
  //
  // Tier zones (Compute, Storage) contain their own nodes directly and are
  // auto-fit around them. Boundary zones (VPC) wrap tier zones, so we pad
  // them extra on top/bottom to leave visible room around the tier headers.
  for (const zone of view.zones ?? []) {
    const zoneEl = zoneElements.find(z => z.id === zone.id)
    if (!zoneEl) continue

    const childEls = nodeElements.filter(n => zone.nodes.includes(n.id as string))
    if (childEls.length === 0) continue

    // Embed children
    for (const child of childEls) {
      zoneEl.embed(child)
    }

    // Auto-fit zone around children if no explicit position/size
    if (!zone.position || !zone.size) {
      const extraPadding = zone.type === 'boundary'
        // Boundary wraps tier zones, so add extra room above/below so the
        // tier headers don't collide with the boundary header.
        ? { top: 56, right: 36, bottom: 36, left: 36 }
        : { top: 40, right: 20, bottom: 20, left: 20 }
      fitZoneToChildren(zoneEl, childEls, extraPadding)
    }
  }

  // 4. Connections
  for (const conn of view.connections ?? []) {
    const link = factory.createConnection(conn)
    link.set('z', 3) // links above everything
    link.set('dna', {
      id: conn.id,
      type: conn.type,
      label: conn.label,
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
