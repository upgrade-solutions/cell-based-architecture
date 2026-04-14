import { dia, shapes } from '@joint/plus'

/**
 * Custom shape for Operational Signals — the cross-domain events
 * published when an Outcome completes. Signals are first-class
 * primitives (not satellite annotations like Rules/Outcomes) because
 * they cross domain boundaries and carry typed payload contracts that
 * other domains subscribe to.
 *
 * Diamond shape encodes "event" visually (follows common UML/BPMN
 * conventions for events and gateways). Rose color distinguishes them
 * from everything else in the palette — Nouns slate, Capabilities
 * emerald, Rules amber/cyan, Outcomes violet, Signals rose.
 */
export const SignalShape = dia.Element.define('cbaViz.SignalShape', {
  size: { width: 56, height: 56 },
  markup: [{
    tagName: 'polygon',
    selector: 'body',
  }, {
    tagName: 'text',
    selector: 'label',
  }],
  attrs: {
    body: {
      // Diamond — fixed 56x56 box. Mapper creates instances at that size.
      points: '28,2 54,28 28,54 2,28',
      fill: 'rgba(244, 63, 94, 0.15)',
      stroke: '#f43f5e',
      strokeWidth: 1.5,
      cursor: 'move',
    },
    label: {
      text: 'Signal',
      x: 28,
      y: 28,
      textAnchor: 'middle',
      textVerticalAnchor: 'middle',
      fill: '#fda4af',
      fontSize: 9,
      fontWeight: '700',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    },
  },
})

Object.assign(shapes, {
  cbaViz: {
    ...(shapes as Record<string, unknown>).cbaViz as object,
    SignalShape,
  },
})
