import { dia, shapes } from '@joint/plus'

/**
 * Custom shape for Construct nodes — rectangle with category-based styling.
 * Storage constructs get a cylinder-like appearance; compute and network get sharp corners.
 */
export const ConstructShape = dia.Element.define('cbaViz.ConstructShape', {
  size: { width: 140, height: 60 },
  attrs: {
    body: {
      width: 'calc(w)',
      height: 'calc(h)',
      rx: 4,
      ry: 4,
      fill: '#1e293b',
      stroke: '#8b5cf6',
      strokeWidth: 2,
      strokeDasharray: '6,3',
      cursor: 'move',
    },
    categoryBadge: {
      width: 'calc(w)',
      height: 16,
      y: 'calc(h - 16)',
      fill: 'rgba(139, 92, 246, 0.15)',
      stroke: 'none',
    },
    label: {
      text: 'Construct',
      x: 'calc(w/2)',
      y: 18,
      textAnchor: 'middle',
      textVerticalAnchor: 'middle',
      fill: '#f8fafc',
      fontSize: 12,
      fontWeight: '600',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    },
    categoryLabel: {
      text: '',
      x: 'calc(w/2)',
      y: 'calc(h - 8)',
      textAnchor: 'middle',
      textVerticalAnchor: 'middle',
      fill: '#a78bfa',
      fontSize: 9,
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    },
  },
}, {
  markup: [{
    tagName: 'rect',
    selector: 'body',
  }, {
    tagName: 'rect',
    selector: 'categoryBadge',
  }, {
    tagName: 'text',
    selector: 'label',
  }, {
    tagName: 'text',
    selector: 'categoryLabel',
  }],
})

Object.assign(shapes, {
  cbaViz: {
    ...(shapes as Record<string, unknown>).cbaViz as object,
    ConstructShape,
  },
})
