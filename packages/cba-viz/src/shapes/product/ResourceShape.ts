import { dia, shapes } from '@joint/plus'

/**
 * Custom shape for Product Resources.
 *
 * A Resource is a product-level entity (Loan, Borrower, Order) — the
 * thing an API exposes and a UI renders pages for. It maps 1:1 to an
 * Operational Noun but is distinct visually because product DNA lives
 * in its own color family (indigo) separate from operational (emerald)
 * and technical (blue).
 *
 * Visually similar to NounShape — rounded rectangle with a count badge
 * — so the "card describing an entity" metaphor carries across layers.
 * Indigo-tinted body distinguishes it from the slate operational Noun.
 */
export const ResourceShape = dia.Element.define('cbaViz.ResourceShape', {
  size: { width: 180, height: 60 },
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
      fill: 'rgba(99, 102, 241, 0.12)',
      stroke: '#6366f1',
      strokeWidth: 2,
      cursor: 'move',
    },
    countBadge: {
      width: 36,
      height: 14,
      x: 'calc(w - 42)',
      y: 'calc(h - 20)',
      rx: 3,
      ry: 3,
      fill: 'rgba(99, 102, 241, 0.25)',
      stroke: 'none',
    },
    label: {
      text: 'Resource',
      x: 'calc(w/2)',
      y: 'calc(h/2 - 6)',
      textAnchor: 'middle',
      textVerticalAnchor: 'middle',
      fill: '#e0e7ff',
      fontSize: 14,
      fontWeight: '700',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    },
    countLabel: {
      text: '',
      x: 'calc(w - 24)',
      y: 'calc(h - 13)',
      textAnchor: 'middle',
      textVerticalAnchor: 'middle',
      fill: '#c7d2fe',
      fontSize: 9,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    },
  },
})

Object.assign(shapes, {
  cbaViz: {
    ...(shapes as Record<string, unknown>).cbaViz as object,
    ResourceShape,
  },
})
