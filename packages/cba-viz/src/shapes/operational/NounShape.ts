import { dia, shapes } from '@joint/plus'

/**
 * Custom shape for Operational Nouns.
 *
 * A Noun is a first-class domain entity (Loan, Borrower, Order). Visually
 * it's a neutral-slate rounded rectangle with a small "count" badge at the
 * bottom-right that shows how many attributes the noun has. The attribute
 * list itself lives in the inspector — the shape only advertises cardinality
 * so the canvas stays readable at domain-level overview scale.
 *
 * Color choice: slate keeps Nouns visually recessive so the louder
 * Capability pills (emerald) read as the "action" foreground while Nouns
 * form the structural background.
 */
export const NounShape = dia.Element.define('cbaViz.NounShape', {
  size: { width: 160, height: 56 },
  markup: [{
    tagName: 'rect',
    selector: 'body',
  }, {
    tagName: 'rect',
    selector: 'countBadge',
  }, {
    tagName: 'text',
    selector: 'label',
  }, {
    tagName: 'text',
    selector: 'countLabel',
  }],
  attrs: {
    body: {
      width: 'calc(w)',
      height: 'calc(h)',
      rx: 8,
      ry: 8,
      fill: '#1e293b',
      stroke: '#64748b',
      strokeWidth: 2,
      cursor: 'move',
    },
    countBadge: {
      width: 28,
      height: 14,
      x: 'calc(w - 34)',
      y: 'calc(h - 20)',
      rx: 3,
      ry: 3,
      fill: 'rgba(100, 116, 139, 0.25)',
      stroke: 'none',
    },
    label: {
      text: 'Noun',
      x: 'calc(w/2)',
      y: 'calc(h/2 - 4)',
      textAnchor: 'middle',
      textVerticalAnchor: 'middle',
      fill: '#f8fafc',
      fontSize: 14,
      fontWeight: '700',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    },
    countLabel: {
      text: '',
      x: 'calc(w - 20)',
      y: 'calc(h - 13)',
      textAnchor: 'middle',
      textVerticalAnchor: 'middle',
      fill: '#cbd5e1',
      fontSize: 9,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    },
  },
})

Object.assign(shapes, {
  cbaViz: {
    ...(shapes as Record<string, unknown>).cbaViz as object,
    NounShape,
  },
})
