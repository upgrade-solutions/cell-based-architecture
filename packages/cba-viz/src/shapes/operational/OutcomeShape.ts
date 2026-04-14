import { dia, shapes } from '@joint/plus'

/**
 * Custom shape for Operational Outcomes — small rounded-square
 * annotations attached to a Capability. An Outcome describes what
 * changes when the capability successfully executes (state changes,
 * initiations, signal emissions). Visually it's a violet square so a
 * glance over a Capability shows rules (amber/cyan hexes) on one side
 * and outcomes (violet squares) on the other.
 */
export const OutcomeShape = dia.Element.define('cbaViz.OutcomeShape', {
  size: { width: 32, height: 32 },
  markup: [{
    tagName: 'rect',
    selector: 'body',
  }, {
    tagName: 'text',
    selector: 'label',
  }],
  attrs: {
    body: {
      width: 'calc(w)',
      height: 'calc(h)',
      rx: 6,
      ry: 6,
      fill: 'rgba(139, 92, 246, 0.15)',
      stroke: '#8b5cf6',
      strokeWidth: 1.5,
      cursor: 'move',
    },
    label: {
      text: 'O',
      x: 'calc(w/2)',
      y: 'calc(h/2)',
      textAnchor: 'middle',
      textVerticalAnchor: 'middle',
      fill: '#c4b5fd',
      fontSize: 11,
      fontWeight: '700',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    },
  },
})

Object.assign(shapes, {
  cbaViz: {
    ...(shapes as Record<string, unknown>).cbaViz as object,
    OutcomeShape,
  },
})
