import { dia, shapes } from '@joint/plus'

/**
 * Custom shape for Provider nodes — cloud-like rounded rect.
 */
export const ProviderShape = dia.Element.define('cbaViz.ProviderShape', {
  size: { width: 140, height: 50 },
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
      rx: 20,
      ry: 20,
      fill: '#1e293b',
      stroke: '#f59e0b',
      strokeWidth: 2,
      cursor: 'move',
    },
    label: {
      text: 'Provider',
      x: 'calc(w/2)',
      y: 'calc(h/2)',
      textAnchor: 'middle',
      textVerticalAnchor: 'middle',
      fill: '#f8fafc',
      fontSize: 13,
      fontWeight: '600',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    },
  },
})

Object.assign(shapes, {
  cbaViz: {
    ...(shapes as Record<string, unknown>).cbaViz as object,
    ProviderShape,
  },
})
