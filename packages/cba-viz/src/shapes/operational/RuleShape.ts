import { dia, shapes } from '@joint/plus'

/**
 * Custom shape for Operational Rules — small hexagonal annotations
 * orbiting a Capability. Rules are visual satellites, not primary
 * actors: the canvas reads "Capability with rules attached" rather
 * than "capability AND rules as peers".
 *
 * Color encodes type: amber for `access` rules (who may perform the
 * capability), cyan for `condition` rules (what must be true before it
 * runs). Set `type` via `attrs.body.class` on create so the mapper can
 * switch stroke color per rule.
 *
 * The hexagon is drawn with an SVG path rather than a rect so it reads
 * as a gate/check rather than a block.
 */
export const RuleShape = dia.Element.define('cbaViz.RuleShape', {
  size: { width: 36, height: 32 },
  markup: [{
    tagName: 'polygon',
    selector: 'body',
  }, {
    tagName: 'text',
    selector: 'label',
  }],
  attrs: {
    body: {
      // Hexagon pointing right — calc() isn't supported for polygon points
      // in JointJS, so the shape is defined for a fixed 36x32 box. The
      // mapper should create instances at that size.
      points: '8,0 28,0 36,16 28,32 8,32 0,16',
      fill: 'rgba(245, 158, 11, 0.15)',
      stroke: '#f59e0b',
      strokeWidth: 1.5,
      cursor: 'move',
    },
    label: {
      text: 'R',
      x: 18,
      y: 18,
      textAnchor: 'middle',
      textVerticalAnchor: 'middle',
      fill: '#fcd34d',
      fontSize: 11,
      fontWeight: '700',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    },
  },
})

Object.assign(shapes, {
  cbaViz: {
    ...(shapes as Record<string, unknown>).cbaViz as object,
    RuleShape,
  },
})

/**
 * Per-type color palette for Rule shapes. The mapper picks the palette
 * at construction time because polygon fills can't be calc'd from a type
 * attribute — we override `body.fill` + `body.stroke` + `label.fill` at
 * instance creation instead.
 */
export const RULE_COLORS = {
  access: {
    fill: 'rgba(245, 158, 11, 0.15)',
    stroke: '#f59e0b',
    textFill: '#fcd34d',
  },
  condition: {
    fill: 'rgba(34, 211, 238, 0.15)',
    stroke: '#22d3ee',
    textFill: '#67e8f9',
  },
} as const
