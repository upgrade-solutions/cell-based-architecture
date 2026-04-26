import { dia, shapes } from '@joint/plus'
import type {
  OperationalDNA,
  Operation as OpOperation,
  Rule,
} from '../loaders/operational-loader.ts'
import type {
  ProductApiDNA,
  ProductUiDNA,
  Operation,
  Endpoint,
  Page,
  Block,
} from '../loaders/product-loader.ts'
import { OperationShape } from '../shapes/operational/OperationShape.ts'
import { RuleShape, RULE_COLORS } from '../shapes/operational/RuleShape.ts'
import { ResourceShape } from '../shapes/product/ResourceShape.ts'
import { EndpointShape, METHOD_COLORS } from '../shapes/product/EndpointShape.ts'
import { PageShape } from '../shapes/product/PageShape.ts'
import { BlockShape, BLOCK_TYPE_LABELS } from '../shapes/product/BlockShape.ts'
import { ZoneContainer } from '../shapes/ZoneContainer.ts'

// ── Cross-layer element IDs ────────────────────────────────────────────

export const XL_ID = {
  band: (name: string) => `xl:band:${name}`,
  operation: (uuid: string) => `xl:operation:${uuid}`,
  rule: (opUuid: string, i: number) => `xl:rule:${opUuid}:${i}`,
  apiOperation: (uuid: string) => `xl:apiop:${uuid}`,
  endpoint: (uuid: string) => `xl:endpoint:${uuid}`,
  page: (uuid: string) => `xl:page:${uuid}`,
  block: (pageUuid: string, i: number) => `xl:block:${pageUuid}:${i}`,
}

// ── Layout geometry ────────────────────────────────────────────────────

const BAND_WIDTH = 1100
const BAND_HEIGHT = 200
const BAND_GAP = 24
const BAND_TOP_PAD = 56

const OPERATIONAL_Y = 0
const PRODUCT_API_Y = BAND_HEIGHT + BAND_GAP
const PRODUCT_UI_Y = (BAND_HEIGHT + BAND_GAP) * 2

const OP_SIZE = { width: 220, height: 44 }
const RULE_SIZE = { width: 36, height: 32 }
const API_OP_SIZE = { width: 220, height: 44 }
const ENDPOINT_SIZE = { width: 260, height: 26 }
const PAGE_SIZE = { width: 200, height: 60 }
const BLOCK_SIZE = { width: 180, height: 28 }

const XL_EDGE = {
  stroke: '#64748b',
  strokeWidth: 1.25,
  strokeDasharray: '5,4',
  strokeOpacity: 0.55,
}

// ── Entry point ────────────────────────────────────────────────────────

interface CrossLayerInput {
  operationalDna: OperationalDNA
  productApiDna: ProductApiDNA | null
  productUiDna: ProductUiDNA | null
  /** e.g. "Loan.Approve". Null → empty canvas. */
  capabilityName: string | null
}

/**
 * Build an operation-centric graph that spans Operational → Product API
 * → Product UI. Renamed conceptually from "capability" to "operation"
 * — the prop is still called `capabilityName` for back-compat with the
 * URL ?cap= query param, but it's the operation's `Target.Action` name.
 */
export function crossLayerToGraphCells(input: CrossLayerInput): dia.Cell[] {
  const { operationalDna, productApiDna, productUiDna, capabilityName } = input
  if (!capabilityName) return []

  const cells: dia.Cell[] = []
  const operationName = capabilityName

  // ── Operational band ──
  const operation = (operationalDna.operations ?? []).find(
    (o) => o.name === operationName,
  )
  const rules = (operationalDna.rules ?? []).filter((r) => r.operation === operationName)

  const opBand = createBand('operational', 'OPERATIONAL', 0, OPERATIONAL_Y, '#10b981', 'rgba(16, 185, 129, 0.06)', '#6ee7b7')
  cells.push(opBand)

  let operationEl: dia.Element | null = null
  if (operation) {
    operationEl = createOperation(operation, operationName, 24, OPERATIONAL_Y + BAND_TOP_PAD, rules.length, operation.changes?.length ?? 0)
    cells.push(operationEl)
    opBand.embed(operationEl)

    const satelliteY = OPERATIONAL_Y + BAND_TOP_PAD + (OP_SIZE.height - RULE_SIZE.height) / 2
    const satelliteX = 24 + OP_SIZE.width + 24

    rules.forEach((rule, i) => {
      const rx = satelliteX + i * (RULE_SIZE.width + 8)
      const el = createRule(rule, operation.id!, i, rx, satelliteY)
      cells.push(el)
      opBand.embed(el)
    })
  } else {
    const placeholder = createMissingBanner(`Operation "${operationName}" not found in operational DNA`, OPERATIONAL_Y + BAND_TOP_PAD)
    cells.push(placeholder)
    opBand.embed(placeholder)
  }

  // ── Product API band ──
  let apiOpEl: dia.Element | null = null
  const endpointEls: dia.Element[] = []

  if (productApiDna) {
    const apiBand = createBand('product-api', 'PRODUCT API', 0, PRODUCT_API_Y, '#6366f1', 'rgba(99, 102, 241, 0.06)', '#a5b4fc')
    cells.push(apiBand)

    // Operations whose target.action / name matches the operational op
    const matchingOperations: Operation[] = (productApiDna.operations ?? []).filter(
      (o) =>
        (o.name ?? `${o.target ?? o.resource ?? ''}.${o.action}`) === operationName ||
        o.name === operationName,
    )

    const operationNames = new Set(
      matchingOperations.map((o) => o.name ?? `${o.target ?? o.resource ?? ''}.${o.action}`),
    )
    const matchingEndpoints: Endpoint[] = (productApiDna.endpoints ?? []).filter(
      (e) => operationNames.has(e.operation) || e.operation === operationName,
    )

    if (matchingOperations.length > 0 || matchingEndpoints.length > 0) {
      const primary = matchingOperations[0]
      const primaryName =
        primary?.name ??
        matchingEndpoints[0]?.operation ??
        operationName
      const primaryUuid = primary?.id ?? primaryName
      apiOpEl = createApiOperation(primaryUuid, primaryName, matchingOperations.length, 24, PRODUCT_API_Y + BAND_TOP_PAD)
      cells.push(apiOpEl)
      apiBand.embed(apiOpEl)

      const endpointStartX = 24 + API_OP_SIZE.width + 32
      matchingEndpoints.forEach((endpoint, i) => {
        const epY = PRODUCT_API_Y + BAND_TOP_PAD + i * (ENDPOINT_SIZE.height + 6)
        const epEl = createEndpoint(endpoint, endpointStartX, epY)
        cells.push(epEl)
        endpointEls.push(epEl)
        apiBand.embed(epEl)
      })
    } else {
      const placeholder = createNoMatchesBanner('No matching operations or endpoints', PRODUCT_API_Y + BAND_TOP_PAD)
      cells.push(placeholder)
      apiBand.embed(placeholder)
    }
  }

  // ── Product UI band ──
  const blockEls: dia.Element[] = []
  const pageEls: dia.Element[] = []

  if (productUiDna) {
    const uiBand = createBand('product-ui', 'PRODUCT UI', 0, PRODUCT_UI_Y, '#a855f7', 'rgba(168, 85, 247, 0.06)', '#d8b4fe')
    cells.push(uiBand)

    const pageByBlock = new Map<Block, Page>()
    const matchingBlocks: Block[] = []
    for (const page of productUiDna.pages ?? []) {
      for (const block of page.blocks ?? []) {
        if (!block.operation) continue
        if (block.operation === operationName) {
          matchingBlocks.push(block)
          pageByBlock.set(block, page)
        }
      }
    }

    if (matchingBlocks.length > 0) {
      const pagesNeeded = Array.from(new Set(matchingBlocks.map((b) => pageByBlock.get(b)!.name)))
        .map((name) => (productUiDna.pages ?? []).find((p) => p.name === name)!)
        .filter(Boolean)

      const pageX = 24
      pagesNeeded.forEach((page, i) => {
        const px = pageX + i * (PAGE_SIZE.width + 40)
        const el = createPage(page, px, PRODUCT_UI_Y + BAND_TOP_PAD)
        cells.push(el)
        pageEls.push(el)
        uiBand.embed(el)
      })

      const blocksByPageName = new Map<string, Block[]>()
      for (const block of matchingBlocks) {
        const pageName = pageByBlock.get(block)!.name
        const list = blocksByPageName.get(pageName) ?? []
        list.push(block)
        blocksByPageName.set(pageName, list)
      }

      pagesNeeded.forEach((page, i) => {
        const blocks = blocksByPageName.get(page.name) ?? []
        blocks.forEach((block, bi) => {
          const originalIdx = (page.blocks ?? []).findIndex((b) => b === block)
          const bx = pageX + i * (PAGE_SIZE.width + 40) + 10
          const by = PRODUCT_UI_Y + BAND_TOP_PAD + PAGE_SIZE.height + 16 + bi * (BLOCK_SIZE.height + 6)
          const el = createBlock(block, page.id!, originalIdx, bx, by)
          cells.push(el)
          blockEls.push(el)
          uiBand.embed(el)
        })
      })
    } else {
      const placeholder = createNoMatchesBanner(`No pages or blocks bound to ${operationName}`, PRODUCT_UI_Y + BAND_TOP_PAD)
      cells.push(placeholder)
      uiBand.embed(placeholder)
    }
  }

  // ── Cross-layer edges ──
  if (operationEl && apiOpEl) {
    cells.push(createCrossEdge(operationEl.id as string, apiOpEl.id as string, 'api'))
  }
  if (apiOpEl) {
    for (const ep of endpointEls) {
      cells.push(createCrossEdge(apiOpEl.id as string, ep.id as string))
    }
  }
  if (operationEl) {
    for (const blockEl of blockEls) {
      cells.push(createCrossEdge(operationEl.id as string, blockEl.id as string, 'ui'))
    }
  }
  for (const blockEl of blockEls) {
    const id = blockEl.id as string
    const m = id.match(/^xl:block:(.+):\d+$/)
    if (!m) continue
    const pageId = XL_ID.page(m[1])
    const pageEl = pageEls.find((p) => p.id === pageId)
    if (pageEl) {
      cells.push(createCrossEdge(pageEl.id as string, blockEl.id as string))
    }
  }

  return cells
}

// ── Band + element factories ───────────────────────────────────────────

function createBand(
  key: string,
  label: string,
  x: number,
  y: number,
  stroke: string,
  fill: string,
  textFill: string,
): dia.Element {
  const el = new ZoneContainer({
    id: XL_ID.band(key),
    position: { x, y },
    size: { width: BAND_WIDTH, height: BAND_HEIGHT },
    attrs: {
      body: { fill, stroke, strokeWidth: 2 },
      headerBg: { fill: fill.replace(/[\d.]+\)$/, (m) => {
        const alpha = parseFloat(m.slice(0, -1))
        return `${Math.min(alpha * 3, 0.22).toFixed(2)})`
      }) },
      label: { text: label, fill: textFill },
    },
  })
  el.set('z', 0)
  el.set('dna', { kind: 'band', id: XL_ID.band(key), name: label })
  return el
}

function createOperation(
  op: OpOperation,
  opName: string,
  x: number,
  y: number,
  ruleCount: number,
  changeCount: number,
): dia.Element {
  const badges: string[] = []
  if (ruleCount > 0) badges.push(`R:${ruleCount}`)
  if (changeCount > 0) badges.push(`Δ:${changeCount}`)
  const xlId = XL_ID.operation(op.id!)
  const el = new OperationShape({
    id: xlId,
    position: { x, y },
    size: OP_SIZE,
    attrs: {
      label: { text: opName },
      badges: { text: badges.join('  ') },
    },
  })
  el.set('z', 2)
  el.set('dna', {
    kind: 'operation',
    id: xlId,
    layer: 'operational',
    name: opName,
    description: op.description,
    source: op,
  })
  return el
}

function createRule(rule: Rule, opUuid: string, idx: number, x: number, y: number): dia.Element {
  const colors = RULE_COLORS[rule.type ?? 'access']
  const xlId = XL_ID.rule(opUuid, idx)
  const el = new RuleShape({
    id: xlId,
    position: { x, y },
    size: RULE_SIZE,
    attrs: {
      body: { fill: colors.fill, stroke: colors.stroke },
      label: { text: rule.type === 'condition' ? 'C' : 'R', fill: colors.textFill },
    },
  })
  el.set('z', 2)
  el.set('dna', {
    kind: 'rule',
    id: xlId,
    layer: 'operational',
    name: rule.name ?? `${rule.operation} ${rule.type ?? 'access'}`,
    description: rule.description,
    source: rule,
  })
  return el
}

function createApiOperation(uuid: string, name: string, count: number, x: number, y: number): dia.Element {
  const badge = count > 1 ? `${count} ops` : ''
  const xlId = XL_ID.apiOperation(uuid)
  const el = new ResourceShape({
    id: xlId,
    position: { x, y },
    size: API_OP_SIZE,
    attrs: {
      label: { text: name },
      countLabel: { text: badge },
    },
  })
  el.set('z', 2)
  el.set('dna', {
    kind: 'operation',
    id: xlId,
    layer: 'product-api',
    name,
  })
  return el
}

function createEndpoint(endpoint: Endpoint, x: number, y: number): dia.Element {
  const methodColor = METHOD_COLORS[endpoint.method] ?? '#64748b'
  const xlId = XL_ID.endpoint(endpoint.id!)
  const el = new EndpointShape({
    id: xlId,
    position: { x, y },
    size: ENDPOINT_SIZE,
    attrs: {
      methodBadge: { fill: methodColor },
      methodLabel: { text: endpoint.method },
      pathLabel: { text: endpoint.path },
    },
  })
  el.set('z', 2)
  el.set('dna', {
    kind: 'endpoint',
    id: xlId,
    layer: 'product-api',
    name: `${endpoint.method} ${endpoint.path}`,
    description: endpoint.description,
    source: endpoint,
  })
  return el
}

function createPage(page: Page, x: number, y: number): dia.Element {
  const xlId = XL_ID.page(page.id!)
  const el = new PageShape({
    id: xlId,
    position: { x, y },
    size: PAGE_SIZE,
    attrs: {
      label: { text: page.name },
      resourceLabel: { text: page.resource },
    },
  })
  el.set('z', 2)
  el.set('dna', {
    kind: 'page',
    id: xlId,
    layer: 'product-ui',
    name: page.name,
    description: page.description,
    source: page,
  })
  return el
}

function createBlock(block: Block, pageUuid: string, originalIdx: number, x: number, y: number): dia.Element {
  const typeLabel = BLOCK_TYPE_LABELS[block.type] ?? block.type.slice(0, 4).toUpperCase()
  const xlId = XL_ID.block(pageUuid, originalIdx)
  const el = new BlockShape({
    id: xlId,
    position: { x, y },
    size: BLOCK_SIZE,
    attrs: {
      typeLabel: { text: typeLabel },
      nameLabel: { text: block.name },
    },
  })
  el.set('z', 2)
  el.set('dna', {
    kind: 'block',
    id: xlId,
    layer: 'product-ui',
    name: block.name,
    description: block.description,
    source: block,
  })
  return el
}

function createMissingBanner(message: string, y: number): dia.Element {
  const el = new shapes.standard.Rectangle({
    id: `xl:banner:missing`,
    position: { x: 24, y },
    size: { width: 480, height: 40 },
    attrs: {
      body: { fill: 'rgba(239, 68, 68, 0.08)', stroke: '#ef4444', strokeWidth: 1, rx: 4, ry: 4 },
      label: {
        text: message,
        fill: '#fca5a5',
        fontSize: 11,
        fontFamily: '-apple-system, sans-serif',
      },
    },
  })
  el.set('z', 2)
  return el
}

function createNoMatchesBanner(message: string, y: number): dia.Element {
  const el = new shapes.standard.Rectangle({
    id: `xl:banner:nomatch:${y}`,
    position: { x: 24, y },
    size: { width: 480, height: 32 },
    attrs: {
      body: { fill: 'rgba(100, 116, 139, 0.12)', stroke: '#475569', strokeWidth: 1, rx: 4, ry: 4, strokeDasharray: '3,3' },
      label: {
        text: message,
        fill: '#64748b',
        fontSize: 11,
        fontFamily: '-apple-system, sans-serif',
      },
    },
  })
  el.set('z', 2)
  return el
}

function createCrossEdge(sourceId: string, targetId: string, label?: string): shapes.standard.Link {
  const link = new shapes.standard.Link({
    source: { id: sourceId },
    target: { id: targetId },
    labels: label ? [{
      attrs: {
        text: {
          text: label,
          fill: '#94a3b8',
          fontSize: 9,
          fontFamily: '-apple-system, sans-serif',
        },
        rect: { fill: '#0f172a', stroke: 'none', rx: 3, ry: 3 },
      },
    }] : [],
    attrs: {
      line: {
        stroke: XL_EDGE.stroke,
        strokeWidth: XL_EDGE.strokeWidth,
        strokeDasharray: XL_EDGE.strokeDasharray,
        strokeOpacity: XL_EDGE.strokeOpacity,
        targetMarker: {
          type: 'path',
          d: 'M 8 -4 0 0 8 4 z',
          fill: XL_EDGE.stroke,
          fillOpacity: XL_EDGE.strokeOpacity,
        },
      },
    },
    router: { name: 'manhattan', args: { step: 20, padding: 16 } },
    connector: { name: 'rounded', args: { radius: 6 } },
  })
  link.set('z', 3)
  link.set('dna', { kind: 'cross-edge', layer: 'cross-layer' })
  return link
}
