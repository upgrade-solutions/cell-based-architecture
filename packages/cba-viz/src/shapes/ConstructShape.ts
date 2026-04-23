import { dia, shapes } from '@joint/plus'

/**
 * Custom shape for Construct nodes — rectangle with category-based styling.
 * Storage constructs get a cylinder-like appearance; compute and network get sharp corners.
 */
export const ConstructShape = dia.Element.define('cbaViz.ConstructShape', {
  size: { width: 140, height: 70 },
  markup: [{
    tagName: 'rect',
    selector: 'body',
  }, {
    tagName: 'rect',
    selector: 'urlBadge',
  }, {
    tagName: 'text',
    selector: 'label',
  }, {
    tagName: 'text',
    selector: 'roleLabel',
  }, {
    tagName: 'text',
    selector: 'urlLabel',
  }],
  attrs: {
    body: {
      width: 'calc(w)',
      height: 'calc(h)',
      rx: 4,
      ry: 4,
      fill: '#1e293b',
      stroke: '#3b82f6',
      strokeWidth: 2,
      cursor: 'move',
    },
    urlBadge: {
      width: 'calc(w)',
      height: 18,
      y: 'calc(h - 18)',
      rx: 0,
      ry: 0,
      fill: 'rgba(59, 130, 246, 0.15)',
      stroke: 'none',
    },
    label: {
      text: 'Construct',
      x: 'calc(w/2)',
      y: 20,
      textAnchor: 'middle',
      textVerticalAnchor: 'middle',
      fill: '#f8fafc',
      fontSize: 12,
      fontWeight: '600',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    },
    roleLabel: {
      text: '',
      x: 'calc(w/2)',
      y: 36,
      textAnchor: 'middle',
      textVerticalAnchor: 'middle',
      fill: '#94a3b8',
      fontSize: 10,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    },
    urlLabel: {
      text: '',
      x: 'calc(w/2)',
      y: 'calc(h - 9)',
      textAnchor: 'middle',
      textVerticalAnchor: 'middle',
      fill: '#60a5fa',
      fontSize: 10,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      cursor: 'pointer',
      textDecoration: 'underline',
    },
  },
})

Object.assign(shapes, {
  cbaViz: {
    ...(shapes as Record<string, unknown>).cbaViz as object,
    ConstructShape,
  },
})
