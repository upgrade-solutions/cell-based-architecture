import { dia, shapes } from '@joint/plus'

/**
 * Custom shape for Product UI Pages.
 *
 * A Page is a discrete screen representing a Resource. Visually it's
 * a purple rounded rectangle — same card-with-count-badge metaphor
 * as NounShape and ResourceShape, just colored for the UI layer.
 * Showing the resource name inline helps a glance confirm "this page
 * renders that entity."
 */
export const PageShape = dia.Element.define('cbaViz.PageShape', {
  size: { width: 200, height: 64 },
  markup: [{
    tagName: 'rect',
    selector: 'body',
  }, {
    tagName: 'rect',
    selector: 'resourceBadge',
  }, {
    tagName: 'text',
    selector: 'label',
  }, {
    tagName: 'text',
    selector: 'resourceLabel',
  }],
  attrs: {
    body: {
      width: 'calc(w)',
      height: 'calc(h)',
      rx: 8,
      ry: 8,
      fill: 'rgba(168, 85, 247, 0.12)',
      stroke: '#a855f7',
      strokeWidth: 2,
      cursor: 'move',
    },
    resourceBadge: {
      width: 'calc(w - 16)',
      height: 16,
      x: 8,
      y: 'calc(h - 22)',
      rx: 3,
      ry: 3,
      fill: 'rgba(168, 85, 247, 0.22)',
      stroke: 'none',
    },
    label: {
      text: 'Page',
      x: 'calc(w/2)',
      y: 18,
      textAnchor: 'middle',
      textVerticalAnchor: 'middle',
      fill: '#f3e8ff',
      fontSize: 14,
      fontWeight: '700',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    },
    resourceLabel: {
      text: '',
      x: 'calc(w/2)',
      y: 'calc(h - 14)',
      textAnchor: 'middle',
      textVerticalAnchor: 'middle',
      fill: '#d8b4fe',
      fontSize: 10,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    },
  },
})

Object.assign(shapes, {
  cbaViz: {
    ...(shapes as Record<string, unknown>).cbaViz as object,
    PageShape,
  },
})
