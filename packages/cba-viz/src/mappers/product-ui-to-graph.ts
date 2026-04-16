import { dia } from '@joint/plus'
import type {
  ProductUiDNA,
  Page,
  Block,
  Route,
} from '../loaders/product-loader.ts'
import { PageShape } from '../shapes/product/PageShape.ts'
import { BlockShape, BLOCK_TYPE_LABELS } from '../shapes/product/BlockShape.ts'
import { ZoneContainer } from '../shapes/ZoneContainer.ts'

// ── Stable IDs ─────────────────────────────────────────────────────────

export const PRODUCT_UI_ID = {
  layout: (name: string) => `layout:${name}`,
  page: (uuid: string) => `page:${uuid}`,
  block: (pageUuid: string, i: number) => `block:${pageUuid}:${i}`,
}

// ── Layout geometry ────────────────────────────────────────────────────
//
// Each Page gets a vertical lane inside the layout zone. Blocks
// stack below the page as satellites — same column-with-satellites
// metaphor as operational (Noun → Capability → Rules) and product
// API (Namespace → Resource → Endpoints). Routes are surfaced on
// the Page inspector only, not rendered as separate shapes — they're
// thin addressable wrappers, not enough to justify their own cells.

const LANE_WIDTH = 480
const LANE_TOP_PAD = 64
const PAGE_X = 24
const PAGE_Y = LANE_TOP_PAD
const PAGE_SIZE = { width: 220, height: 64 }
const BLOCK_X = 24
const BLOCK_FIRST_Y = LANE_TOP_PAD + PAGE_SIZE.height + 24
const BLOCK_SIZE = { width: 180, height: 26 }
const BLOCK_ROW_GAP = 32

// ── Entry point ────────────────────────────────────────────────────────

/**
 * Convert a Product UI DNA document into JointJS graph cells.
 *
 * Layout:
 *   1. Layout zone wraps the whole graph
 *   2. One Page card per page in document order
 *   3. Blocks for each page stack vertically below it
 *   4. Routes are collected per-page into the Page's `dna.routes`
 *      for the inspector; they don't render as their own shapes.
 *      This keeps the canvas readable when a product has 20+
 *      routes across 8 pages.
 */
export function productUiToGraphCells(dna: ProductUiDNA): dia.Cell[] {
  const cells: dia.Cell[] = []

  const pages = dna.pages ?? []
  const routes = dna.routes ?? []

  // Build a page → routes index. Each Route.page references a Page by
  // name; we attach the matching routes to the page's dna metadata so
  // the inspector form can show them without needing a separate shape.
  const routesByPage = new Map<string, Route[]>()
  for (const route of routes) {
    const list = routesByPage.get(route.page) ?? []
    list.push(route)
    routesByPage.set(route.page, list)
  }

  const pageCount = pages.length
  const totalWidth = Math.max(1, pageCount) * LANE_WIDTH + 48
  let totalHeight = LANE_TOP_PAD + PAGE_SIZE.height + 32

  pages.forEach((page, laneIdx) => {
    const laneX = laneIdx * LANE_WIDTH + 24

    const pageId = PRODUCT_UI_ID.page(page.id!)
    const pageEl = createPage(pageId, page, routesByPage.get(page.name) ?? [], laneX + PAGE_X, PAGE_Y)
    cells.push(pageEl)

    const blocks = page.blocks ?? []
    blocks.forEach((block, i) => {
      const by = BLOCK_FIRST_Y + i * BLOCK_ROW_GAP
      const bx = laneX + BLOCK_X
      const blockId = PRODUCT_UI_ID.block(page.id!, i)
      cells.push(createBlock(blockId, block, bx, by))

      const bottom = by + BLOCK_SIZE.height + 40
      if (bottom > totalHeight) totalHeight = bottom
    })
  })

  // Layout zone wrapping everything
  const layoutEl = createLayoutZone(dna, totalWidth, totalHeight)
  layoutEl.set('z', 0)

  for (const cell of cells) {
    if (cell.isElement()) {
      layoutEl.embed(cell as dia.Element)
      ;(cell as dia.Element).set('z', 2)
    }
  }

  return [layoutEl, ...cells]
}

// ── Element factories ──────────────────────────────────────────────────

function createLayoutZone(dna: ProductUiDNA, width: number, height: number): dia.Element {
  const layout = dna.layout
  const labelText = layout.type
    ? `${layout.name.toUpperCase()} · ${String(layout.type).toUpperCase()}`
    : layout.name.toUpperCase()
  const el = new ZoneContainer({
    id: PRODUCT_UI_ID.layout(layout.name),
    position: { x: 0, y: 0 },
    size: { width, height },
    attrs: {
      body: {
        fill: 'rgba(168, 85, 247, 0.06)',
        stroke: '#a855f7',
        strokeWidth: 2,
      },
      headerBg: {
        fill: 'rgba(168, 85, 247, 0.18)',
      },
      label: {
        text: labelText,
        fill: '#d8b4fe',
      },
    },
  })
  el.set('dna', {
    kind: 'layout',
    id: PRODUCT_UI_ID.layout(layout.name),
    layer: 'product-ui',
    name: layout.name,
    description: layout.description,
    source: layout,
  })
  return el
}

function createPage(id: string, page: Page, routes: Route[], x: number, y: number): dia.Element {
  const el = new PageShape({
    id,
    position: { x, y },
    size: PAGE_SIZE,
    attrs: {
      label: { text: page.name },
      resourceLabel: { text: page.resource },
    },
  })
  el.set('dna', {
    kind: 'page',
    id,
    layer: 'product-ui',
    name: page.name,
    description: page.description,
    source: page,
    // Attach matching routes as metadata — the inspector can show
    // them without needing a separate shape per route.
    routes,
  })
  return el
}

function createBlock(id: string, block: Block, x: number, y: number): dia.Element {
  const typeLabel = BLOCK_TYPE_LABELS[block.type] ?? block.type.slice(0, 4).toUpperCase()
  const el = new BlockShape({
    id,
    position: { x, y },
    size: BLOCK_SIZE,
    attrs: {
      typeLabel: { text: typeLabel },
      nameLabel: { text: block.name },
    },
  })
  el.set('dna', {
    kind: 'block',
    id,
    layer: 'product-ui',
    name: block.name,
    description: block.description,
    source: block,
  })
  return el
}
