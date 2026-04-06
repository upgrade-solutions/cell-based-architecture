import { dia, shapes } from '@joint/plus'
import type { ArchNode, ArchConnection, ArchZone } from '../loaders/dna-loader.ts'
import { CellShape } from './CellShape.ts'
import { ConstructShape } from './ConstructShape.ts'
import { ProviderShape } from './ProviderShape.ts'
import { ZoneContainer, ZONE_COLORS } from './ZoneContainer.ts'

const CONNECTION_STYLES: Record<string, { stroke: string; strokeDasharray?: string }> = {
  'depends-on':         { stroke: '#64748b' },
  'data-flow':          { stroke: '#3b82f6', strokeDasharray: '8,4' },
  'communicates-with':  { stroke: '#22c55e' },
  'publishes-to':       { stroke: '#f59e0b', strokeDasharray: '4,4' },
}

export class ShapesFactory {
  createNode(node: ArchNode): dia.Element {
    const pos = node.position ?? { x: 0, y: 0 }
    const adapter = (node.metadata?.adapter as string) ?? ''

    switch (node.type) {
      case 'cell': {
        const size = node.size ?? { width: 160, height: 70 }
        return new CellShape({
          id: node.id,
          position: pos,
          size,
          attrs: {
            label: { text: node.name },
            adapterLabel: { text: adapter },
          },
        })
      }
      case 'construct': {
        const size = node.size ?? { width: 140, height: 60 }
        const category = (node.metadata?.category as string) ?? ''
        return new ConstructShape({
          id: node.id,
          position: pos,
          size,
          attrs: {
            label: { text: node.name },
            categoryLabel: { text: category },
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
            label: { text: node.name },
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
            },
            label: {
              text: node.name,
              fill: '#f8fafc',
              fontSize: 12,
              fontWeight: '600',
            },
          },
        })
      }
    }
  }

  createConnection(conn: ArchConnection): shapes.standard.Link {
    const style = CONNECTION_STYLES[conn.type] ?? CONNECTION_STYLES['depends-on']
    return new shapes.standard.Link({
      id: conn.id,
      source: { id: conn.source },
      target: { id: conn.target },
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
          targetMarker: {
            type: 'path',
            d: 'M 8 -4 0 0 8 4 z',
            fill: style.stroke,
          },
        },
      },
      router: { name: 'manhattan', args: { step: 20, padding: 20 } },
      connector: { name: 'rounded', args: { radius: 8 } },
    })
  }

  createZone(zone: ArchZone): dia.Element {
    const colors = ZONE_COLORS[zone.type] ?? ZONE_COLORS['tier']
    const pos = zone.position ?? { x: 0, y: 0 }
    const size = zone.size ?? { width: 400, height: 200 }

    return new ZoneContainer({
      id: zone.id,
      position: pos,
      size,
      attrs: {
        body: {
          fill: colors.fill,
          stroke: colors.stroke,
        },
        headerBg: {
          fill: colors.fill.replace('0.08', '0.15'),
        },
        label: {
          text: zone.name.toUpperCase(),
          fill: colors.textFill,
        },
      },
    })
  }
}
