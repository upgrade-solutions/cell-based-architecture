import { dia, shapes } from '@joint/plus'

/**
 * Custom shape for Product UI Blocks.
 *
 * A Block is a named, reusable section within a Page (table, detail,
 * form, actions, etc.). Visually it's a compact rounded-rect satellite
 * orbiting its parent Page — mirrors the operational Rule/Outcome and
 * product-api Endpoint satellite patterns for consistency.
 *
 * Block.type drives two visible signals: a short type prefix (FORM /
 * TABL / DTL / ACT) and the body tint. Type coloring lets you scan a
 * page's block profile without reading labels — a page with three
 * tables looks visually different from one with a form and two
 * detail views.
 */
export const BlockShape = dia.Element.define('cbaViz.BlockShape', {
  size: { width: 160, height: 26 },
  markup: [{
    tagName: 'rect',
    selector: 'body',
  }, {
    tagName: 'rect',
    selector: 'typeBadge',
  }, {
    tagName: 'text',
    selector: 'typeLabel',
  }, {
    tagName: 'text',
    selector: 'nameLabel',
  }],
  attrs: {
    body: {
      width: 'calc(w)',
      height: 'calc(h)',
      rx: 4,
      ry: 4,
      fill: 'rgba(168, 85, 247, 0.08)',
      stroke: '#a855f7',
      strokeWidth: 1,
      cursor: 'move',
    },
    typeBadge: {
      width: 38,
      height: 'calc(h - 4)',
      x: 2,
      y: 2,
      rx: 3,
      ry: 3,
      fill: '#a855f7',
      stroke: 'none',
    },
    typeLabel: {
      text: 'BLK',
      x: 21,
      y: 'calc(h/2)',
      textAnchor: 'middle',
      textVerticalAnchor: 'middle',
      fill: '#f3e8ff',
      fontSize: 9,
      fontWeight: '700',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    },
    nameLabel: {
      text: '',
      x: 46,
      y: 'calc(h/2)',
      textAnchor: 'start',
      textVerticalAnchor: 'middle',
      fill: '#f3e8ff',
      fontSize: 10,
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    },
  },
})

Object.assign(shapes, {
  cbaViz: {
    ...(shapes as Record<string, unknown>).cbaViz as object,
    BlockShape,
  },
})

/**
 * Per-type abbreviated labels. The mapper picks the right one at
 * instance creation time — the schema enum for Block.type has 8
 * values so we keep labels to 3-4 chars to fit in the 38px badge.
 */
export const BLOCK_TYPE_LABELS: Record<string, string> = {
  list:          'LIST',
  detail:        'DTL',
  form:          'FORM',
  survey:        'SRVY',
  actions:       'ACT',
  table:         'TABL',
  summary:       'SUM',
  'empty-state': 'EMPT',
}
