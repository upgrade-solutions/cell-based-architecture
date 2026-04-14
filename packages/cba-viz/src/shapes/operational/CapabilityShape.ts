import { dia, shapes } from '@joint/plus'

/**
 * Custom shape for Operational Capabilities (Noun.Verb pairs).
 *
 * Capabilities are the atomic units of business activity — the "actions"
 * that drive the domain forward — so they get the most visual weight:
 * emerald pill, filled body, bold label. Small badges at the top-right
 * show rule and outcome counts without taking up canvas real estate.
 *
 * Shape is a high-radius rounded rect ("pill") to visually distinguish
 * Capabilities from Nouns (squared rects). Color emerald rather than
 * the technical-layer blue so a cross-layer glance immediately tells
 * you which layer you're looking at.
 */
export const CapabilityShape = dia.Element.define('cbaViz.CapabilityShape', {
  size: { width: 160, height: 40 },
  markup: [{
    tagName: 'rect',
    selector: 'body',
  }, {
    tagName: 'text',
    selector: 'label',
  }, {
    tagName: 'text',
    selector: 'badges',
  }],
  attrs: {
    body: {
      width: 'calc(w)',
      height: 'calc(h)',
      rx: 20,
      ry: 20,
      fill: 'rgba(16, 185, 129, 0.15)',
      stroke: '#10b981',
      strokeWidth: 2,
      cursor: 'move',
    },
    label: {
      text: 'Noun.Verb',
      x: 14,
      y: 'calc(h/2)',
      textAnchor: 'start',
      textVerticalAnchor: 'middle',
      fill: '#d1fae5',
      fontSize: 12,
      fontWeight: '600',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    },
    badges: {
      text: '',
      x: 'calc(w - 14)',
      y: 'calc(h/2)',
      textAnchor: 'end',
      textVerticalAnchor: 'middle',
      fill: '#6ee7b7',
      fontSize: 10,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    },
  },
})

Object.assign(shapes, {
  cbaViz: {
    ...(shapes as Record<string, unknown>).cbaViz as object,
    CapabilityShape,
  },
})
