import { dia } from '@joint/plus'
import type { ArchitectureDNA, ArchView, ArchNode, ArchConnection, ArchZone } from '../loaders/dna-loader.ts'

/**
 * Extract the current graph state back into Architecture DNA format.
 * This enables write-back: edit in the diagram → save to architecture.json.
 */
export function graphToArchView(
  graph: dia.Graph,
  viewName: string,
  originalView: ArchView,
): ArchView {
  const elements = graph.getElements()
  const links = graph.getLinks()

  // Rebuild nodes from graph elements (skip zones)
  const nodes: ArchNode[] = []
  const zones: ArchZone[] = []

  for (const el of elements) {
    const dna = el.get('dna')
    if (!dna) continue

    const pos = el.position()
    const size = el.size()

    // Check if this is a zone container
    const embeddedCells = el.getEmbeddedCells()
    if (embeddedCells.length > 0 || el.get('type') === 'cbaViz.ZoneContainer') {
      // This is a zone — find the original zone definition
      const originalZone = (originalView.zones ?? []).find(z => z.id === el.id)
      if (originalZone) {
        zones.push({
          ...originalZone,
          position: { x: Math.round(pos.x), y: Math.round(pos.y) },
          size: { width: Math.round(size.width), height: Math.round(size.height) },
        })
      }
      continue
    }

    // Find original node to preserve fields we don't edit
    const originalNode = originalView.nodes.find(n => n.id === dna.id)

    nodes.push({
      id: dna.id,
      name: dna.name,
      type: dna.type,
      source: dna.source,
      position: { x: Math.round(pos.x), y: Math.round(pos.y) },
      size: { width: Math.round(size.width), height: Math.round(size.height) },
      description: dna.description,
      metadata: dna.metadata ?? originalNode?.metadata,
    })
  }

  // Rebuild connections from graph links
  const connections: ArchConnection[] = links.map(link => {
    const dna = link.get('dna')
    const sourceId = (link.source() as { id: string }).id
    const targetId = (link.target() as { id: string }).id
    const vertices = link.vertices().map((v: { x: number; y: number }) => ({
      x: Math.round(v.x),
      y: Math.round(v.y),
    }))

    return {
      id: dna?.id ?? link.id as string,
      source: sourceId,
      target: targetId,
      type: dna?.type ?? 'depends-on',
      label: dna?.label,
      ...(vertices.length > 0 ? { vertices } : {}),
    }
  })

  return {
    name: viewName,
    description: originalView.description,
    layout: originalView.layout,
    nodes,
    connections,
    zones,
  }
}

/**
 * Save architecture DNA to the server (via Vite dev middleware).
 */
export async function saveArchitectureDNA(
  domain: string,
  dna: ArchitectureDNA,
): Promise<void> {
  const response = await fetch(`/api/save-dna/${domain}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dna, null, 2),
  })
  if (!response.ok) {
    throw new Error(`Failed to save: ${response.statusText}`)
  }
}
