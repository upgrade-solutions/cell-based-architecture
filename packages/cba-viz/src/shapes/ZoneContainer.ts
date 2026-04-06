import { dia, shapes } from '@joint/plus'

const ZONE_COLORS: Record<string, { stroke: string; fill: string; textFill: string }> = {
  tier:        { stroke: '#475569', fill: 'rgba(71, 85, 105, 0.08)', textFill: '#94a3b8' },
  boundary:    { stroke: '#ef4444', fill: 'rgba(239, 68, 68, 0.05)', textFill: '#fca5a5' },
  environment: { stroke: '#22c55e', fill: 'rgba(34, 197, 94, 0.05)', textFill: '#86efac' },
  domain:      { stroke: '#3b82f6', fill: 'rgba(59, 130, 246, 0.05)', textFill: '#93c5fd' },
}

/**
 * Custom container shape for Zones — dashed border with header label.
 */
export const ZoneContainer = dia.Element.define('cbaViz.ZoneContainer', {
  size: { width: 400, height: 200 },
  attrs: {
    body: {
      width: 'calc(w)',
      height: 'calc(h)',
      rx: 8,
      ry: 8,
      fill: 'rgba(71, 85, 105, 0.08)',
      stroke: '#475569',
      strokeWidth: 1.5,
      strokeDasharray: '8,4',
      cursor: 'move',
    },
    headerBg: {
      width: 'calc(w)',
      height: 28,
      fill: 'rgba(71, 85, 105, 0.15)',
      stroke: 'none',
      rx: 8,
      ry: 8,
    },
    label: {
      text: 'Zone',
      x: 12,
      y: 14,
      textAnchor: 'start',
      textVerticalAnchor: 'middle',
      fill: '#94a3b8',
      fontSize: 11,
      fontWeight: '700',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    },
  },
}, {
  markup: [{
    tagName: 'rect',
    selector: 'body',
  }, {
    tagName: 'rect',
    selector: 'headerBg',
  }, {
    tagName: 'text',
    selector: 'label',
  }],
})

export { ZONE_COLORS }

Object.assign(shapes, {
  cbaViz: {
    ...(shapes as Record<string, unknown>).cbaViz as object,
    ZoneContainer,
  },
})
