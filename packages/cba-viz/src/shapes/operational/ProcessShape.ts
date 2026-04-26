import { dia, shapes } from '@joint/plus'

/**
 * Custom shape for Operational Processes — multi-step SOPs orchestrated
 * by an operator (Role/Person). Renders as a wide indigo rounded rect
 * with a step-count badge so a glance over the canvas tells you which
 * processes are simple vs. multi-stage. The detailed step list lives in
 * the inspector, not on the canvas.
 */
export const ProcessShape = dia.Element.define('cbaViz.ProcessShape', {
  size: { width: 200, height: 48 },
  markup: [{
    tagName: 'rect',
    selector: 'body',
  }, {
    tagName: 'text',
    selector: 'label',
  }, {
    tagName: 'text',
    selector: 'stepLabel',
  }],
  attrs: {
    body: {
      width: 'calc(w)',
      height: 'calc(h)',
      rx: 6,
      ry: 6,
      fill: 'rgba(99, 102, 241, 0.15)',
      stroke: '#6366f1',
      strokeWidth: 2,
      cursor: 'move',
    },
    label: {
      text: 'Process',
      x: 14,
      y: 'calc(h/2 - 6)',
      textAnchor: 'start',
      textVerticalAnchor: 'middle',
      fill: '#c7d2fe',
      fontSize: 12,
      fontWeight: '700',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    },
    stepLabel: {
      text: '',
      x: 14,
      y: 'calc(h/2 + 10)',
      textAnchor: 'start',
      textVerticalAnchor: 'middle',
      fill: '#a5b4fc',
      fontSize: 10,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    },
  },
})

Object.assign(shapes, {
  cbaViz: {
    ...(shapes as Record<string, unknown>).cbaViz as object,
    ProcessShape,
  },
})
