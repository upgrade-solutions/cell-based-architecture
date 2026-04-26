import { dia, shapes } from '@joint/plus'

/**
 * Custom shape for Operational Triggers — the cause that initiates an
 * Operation or Process. `source` enumerates how the Trigger fires:
 * 'user', 'schedule', 'webhook', 'operation'. Visually a small rose
 * diamond (UML/BPMN event convention) so trigger-fan-in to an Operation
 * reads as "events flowing into action".
 */

export const TRIGGER_PALETTE = {
  user:      { fill: 'rgba(244, 63, 94, 0.15)', stroke: '#f43f5e', label: '#fda4af' },
  schedule:  { fill: 'rgba(249, 115, 22, 0.15)', stroke: '#f97316', label: '#fdba74' },
  webhook:   { fill: 'rgba(59, 130, 246, 0.15)', stroke: '#3b82f6', label: '#93c5fd' },
  operation: { fill: 'rgba(16, 185, 129, 0.15)', stroke: '#10b981', label: '#6ee7b7' },
} as const

export type TriggerSourceKind = keyof typeof TRIGGER_PALETTE

export const TriggerShape = dia.Element.define('cbaViz.TriggerShape', {
  size: { width: 56, height: 56 },
  markup: [{
    tagName: 'polygon',
    selector: 'body',
  }, {
    tagName: 'text',
    selector: 'label',
  }],
  attrs: {
    body: {
      // Diamond — fixed 56x56 box. Mapper creates instances at that size.
      points: '28,2 54,28 28,54 2,28',
      fill: 'rgba(244, 63, 94, 0.15)',
      stroke: '#f43f5e',
      strokeWidth: 1.5,
      cursor: 'move',
    },
    label: {
      text: 'Trigger',
      x: 28,
      y: 28,
      textAnchor: 'middle',
      textVerticalAnchor: 'middle',
      fill: '#fda4af',
      fontSize: 9,
      fontWeight: '700',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    },
  },
})

Object.assign(shapes, {
  cbaViz: {
    ...(shapes as Record<string, unknown>).cbaViz as object,
    TriggerShape,
  },
})
