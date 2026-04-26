import { dia, shapes } from '@joint/plus'

/**
 * Custom shapes for Operational noun primitives.
 *
 * The new operational model has FOUR noun primitives — Resource, Person,
 * Role, and Group — that share the `NounLike` shape (name, attributes[],
 * actions[]). All four render as a neutral-slate rounded rectangle with
 * a small "count" badge; they differ by stroke color so a glance over a
 * lane immediately tells you which kind of noun you're looking at.
 *
 * `ResourceShape` is the canonical noun shape; `PersonShape`, `RoleShape`,
 * `GroupShape` are color variants so the canvas-side mapper can pick the
 * right palette without conditionals scattered through the layout code.
 */

export const NOUN_PALETTE = {
  resource: { stroke: '#64748b', label: '#f8fafc', accent: '#cbd5e1' },
  person:   { stroke: '#fbbf24', label: '#fef3c7', accent: '#fde68a' },
  role:     { stroke: '#a78bfa', label: '#ede9fe', accent: '#c4b5fd' },
  group:    { stroke: '#34d399', label: '#d1fae5', accent: '#6ee7b7' },
} as const

export type NounKind = keyof typeof NOUN_PALETTE

function defineNounShape(typeName: string, palette: typeof NOUN_PALETTE[NounKind]) {
  return dia.Element.define(typeName, {
    size: { width: 160, height: 56 },
    markup: [{
      tagName: 'rect',
      selector: 'body',
    }, {
      tagName: 'rect',
      selector: 'countBadge',
    }, {
      tagName: 'text',
      selector: 'label',
    }, {
      tagName: 'text',
      selector: 'countLabel',
    }],
    attrs: {
      body: {
        width: 'calc(w)',
        height: 'calc(h)',
        rx: 8,
        ry: 8,
        fill: '#1e293b',
        stroke: palette.stroke,
        strokeWidth: 2,
        cursor: 'move',
      },
      countBadge: {
        width: 28,
        height: 14,
        x: 'calc(w - 34)',
        y: 'calc(h - 20)',
        rx: 3,
        ry: 3,
        fill: 'rgba(100, 116, 139, 0.25)',
        stroke: 'none',
      },
      label: {
        text: 'Noun',
        x: 'calc(w/2)',
        y: 'calc(h/2 - 4)',
        textAnchor: 'middle',
        textVerticalAnchor: 'middle',
        fill: palette.label,
        fontSize: 14,
        fontWeight: '700',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      },
      countLabel: {
        text: '',
        x: 'calc(w - 20)',
        y: 'calc(h - 13)',
        textAnchor: 'middle',
        textVerticalAnchor: 'middle',
        fill: palette.accent,
        fontSize: 9,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      },
    },
  })
}

// Note: type names are namespaced under `cbaViz.op` so they don't collide
// with the product layer's ResourceShape (registered at `cbaViz.ResourceShape`).
export const ResourceShape = defineNounShape('cbaViz.op.ResourceShape', NOUN_PALETTE.resource)
export const PersonShape   = defineNounShape('cbaViz.op.PersonShape',   NOUN_PALETTE.person)
export const RoleShape     = defineNounShape('cbaViz.op.RoleShape',     NOUN_PALETTE.role)
export const GroupShape    = defineNounShape('cbaViz.op.GroupShape',    NOUN_PALETTE.group)

/**
 * Backwards-compat alias. Existing call sites can still `new NounShape(...)`
 * and get a Resource-styled noun. New code should pick the variant
 * matching the noun primitive being rendered.
 */
export const NounShape = ResourceShape

Object.assign(shapes, {
  cbaViz: {
    ...(shapes as Record<string, unknown>).cbaViz as object,
    op: {
      ResourceShape,
      PersonShape,
      RoleShape,
      GroupShape,
    },
  },
})
