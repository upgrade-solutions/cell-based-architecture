import { dia, shapes } from '@joint/plus'

/**
 * Custom shape for Product API Endpoints.
 *
 * An Endpoint is a single HTTP method+path pair (e.g. `GET /loans/:id`)
 * that maps to an Operation (Resource.Action). Visually it's a compact
 * pill showing the method as a colored prefix and the path as the body,
 * positioned as a satellite next to its owning Resource — mirroring the
 * rule/outcome satellite pattern on operational Capabilities.
 *
 * Method color encodes semantics (GET=grey/read, POST=green/create,
 * PATCH=indigo/modify, DELETE=rose/destroy). The mapper overrides the
 * `methodBadge.fill` per instance since JointJS calc() doesn't support
 * type-driven conditional fills.
 */
export const EndpointShape = dia.Element.define('cbaViz.EndpointShape', {
  size: { width: 180, height: 24 },
  markup: [{
    tagName: 'rect',
    selector: 'body',
  }, {
    tagName: 'rect',
    selector: 'methodBadge',
  }, {
    tagName: 'text',
    selector: 'methodLabel',
  }, {
    tagName: 'text',
    selector: 'pathLabel',
  }],
  attrs: {
    body: {
      width: 'calc(w)',
      height: 'calc(h)',
      rx: 4,
      ry: 4,
      fill: 'rgba(99, 102, 241, 0.08)',
      stroke: '#6366f1',
      strokeWidth: 1,
      cursor: 'move',
    },
    methodBadge: {
      width: 44,
      height: 'calc(h - 4)',
      x: 2,
      y: 2,
      rx: 3,
      ry: 3,
      fill: '#64748b',
      stroke: 'none',
    },
    methodLabel: {
      text: 'GET',
      x: 24,
      y: 'calc(h/2)',
      textAnchor: 'middle',
      textVerticalAnchor: 'middle',
      fill: '#f8fafc',
      fontSize: 9,
      fontWeight: '700',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    },
    pathLabel: {
      text: '/',
      x: 52,
      y: 'calc(h/2)',
      textAnchor: 'start',
      textVerticalAnchor: 'middle',
      fill: '#e0e7ff',
      fontSize: 10,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    },
  },
})

Object.assign(shapes, {
  cbaViz: {
    ...(shapes as Record<string, unknown>).cbaViz as object,
    EndpointShape,
  },
})

/**
 * Per-method color palette. The mapper applies these at instance time
 * because JointJS attrs don't branch on shape data — we override
 * `methodBadge.fill` per endpoint based on its HTTP verb.
 */
export const METHOD_COLORS: Record<string, string> = {
  GET:    '#64748b',  // slate — reads
  POST:   '#10b981',  // emerald — creates
  PUT:    '#6366f1',  // indigo — replaces
  PATCH:  '#8b5cf6',  // violet — partial updates
  DELETE: '#f43f5e',  // rose — destroys
}
