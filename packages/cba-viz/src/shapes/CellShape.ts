import { dia, shapes } from '@joint/plus'

/**
 * Custom shape for Cell nodes — rounded rectangle with icon area and label.
 */
export const CellShape = dia.Element.define('cbaViz.CellShape', {
  size: { width: 160, height: 70 },
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
    selector: 'urlLabel',
  }],
  attrs: {
    body: {
      width: 'calc(w)',
      height: 'calc(h)',
      rx: 10,
      ry: 10,
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
      text: 'Cell',
      x: 'calc(w/2)',
      y: 22,
      textAnchor: 'middle',
      textVerticalAnchor: 'middle',
      fill: '#f8fafc',
      fontSize: 13,
      fontWeight: '600',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
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

// Register in the shapes namespace for serialization
Object.assign(shapes, {
  cbaViz: {
    ...(shapes as Record<string, unknown>).cbaViz as object,
    CellShape,
  },
})
