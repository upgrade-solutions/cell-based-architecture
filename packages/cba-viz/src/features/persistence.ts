import { dia } from '@joint/plus'
import type { ArchitectureDNA, ArchView, ArchNode, ArchZone } from '../loaders/dna-loader.ts'

/**
 * Extract the current graph state as a layout overlay.
 *
 * The derived graph (nodes, connections, zones, metadata) is computed from
 * cells/constructs/providers in technical DNA — we only persist layout data:
 * each element's id, position, and size. On reload, the derive function merges
 * these saved positions onto the derived nodes.
 */
export function graphToArchView(
  graph: dia.Graph,
  viewName: string,
  originalView: ArchView,
): ArchView {
  const elements = graph.getElements()

  const nodes: ArchNode[] = []
  const zones: ArchZone[] = []

  for (const el of elements) {
    const dna = el.get('dna')
    if (!dna) continue

    const pos = el.position()
    const size = el.size()
    const layoutEntry = {
      id: dna.id as string,
      position: { x: Math.round(pos.x), y: Math.round(pos.y) },
      size: { width: Math.round(size.width), height: Math.round(size.height) },
    }

    // Zone containers go into the zones array
    const embeddedCells = el.getEmbeddedCells()
    if (embeddedCells.length > 0 || el.get('type') === 'cbaViz.ZoneContainer') {
      zones.push(layoutEntry as unknown as ArchZone)
      continue
    }

    nodes.push(layoutEntry as unknown as ArchNode)
  }

  return {
    name: viewName,
    description: originalView.description,
    nodes,
    zones,
  }
}

/**
 * Save views back to technical.json (via Vite dev middleware).
 * Merges updated views into the existing technical DNA document.
 */
export async function saveViews(
  domain: string,
  dna: ArchitectureDNA,
): Promise<void> {
  const response = await fetch(`/api/save-views/${encodeURIComponent(domain)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dna.views, null, 2),
  })
  if (!response.ok) {
    throw new Error(`Failed to save: ${response.statusText}`)
  }
}
