import { dia, shapes } from '@joint/plus'

const ZONE_COLORS: Record<string, { stroke: string; fill: string; textFill: string }> = {
  tier:        { stroke: '#475569', fill: 'rgba(71, 85, 105, 0.08)', textFill: '#94a3b8' },
  // Generic boundary fallback — used when no id-specific color matches.
  boundary:    { stroke: '#ef4444', fill: 'rgba(239, 68, 68, 0.05)', textFill: '#fca5a5' },
  environment: { stroke: '#22c55e', fill: 'rgba(34, 197, 94, 0.05)', textFill: '#86efac' },
  domain:      { stroke: '#3b82f6', fill: 'rgba(59, 130, 246, 0.05)', textFill: '#93c5fd' },
  // Delivery-target boundary colors. Picked by id, not type — lets Docker
  // and AWS VPC share the `boundary` zone type but render distinctly so
  // a glance tells you whether you're looking at dev or prod.
  'delivery-docker': { stroke: '#3b82f6', fill: 'rgba(59, 130, 246, 0.06)', textFill: '#93c5fd' },
  'delivery-aws':    { stroke: '#f59e0b', fill: 'rgba(245, 158, 11, 0.06)', textFill: '#f59e0b' },
  // Operational layer domain zone — emerald to match CapabilityShape so a
  // domain and its capabilities read as one visual family.
  'domain-operational': { stroke: '#10b981', fill: 'rgba(16, 185, 129, 0.06)', textFill: '#6ee7b7' },
  // Product API namespace zone — indigo. Distinct from operational's
  // emerald so a glance tells you whether you're looking at business
  // logic (operational) or product surface (product API).
  'namespace-api': { stroke: '#6366f1', fill: 'rgba(99, 102, 241, 0.06)', textFill: '#a5b4fc' },
  // Product UI layout zone — violet. Same colorway as OutcomeShape
  // coincidentally (no conflict — layouts are zones, outcomes are
  // small primitives), and distinct from product-api's indigo so the
  // UI surface reads as a sibling-but-separate product layer.
  'layout-ui': { stroke: '#a855f7', fill: 'rgba(168, 85, 247, 0.06)', textFill: '#d8b4fe' },
}

/**
 * Custom container shape for Zones — dashed border with header label.
 */
export const ZoneContainer = dia.Element.define('cbaViz.ZoneContainer', {
  size: { width: 400, height: 200 },
  markup: [{
    tagName: 'rect',
    selector: 'body',
  }, {
    tagName: 'rect',
    selector: 'headerBg',
  }, {
    tagName: 'text',
    selector: 'label',
  }],
  attrs: {
    body: {
      width: 'calc(w)',
      height: 'calc(h)',
      rx: 8,
      ry: 8,
      fill: 'rgba(71, 85, 105, 0.08)',
      stroke: '#475569',
      strokeWidth: 1,
      // Solid border — dashes are reserved for 'proposed' nodes so that
      // a dashed outline is the unambiguous visual signal for "not yet
      // built," not an overloaded marker for "this is a container."
      cursor: 'move',
    },
    headerBg: {
      width: 'calc(w)',
      height: 28,
      fill: 'rgba(71, 85, 105, 0.15)',
      stroke: 'none',
      rx: 8,
      ry: 8,
    },
    label: {
      text: 'Zone',
      x: 12,
      y: 14,
      textAnchor: 'start',
      textVerticalAnchor: 'middle',
      fill: '#94a3b8',
      fontSize: 11,
      fontWeight: '700',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    },
  },
})

export { ZONE_COLORS }

Object.assign(shapes, {
  cbaViz: {
    ...(shapes as Record<string, unknown>).cbaViz as object,
    ZoneContainer,
  },
})
