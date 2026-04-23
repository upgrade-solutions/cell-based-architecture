import { dia, shapes } from '@joint/plus'
import type { ArchNode, ArchConnection, ArchZone, NodeStatus } from '../loaders/dna-loader.ts'
import { CellShape } from './CellShape.ts'
import { ConstructShape } from './ConstructShape.ts'
import { ProviderShape } from './ProviderShape.ts'
import { ZoneContainer, ZONE_COLORS } from './ZoneContainer.ts'

/**
 * Status-driven edge styling. Mirrors the node status palette so the graph
 * reads coherently: deployed edges match deployed nodes, planned edges
 * match planned nodes, proposed edges are dashed + dim like proposed
 * nodes. The connection's semantic type (depends-on, data-flow, etc.) is
 * no longer encoded in the stroke — it stays in the tooltip/sidebar data.
 *
 *   deployed → full-saturation blue (matches cell stroke) at 100% opacity
 *   planned  → mid grey at 60% opacity (matches planned node body)
 *   proposed → dim grey, dashed 6,4 at 45% opacity (matches proposed node)
 */
const CONNECTION_STATUS_STYLES: Record<NodeStatus, { stroke: string; strokeDasharray?: string; opacity: number }> = {
  deployed: { stroke: '#60a5fa', opacity: 1.0 },
  planned:  { stroke: '#64748b', opacity: 0.6 },
  proposed: { stroke: '#475569', strokeDasharray: '6,4', opacity: 0.45 },
}

/**
 * Status-based style overrides.
 * - proposed: dashed stroke, very dim
 * - planned: solid stroke, greyed out
 * - deployed: full color (default) — deployed means running
 */
function statusBodyAttrs(status: NodeStatus | undefined, _baseStroke: string, _nodeType: string): Record<string, unknown> {
  switch (status) {
    case 'proposed':
      return {
        stroke: '#475569',
        strokeDasharray: '6,4',
        opacity: 0.45,
      }
    case 'planned':
      return {
        stroke: '#64748b',
        strokeDasharray: undefined,
        opacity: 0.6,
      }
    case 'deployed':
    default:
      return {}
  }
}

function statusLabelAttrs(status: NodeStatus | undefined): Record<string, unknown> {
  switch (status) {
    case 'proposed':
      return { fill: '#475569' }
    case 'planned':
      return { fill: '#94a3b8' }
    default:
      return {}
  }
}

export class ShapesFactory {
  createNode(node: ArchNode): dia.Element {
    const pos = node.position ?? { x: 0, y: 0 }
    const status = node.status

    switch (node.type) {
      case 'cell': {
        const size = node.size ?? { width: 160, height: 70 }
        const url = (node.metadata?.url as string | undefined) ?? ''
        // Display URL with http:// stripped for readability; href keeps full URL
        const urlDisplay = url.replace(/^https?:\/\//, '')
        // When technical DNA supplies a `label`, `node.name` carries it and
        // `metadata.role` holds the original kebab-case cell name (e.g.
        // "api-cell") — render it as a subtitle. Hidden when the label is
        // absent (name === role) so undifferentiated cells stay clean.
        const role = (node.metadata?.role as string | undefined) ?? ''
        const roleDisplay = role && role !== node.name ? role : ''
        return new CellShape({
          id: node.id,
          position: pos,
          size,
          attrs: {
            label: { text: node.name, ...statusLabelAttrs(status) },
            roleLabel: { text: roleDisplay, ...statusLabelAttrs(status) },
            urlLabel: {
              text: urlDisplay,
              ...statusLabelAttrs(status),
              // Override fill so URL keeps its link color even when deployed
              ...(status === 'proposed' || status === 'planned' ? {} : { fill: '#60a5fa' }),
            },
            body: statusBodyAttrs(status, '#3b82f6', 'cell'),
          },
        })
      }
      case 'construct': {
        const size = node.size ?? { width: 140, height: 70 }
        // Mirrors the cell subtitle logic: when `label` has replaced the
        // kebab-case name in `node.name`, `metadata.role` carries the
        // original id for the subtitle. Hidden when they match so
        // unlabeled constructs stay clean.
        const role = (node.metadata?.role as string | undefined) ?? ''
        const roleDisplay = role && role !== node.name ? role : ''
        const url = (node.metadata?.url as string | undefined) ?? ''
        const urlDisplay = url.replace(/^https?:\/\//, '')
        return new ConstructShape({
          id: node.id,
          position: pos,
          size,
          attrs: {
            label: { text: node.name, ...statusLabelAttrs(status) },
            roleLabel: { text: roleDisplay, ...statusLabelAttrs(status) },
            urlLabel: {
              text: urlDisplay,
              ...statusLabelAttrs(status),
              ...(status === 'proposed' || status === 'planned' ? {} : { fill: '#60a5fa' }),
            },
            body: statusBodyAttrs(status, '#3b82f6', 'construct'),
          },
        })
      }
      case 'provider': {
        const size = node.size ?? { width: 140, height: 50 }
        return new ProviderShape({
          id: node.id,
          position: pos,
          size,
          attrs: {
            label: { text: node.name, ...statusLabelAttrs(status) },
            body: statusBodyAttrs(status, '#f59e0b', 'provider'),
          },
        })
      }
      default: {
        // Generic rectangle for domain, noun, external, custom
        const size = node.size ?? { width: 140, height: 60 }
        return new shapes.standard.Rectangle({
          id: node.id,
          position: pos,
          size,
          attrs: {
            body: {
              fill: '#1e293b',
              stroke: '#64748b',
              strokeWidth: 2,
              rx: 6,
              ry: 6,
              ...statusBodyAttrs(status, '#64748b', 'default'),
            },
            label: {
              text: node.name,
              fill: '#f8fafc',
              fontSize: 12,
              fontWeight: '600',
              ...statusLabelAttrs(status),
            },
          },
        })
      }
    }
  }

  createConnection(conn: ArchConnection): shapes.standard.Link {
    // Edge status is computed by the mapper from its endpoints' statuses.
    // Default to 'planned' so we never render a naked full-color edge for
    // a connection that's missing the field (e.g. hand-authored test DNA).
    const status: NodeStatus = conn.status ?? 'planned'
    const style = CONNECTION_STATUS_STYLES[status]
    // The deployment view layout is strictly top-to-bottom (frontend → backend
    // → storage), so force every edge to exit the source's bottom-middle and
    // enter the target's top-middle. Setting connectionPoint to 'anchor'
    // stops the manhattan router from spreading multiple incoming edges
    // along the target's top edge — all edges terminate exactly at top-middle.
    return new shapes.standard.Link({
      id: conn.id,
      source: {
        id: conn.source,
        anchor: { name: 'bottom' },
        connectionPoint: { name: 'anchor' },
      },
      target: {
        id: conn.target,
        anchor: { name: 'top' },
        connectionPoint: { name: 'anchor' },
      },
      vertices: conn.vertices ?? [],
      labels: conn.label ? [{
        attrs: {
          text: {
            text: conn.label,
            fill: '#94a3b8',
            fontSize: 10,
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          },
          rect: {
            fill: '#0f172a',
            stroke: 'none',
            rx: 3,
            ry: 3,
          },
        },
      }] : [],
      attrs: {
        line: {
          stroke: style.stroke,
          strokeWidth: 1.5,
          strokeDasharray: style.strokeDasharray,
          strokeOpacity: style.opacity,
          targetMarker: {
            type: 'path',
            d: 'M 8 -4 0 0 8 4 z',
            fill: style.stroke,
            fillOpacity: style.opacity,
          },
        },
      },
      router: {
        name: 'manhattan',
        args: {
          step: 20,
          padding: 20,
          // Force top-to-bottom flow: exit source going down, enter target
          // from above. Without these the router may pick an L-shape that
          // runs along the top or bottom edge of the target cell.
          startDirections: ['bottom'],
          endDirections: ['top'],
        },
      },
      connector: { name: 'rounded', args: { radius: 8 } },
    })
  }

  createZone(zone: ArchZone): dia.Element {
    const colors = pickZoneColors(zone)
    const pos = zone.position ?? { x: 0, y: 0 }
    const size = zone.size ?? { width: 400, height: 200 }

    // Weight hierarchy: boundary zones (Docker / VPC) are the outermost
    // frame and deserve a prominent stroke (2px); tier zones (Compute /
    // Storage) recede as background grouping (1px). Both are solid —
    // dashes are reserved exclusively for 'proposed' nodes.
    const strokeWidth = zone.type === 'boundary' ? 2 : 1

    return new ZoneContainer({
      id: zone.id,
      position: pos,
      size,
      attrs: {
        body: {
          fill: colors.fill,
          stroke: colors.stroke,
          strokeWidth,
        },
        headerBg: {
          // Match whatever alpha the base fill uses so the header row is
          // just a slightly punchier band (works for 0.05, 0.06, 0.08).
          fill: colors.fill.replace(/[\d.]+\)$/, (m) => {
            const alpha = parseFloat(m.slice(0, -1))
            return `${Math.min(alpha * 2, 0.2).toFixed(2)})`
          }),
        },
        label: {
          text: zone.name.toUpperCase(),
          fill: colors.textFill,
        },
      },
    })
  }
}

/**
 * Pick a zone's color palette. Prefers id-specific entries (so Docker and
 * AWS VPC both type='boundary' but render distinctly), falls back to the
 * type entry, finally to the tier palette.
 */
function pickZoneColors(zone: ArchZone): { stroke: string; fill: string; textFill: string } {
  if (zone.id === 'zone-docker') return ZONE_COLORS['delivery-docker']
  if (zone.id === 'zone-vpc')    return ZONE_COLORS['delivery-aws']
  return ZONE_COLORS[zone.type] ?? ZONE_COLORS['tier']
}
