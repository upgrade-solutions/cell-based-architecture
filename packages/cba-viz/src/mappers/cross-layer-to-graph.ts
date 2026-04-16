import { dia, shapes } from '@joint/plus'
import type {
  OperationalDNA,
  Capability,
  Rule,
  Outcome,
} from '../loaders/operational-loader.ts'
import type {
  ProductApiDNA,
  ProductUiDNA,
  Operation,
  Endpoint,
  Page,
  Block,
} from '../loaders/product-loader.ts'
import { CapabilityShape } from '../shapes/operational/CapabilityShape.ts'
import { RuleShape, RULE_COLORS } from '../shapes/operational/RuleShape.ts'
import { OutcomeShape } from '../shapes/operational/OutcomeShape.ts'
import { ResourceShape } from '../shapes/product/ResourceShape.ts'
import { EndpointShape, METHOD_COLORS } from '../shapes/product/EndpointShape.ts'
import { PageShape } from '../shapes/product/PageShape.ts'
import { BlockShape, BLOCK_TYPE_LABELS } from '../shapes/product/BlockShape.ts'
import { ZoneContainer } from '../shapes/ZoneContainer.ts'

// ── Cross-layer element IDs ────────────────────────────────────────────
//
// Prefixed with `xl:` so they can't collide with the per-layer canvases'
// element IDs. The cross-layer canvas is a separate graph instance, so
// collision is theoretical — but prefixed IDs also make it obvious at
// a glance which canvas an ID came from when reading logs or diffs.

export const XL_ID = {
  band: (name: string) => `xl:band:${name}`,
  capability: (uuid: string) => `xl:capability:${uuid}`,
  rule: (capUuid: string, i: number) => `xl:rule:${capUuid}:${i}`,
  outcome: (capUuid: string, i: number) => `xl:outcome:${capUuid}:${i}`,
  operation: (uuid: string) => `xl:operation:${uuid}`,
  endpoint: (uuid: string) => `xl:endpoint:${uuid}`,
  page: (uuid: string) => `xl:page:${uuid}`,
  block: (pageUuid: string, i: number) => `xl:block:${pageUuid}:${i}`,
}

// ── Layout geometry ────────────────────────────────────────────────────
//
// Three horizontal bands, one per DNA surface. Each band is a zone
// container with a recognizable color; primitives belonging to the
// selected capability live inside their band and relate across bands
// via thin dashed edges.

const BAND_WIDTH = 1100
const BAND_HEIGHT = 200
const BAND_GAP = 24
const BAND_TOP_PAD = 56

const OPERATIONAL_Y = 0
const PRODUCT_API_Y = BAND_HEIGHT + BAND_GAP
const PRODUCT_UI_Y = (BAND_HEIGHT + BAND_GAP) * 2

const CAPABILITY_SIZE = { width: 220, height: 44 }
const RULE_SIZE = { width: 36, height: 32 }
const OUTCOME_SIZE = { width: 32, height: 32 }
const OPERATION_SIZE = { width: 220, height: 44 }
const ENDPOINT_SIZE = { width: 260, height: 26 }
const PAGE_SIZE = { width: 200, height: 60 }
const BLOCK_SIZE = { width: 180, height: 28 }

// Cross-layer edge style — dashed grey, subtle. The shape color lives
// in the node; edges only express relationships, not type.
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
 * Build a capability-centric graph that spans Operational → Product API
 * → Product UI. Reuses the per-layer shapes so clicking any node opens
 * its normal RJSF inspector form via the sidebar's (layer, kind) routing.
 *
 * When `capabilityName` is null, returns an empty array. The canvas
 * component shows an empty-state message and the picker chip.
 *
 * When a layer's DNA is missing (load failure or domain without that
 * file), the corresponding band is omitted — the mapper fails open so
 * partial data still renders something useful.
 */
export function crossLayerToGraphCells(input: CrossLayerInput): dia.Cell[] {
  const { operationalDna, productApiDna, productUiDna, capabilityName } = input
  if (!capabilityName) return []

  const cells: dia.Cell[] = []

  // ── Operational band ──
  const capability = (operationalDna.capabilities ?? []).find(
    (c) => (c.name ?? `${c.noun}.${c.verb}`) === capabilityName,
  )
  const rules = (operationalDna.rules ?? []).filter((r) => r.capability === capabilityName)
  const outcomes = (operationalDna.outcomes ?? []).filter((o) => o.capability === capabilityName)

  const opBand = createBand('operational', 'OPERATIONAL', 0, OPERATIONAL_Y, '#10b981', 'rgba(16, 185, 129, 0.06)', '#6ee7b7')
  cells.push(opBand)

  let capabilityEl: dia.Element | null = null
  if (capability) {
    capabilityEl = createCapability(capability, capabilityName, 24, OPERATIONAL_Y + BAND_TOP_PAD, rules.length, outcomes.length)
    cells.push(capabilityEl)
    opBand.embed(capabilityEl)

    // Rule + outcome satellites, horizontally centered on the capability row
    const satelliteY = OPERATIONAL_Y + BAND_TOP_PAD + (CAPABILITY_SIZE.height - RULE_SIZE.height) / 2
    const satelliteX = 24 + CAPABILITY_SIZE.width + 24

    rules.forEach((rule, i) => {
      const rx = satelliteX + i * (RULE_SIZE.width + 8)
      const el = createRule(rule, capability.id!, i, rx, satelliteY)
      cells.push(el)
      opBand.embed(el)
    })

    const outcomeStartX = satelliteX + rules.length * (RULE_SIZE.width + 8) + (rules.length > 0 ? 16 : 0)
    outcomes.forEach((outcome, i) => {
      const ox = outcomeStartX + i * (OUTCOME_SIZE.width + 8)
      const el = createOutcome(outcome, capability.id!, i, ox, satelliteY)
      cells.push(el)
      opBand.embed(el)
    })
  } else {
    // Capability doesn't exist in operational DNA — show a message inside
    // the band so the user understands why the rest is empty.
    const placeholder = createMissingCapabilityBanner(capabilityName, OPERATIONAL_Y + BAND_TOP_PAD)
    cells.push(placeholder)
    opBand.embed(placeholder)
  }

  // ── Product API band ──
  let operationEl: dia.Element | null = null
  const endpointEls: dia.Element[] = []

  if (productApiDna) {
    const apiBand = createBand('product-api', 'PRODUCT API', 0, PRODUCT_API_Y, '#6366f1', 'rgba(99, 102, 241, 0.06)', '#a5b4fc')
    cells.push(apiBand)

    // Operations that map to this capability
    const matchingOperations: Operation[] = (productApiDna.operations ?? []).filter(
      (o) => o.capability === capabilityName || (o.name ?? `${o.resource}.${o.action}`) === capabilityName,
    )

    // Endpoints that reference those operations (by operation name)
    const operationNames = new Set(matchingOperations.map((o) => o.name ?? `${o.resource}.${o.action}`))
    const matchingEndpoints: Endpoint[] = (productApiDna.endpoints ?? []).filter(
      (e) => operationNames.has(e.operation) || e.operation === capabilityName,
    )

    if (matchingOperations.length > 0 || matchingEndpoints.length > 0) {
      // Pick the primary operation to represent the capability in this
      // band. If we have multiple matching operations (rare — there's
      // usually one), render the first and annotate the count.
      const primary = matchingOperations[0]
      const primaryName = primary?.name ?? (matchingEndpoints[0]?.operation ?? capabilityName)
      const primaryUuid = primary?.id ?? primaryName
      operationEl = createOperation(primaryUuid, primaryName, matchingOperations.length, 24, PRODUCT_API_Y + BAND_TOP_PAD)
      cells.push(operationEl)
      apiBand.embed(operationEl)

      const endpointStartX = 24 + OPERATION_SIZE.width + 32
      matchingEndpoints.forEach((endpoint, i) => {
        // Endpoints stack in a vertical mini-column next to the operation
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

    // Blocks whose operation matches the capability (operations in
    // product UI are the same Resource.Action form as operational's
    // Noun.Verb when the materializer has mapped them 1:1).
    //
    // We also match the operation through product API → so a block
    // referencing "Loan.Approve" lights up whether or not product-core
    // has renamed the operation.
    const pageByBlock = new Map<Block, Page>()
    const matchingBlocks: Block[] = []
    for (const page of productUiDna.pages ?? []) {
      for (const block of page.blocks ?? []) {
        if (!block.operation) continue
        if (block.operation === capabilityName) {
          matchingBlocks.push(block)
          pageByBlock.set(block, page)
        }
      }
    }

    if (matchingBlocks.length > 0) {
      // Render one Block per column, with its parent Page above it.
      // Pages can be shared across blocks — we dedupe.
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

      // Blocks sit below their page, indexed by insertion order on the
      // block's parent page (so the block id matches product-ui-to-graph
      // and the inspector form round-trips cleanly if we ever add edits
      // to cross-layer).
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
      const placeholder = createNoMatchesBanner(`No pages or blocks bound to ${capabilityName}`, PRODUCT_UI_Y + BAND_TOP_PAD)
      cells.push(placeholder)
      uiBand.embed(placeholder)
    }
  }

  // ── Cross-layer edges ──
  // Built after all elements exist so the source/target lookups succeed.
  if (capabilityEl && operationEl) {
    cells.push(createCrossEdge(capabilityEl.id as string, operationEl.id as string, 'api'))
  }
  if (operationEl) {
    for (const ep of endpointEls) {
      cells.push(createCrossEdge(operationEl.id as string, ep.id as string))
    }
  }
  if (capabilityEl) {
    // Operational Capability directly links to each Block whose
    // operation matches — we skip the intermediate Operation on the UI
    // side because product-ui blocks reference operations by name, not
    // via a separate Operation node in the UI document.
    for (const blockEl of blockEls) {
      cells.push(createCrossEdge(capabilityEl.id as string, blockEl.id as string, 'ui'))
    }
  }
  // Block ↔ Page is an implicit containment relation; we draw it as a
  // thin internal link so the canvas reads "this block lives on this
  // page".
  for (const blockEl of blockEls) {
    // The block id encodes the page UUID: `xl:block:<pageUuid>:<i>`
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
  // Bands aren't editable — no dna.layer stamp so the inspector
  // ignores clicks on them (falls through to the empty-state section).
  el.set('dna', { kind: 'band', id: XL_ID.band(key), name: label })
  return el
}

function createCapability(
  cap: Capability,
  capName: string,
  x: number,
  y: number,
  ruleCount: number,
  outcomeCount: number,
): dia.Element {
  const badges: string[] = []
  if (ruleCount > 0) badges.push(`R:${ruleCount}`)
  if (outcomeCount > 0) badges.push(`O:${outcomeCount}`)
  const xlId = XL_ID.capability(cap.id!)
  const el = new CapabilityShape({
    id: xlId,
    position: { x, y },
    size: CAPABILITY_SIZE,
    attrs: {
      label: { text: capName },
      badges: { text: badges.join('  ') },
    },
  })
  el.set('z', 2)
  el.set('dna', {
    kind: 'capability',
    id: xlId,
    layer: 'operational',
    name: capName,
    description: cap.description,
    source: cap,
  })
  return el
}

function createRule(rule: Rule, capUuid: string, idx: number, x: number, y: number): dia.Element {
  const colors = RULE_COLORS[rule.type ?? 'access']
  const xlId = XL_ID.rule(capUuid, idx)
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
    name: `${rule.capability} ${rule.type ?? 'access'}`,
    description: rule.description,
    source: rule,
  })
  return el
}

function createOutcome(outcome: Outcome, capUuid: string, idx: number, x: number, y: number): dia.Element {
  const xlId = XL_ID.outcome(capUuid, idx)
  const el = new OutcomeShape({
    id: xlId,
    position: { x, y },
    size: OUTCOME_SIZE,
  })
  el.set('z', 2)
  el.set('dna', {
    kind: 'outcome',
    id: xlId,
    layer: 'operational',
    name: `${outcome.capability} outcome`,
    description: outcome.description,
    source: outcome,
  })
  return el
}

function createOperation(uuid: string, name: string, count: number, x: number, y: number): dia.Element {
  const badge = count > 1 ? `${count} ops` : ''
  const xlId = XL_ID.operation(uuid)
  const el = new ResourceShape({
    id: xlId,
    position: { x, y },
    size: OPERATION_SIZE,
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

/** In-band placeholder used when a capability doesn't exist in operational DNA. */
function createMissingCapabilityBanner(capName: string, y: number): dia.Element {
  const el = new shapes.standard.Rectangle({
    id: `xl:banner:missing`,
    position: { x: 24, y },
    size: { width: 400, height: 40 },
    attrs: {
      body: { fill: 'rgba(239, 68, 68, 0.08)', stroke: '#ef4444', strokeWidth: 1, rx: 4, ry: 4 },
      label: {
        text: `Capability "${capName}" not found in operational DNA`,
        fill: '#fca5a5',
        fontSize: 11,
        fontFamily: '-apple-system, sans-serif',
      },
    },
  })
  el.set('z', 2)
  return el
}

/** In-band placeholder used when a layer has no matches for the capability. */
function createNoMatchesBanner(message: string, y: number): dia.Element {
  const el = new shapes.standard.Rectangle({
    id: `xl:banner:nomatch:${y}`,
    position: { x: 24, y },
    size: { width: 420, height: 32 },
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

/** Thin dashed cross-layer link. Optional label for disambiguation. */
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
