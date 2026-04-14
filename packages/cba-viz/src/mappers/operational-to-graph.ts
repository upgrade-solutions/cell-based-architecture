import { dia, shapes } from '@joint/plus'
import type {
  OperationalDNA,
  Domain,
  Noun,
  Capability,
  Rule,
  Outcome,
  Signal,
  OperationalLayout,
} from '../loaders/operational-loader.ts'
import { NounShape } from '../shapes/operational/NounShape.ts'
import { CapabilityShape } from '../shapes/operational/CapabilityShape.ts'
import { RuleShape, RULE_COLORS } from '../shapes/operational/RuleShape.ts'
import { OutcomeShape } from '../shapes/operational/OutcomeShape.ts'
import { SignalShape } from '../shapes/operational/SignalShape.ts'
import { ZoneContainer } from '../shapes/ZoneContainer.ts'

// ── Stable IDs for graph elements ──────────────────────────────────────
//
// Every graph element needs a stable id so drag-persisted layout can be
// re-applied on reload and so edges can target specific primitives. We
// use namespaced slug ids rather than UUIDs because Phase 1 writes
// positions back to operational.json — human-readable keys make the
// saved layouts[] section diff-friendly. Phase 5c.4 will migrate to
// opaque UUIDs when rename-safe identity becomes a real concern.

export const ID = {
  domain: (path: string) => `domain:${path}`,
  noun: (name: string) => `noun:${name}`,
  capability: (name: string) => `capability:${name}`,
  rule: (capability: string, i: number) => `rule:${capability}:${i}`,
  outcome: (capability: string, i: number) => `outcome:${capability}:${i}`,
  signal: (name: string) => `signal:${name}`,
}

// ── Layout geometry ────────────────────────────────────────────────────
//
// Each Noun gets a vertical "lane". Layout inside a lane:
//
//   ┌─ Noun ────┐
//   │           │
//   └───────────┘
//       │
//   ┌─ Capability ───────┐ ◆ R ◆ R  ■ O ■ O
//   └────────────────────┘
//       │
//   ┌─ Capability ───────┐ ◆ R       ■ O ■ O
//   └────────────────────┘
//       ⋮
//
// Rules and Outcomes are satellites to the right of each Capability,
// laid out in two rows (Rules above, Outcomes below) so a Capability's
// "R/O" profile is readable at a glance.
//
// Signals occupy their own far-right column — they're cross-domain events
// belonging to the whole graph, not any single Noun.

const LANE_WIDTH = 560           // horizontal space for one Noun-lane
const LANE_TOP_PAD = 64          // below the domain zone header
const NOUN_X = 24
const NOUN_Y = LANE_TOP_PAD
const NOUN_SIZE = { width: 180, height: 56 }
const CAPABILITY_X = 24
const CAPABILITY_FIRST_Y = LANE_TOP_PAD + NOUN_SIZE.height + 32
const CAPABILITY_SIZE = { width: 200, height: 40 }
const CAPABILITY_ROW_GAP = 56    // vertical gap between stacked capabilities
const SATELLITE_START_X = CAPABILITY_X + CAPABILITY_SIZE.width + 20
const RULE_SIZE = { width: 36, height: 32 }
const RULE_GAP = 6
const OUTCOME_SIZE = { width: 32, height: 32 }
const SIGNAL_COLUMN_OFFSET = 40  // added to rightmost lane's right edge
const SIGNAL_SIZE = { width: 56, height: 56 }
const SIGNAL_ROW_GAP = 24

// ── Entry point ────────────────────────────────────────────────────────

/**
 * Convert an Operational DNA document into JointJS graph cells.
 *
 * Layout strategy:
 *   1. Flatten domain hierarchy into leaf domains (only leaves hold nouns)
 *   2. Pick the first leaf domain that has any nouns as the primary render
 *      target. Multi-domain rendering is a Phase 5c.3 concern — for now
 *      we assume one leaf domain per document.
 *   3. Assign each noun a lane index based on the order they appear in
 *      the document.
 *   4. Place capabilities under their noun in document order.
 *   5. Attach rule + outcome satellites to their capability.
 *   6. Place signals in a right-side column.
 *   7. Wrap it all in a domain zone.
 *   8. Apply saved layout overlay if present.
 *   9. Create edges.
 */
export function operationalToGraphCells(dna: OperationalDNA): dia.Cell[] {
  const cells: dia.Cell[] = []

  const leaf = pickLeafDomain(dna.domain)
  if (!leaf || !leaf.nouns || leaf.nouns.length === 0) {
    // Empty domain — return a single placeholder zone so the canvas
    // doesn't render blank and the user sees *something*.
    cells.push(createDomainZone(dna.domain, 600, 200))
    return cells
  }

  const capabilitiesByNoun = groupCapabilitiesByNoun(dna.capabilities ?? [])
  const rulesByCapability = groupByCapability(dna.rules ?? [])
  const outcomesByCapability = groupByCapability(dna.outcomes ?? [])
  const savedLayout = pickLayout(dna.layouts)

  // Build elements
  const nounCount = leaf.nouns.length
  const signals = dna.signals ?? []
  const totalWidth = LANE_WIDTH * nounCount + (signals.length > 0 ? SIGNAL_COLUMN_OFFSET + SIGNAL_SIZE.width + 40 : 0) + 48
  let totalHeight = LANE_TOP_PAD + NOUN_SIZE.height + 32

  // Nouns + Capabilities + satellites per lane
  leaf.nouns.forEach((noun, laneIdx) => {
    const laneX = laneIdx * LANE_WIDTH + 24

    const nounId = ID.noun(noun.name)
    const nounEl = createNoun(nounId, noun, laneX + NOUN_X, NOUN_Y)
    cells.push(nounEl)

    const capNames = capabilitiesByNoun.get(noun.name) ?? []
    capNames.forEach((cap, capIdx) => {
      const capY = CAPABILITY_FIRST_Y + capIdx * CAPABILITY_ROW_GAP
      const capX = laneX + CAPABILITY_X

      const rules = rulesByCapability.get(cap.name ?? `${cap.noun}.${cap.verb}`) ?? []
      const outcomes = outcomesByCapability.get(cap.name ?? `${cap.noun}.${cap.verb}`) ?? []

      const capName = cap.name ?? `${cap.noun}.${cap.verb}`
      const capId = ID.capability(capName)
      const capEl = createCapability(capId, cap, capX, capY, rules.length, outcomes.length)
      cells.push(capEl)

      // Track the lane bottom
      const laneBottom = capY + CAPABILITY_SIZE.height
      if (laneBottom + 40 > totalHeight) totalHeight = laneBottom + 40

      // Rules satellite row (above the capability's center line)
      rules.forEach((rule, i) => {
        const rx = laneX + SATELLITE_START_X + i * (RULE_SIZE.width + RULE_GAP)
        const ry = capY + CAPABILITY_SIZE.height / 2 - RULE_SIZE.height - 2
        const ruleId = ID.rule(capName, i)
        cells.push(createRule(ruleId, rule, rx, ry))
      })

      // Outcomes satellite row (below the capability's center line)
      outcomes.forEach((outcome, i) => {
        const ox = laneX + SATELLITE_START_X + i * (OUTCOME_SIZE.width + RULE_GAP)
        const oy = capY + CAPABILITY_SIZE.height / 2 + 2
        const outcomeId = ID.outcome(capName, i)
        cells.push(createOutcome(outcomeId, outcome, ox, oy))
      })
    })
  })

  // Signals in a column to the right of all noun lanes
  const signalColumnX = nounCount * LANE_WIDTH + SIGNAL_COLUMN_OFFSET
  signals.forEach((signal, i) => {
    const sy = LANE_TOP_PAD + i * (SIGNAL_SIZE.height + SIGNAL_ROW_GAP)
    const signalId = ID.signal(signal.name)
    cells.push(createSignal(signalId, signal, signalColumnX, sy))
    const bottom = sy + SIGNAL_SIZE.height + 40
    if (bottom > totalHeight) totalHeight = bottom
  })

  // Domain zone wrapping everything — create last so z-order puts it behind
  // (we set explicit z below anyway). Use the leaf domain's path as the id
  // so saved layout can target it.
  const zoneEl = createDomainZone(leaf, totalWidth, totalHeight)
  zoneEl.set('z', 0)

  // Apply saved layout overlay (position + optional size). This runs
  // before embedding so the domain zone fits correctly around children.
  if (savedLayout) {
    applyLayoutOverlay(cells, savedLayout)
    applyLayoutOverlay([zoneEl], savedLayout)
  }

  // Embed children into the zone. Nouns, Capabilities, Rules, Outcomes,
  // and Signals all belong to the domain zone for Phase 1 (we don't yet
  // model per-noun sub-zones).
  for (const cell of cells) {
    if (cell.isElement()) {
      zoneEl.embed(cell as dia.Element)
      ;(cell as dia.Element).set('z', 2)
    }
  }

  // Prepend the zone so it renders first (z-order is also explicit)
  const result: dia.Cell[] = [zoneEl, ...cells]

  // ── Edges ──
  // Built after elements so the source/target ids all exist in the graph.
  for (const outcome of dna.outcomes ?? []) {
    const capName = outcome.capability
    const outcomes = outcomesByCapability.get(capName) ?? []
    const idx = outcomes.indexOf(outcome)
    if (idx < 0) continue
    const fromId = ID.outcome(capName, idx)

    // initiates → downstream capability (intra-domain, sync)
    for (const initiateName of outcome.initiates ?? []) {
      if (!hasElement(result, ID.capability(initiateName))) continue
      result.push(createEdge(fromId, ID.capability(initiateName), {
        type: 'initiate',
        label: 'initiates',
      }))
    }

    // emits → signal (cross-domain, async)
    for (const signalName of outcome.emits ?? []) {
      if (!hasElement(result, ID.signal(signalName))) continue
      result.push(createEdge(fromId, ID.signal(signalName), {
        type: 'emit',
        label: 'emits',
      }))
    }
  }

  // signal-triggered causes: Cause.source === 'signal' → capability
  for (const cause of dna.causes ?? []) {
    if (cause.source !== 'signal' || !cause.signal) continue
    if (!hasElement(result, ID.signal(cause.signal))) continue
    if (!hasElement(result, ID.capability(cause.capability))) continue
    result.push(createEdge(ID.signal(cause.signal), ID.capability(cause.capability), {
      type: 'trigger',
      label: 'triggers',
    }))
  }

  return result
}

// ── Element factories ──────────────────────────────────────────────────

function createDomainZone(domain: Domain, width: number, height: number): dia.Element {
  const el = new ZoneContainer({
    id: ID.domain(domain.path ?? domain.name),
    position: { x: 0, y: 0 },
    size: { width, height },
    attrs: {
      body: {
        fill: 'rgba(16, 185, 129, 0.06)',
        stroke: '#10b981',
        strokeWidth: 2,
      },
      headerBg: {
        fill: 'rgba(16, 185, 129, 0.18)',
      },
      label: {
        text: (domain.path ?? domain.name).toUpperCase(),
        fill: '#6ee7b7',
      },
    },
  })
  el.set('dna', {
    kind: 'domain',
    id: ID.domain(domain.path ?? domain.name),
    name: domain.name,
    path: domain.path,
    description: domain.description,
  })
  return el
}

function createNoun(id: string, noun: Noun, x: number, y: number): dia.Element {
  const attrCount = noun.attributes?.length ?? 0
  const el = new NounShape({
    id,
    position: { x, y },
    size: NOUN_SIZE,
    attrs: {
      label: { text: noun.name },
      countLabel: { text: attrCount > 0 ? `${attrCount} attr` : '' },
    },
  })
  el.set('dna', {
    kind: 'noun',
    id,
    layer: 'operational',
    name: noun.name,
    description: noun.description,
    source: noun,
  })
  return el
}

function createCapability(
  id: string,
  cap: Capability,
  x: number,
  y: number,
  ruleCount: number,
  outcomeCount: number,
): dia.Element {
  const name = cap.name ?? `${cap.noun}.${cap.verb}`
  const badges: string[] = []
  if (ruleCount > 0) badges.push(`R:${ruleCount}`)
  if (outcomeCount > 0) badges.push(`O:${outcomeCount}`)
  const el = new CapabilityShape({
    id,
    position: { x, y },
    size: CAPABILITY_SIZE,
    attrs: {
      label: { text: name },
      badges: { text: badges.join('  ') },
    },
  })
  el.set('dna', {
    kind: 'capability',
    id,
    layer: 'operational',
    name,
    description: cap.description,
    source: cap,
  })
  return el
}

function createRule(id: string, rule: Rule, x: number, y: number): dia.Element {
  const colors = RULE_COLORS[rule.type ?? 'access']
  const el = new RuleShape({
    id,
    position: { x, y },
    size: RULE_SIZE,
    attrs: {
      body: {
        fill: colors.fill,
        stroke: colors.stroke,
      },
      label: {
        text: rule.type === 'condition' ? 'C' : 'R',
        fill: colors.textFill,
      },
    },
  })
  el.set('dna', {
    kind: 'rule',
    id,
    layer: 'operational',
    name: `${rule.capability} ${rule.type ?? 'access'}`,
    description: rule.description,
    source: rule,
  })
  return el
}

function createOutcome(id: string, outcome: Outcome, x: number, y: number): dia.Element {
  const el = new OutcomeShape({
    id,
    position: { x, y },
    size: OUTCOME_SIZE,
  })
  el.set('dna', {
    kind: 'outcome',
    id,
    layer: 'operational',
    name: `${outcome.capability} outcome`,
    description: outcome.description,
    source: outcome,
  })
  return el
}

function createSignal(id: string, signal: Signal, x: number, y: number): dia.Element {
  // Short-label the signal so the diamond stays readable. The full
  // fully-qualified name is in the inspector.
  const segments = signal.name.split('.')
  const short = segments.slice(-2).join('.')
  const el = new SignalShape({
    id,
    position: { x, y },
    size: SIGNAL_SIZE,
    attrs: {
      label: { text: short },
    },
  })
  el.set('dna', {
    kind: 'signal',
    id,
    layer: 'operational',
    name: signal.name,
    description: signal.description,
    source: signal,
  })
  return el
}

/**
 * Edge styling by type. Follows the same grey→bright muted palette as
 * technical connections, but uses the operational layer's emerald for
 * "initiate" (intra-domain chaining) and rose for "emit" / "trigger"
 * (signal-based) so signal flow reads distinctly from capability chaining.
 */
const EDGE_STYLES = {
  initiate: { stroke: '#34d399', dash: undefined,  opacity: 0.85 },
  emit:     { stroke: '#fb7185', dash: '5,4',       opacity: 0.8 },
  trigger:  { stroke: '#fb7185', dash: '5,4',       opacity: 0.6 },
} as const

function createEdge(
  sourceId: string,
  targetId: string,
  opts: { type: keyof typeof EDGE_STYLES; label?: string },
): shapes.standard.Link {
  const style = EDGE_STYLES[opts.type]
  const link = new shapes.standard.Link({
    source: { id: sourceId },
    target: { id: targetId },
    labels: opts.label ? [{
      attrs: {
        text: {
          text: opts.label,
          fill: '#94a3b8',
          fontSize: 9,
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        },
        rect: { fill: '#0f172a', stroke: 'none', rx: 3, ry: 3 },
      },
    }] : [],
    attrs: {
      line: {
        stroke: style.stroke,
        strokeWidth: 1.5,
        strokeDasharray: style.dash,
        strokeOpacity: style.opacity,
        targetMarker: {
          type: 'path',
          d: 'M 8 -4 0 0 8 4 z',
          fill: style.stroke,
          fillOpacity: style.opacity,
        },
      },
    },
    router: { name: 'manhattan', args: { step: 20, padding: 16 } },
    connector: { name: 'rounded', args: { radius: 6 } },
  })
  link.set('z', 3)
  link.set('dna', {
    kind: 'edge',
    layer: 'operational',
    type: opts.type,
  })
  return link
}

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Recurse into the domain hierarchy to find the first leaf that carries
 * any Nouns. Multi-leaf rendering is deferred to Phase 5c.3.
 */
function pickLeafDomain(domain: Domain): Domain | null {
  if (domain.nouns && domain.nouns.length > 0) return domain
  for (const child of domain.domains ?? []) {
    const found = pickLeafDomain(child)
    if (found) return found
  }
  return null
}

function groupCapabilitiesByNoun(capabilities: Capability[]): Map<string, Capability[]> {
  const map = new Map<string, Capability[]>()
  for (const cap of capabilities) {
    const list = map.get(cap.noun) ?? []
    list.push(cap)
    map.set(cap.noun, list)
  }
  return map
}

function groupByCapability<T extends { capability: string }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const list = map.get(item.capability) ?? []
    list.push(item)
    map.set(item.capability, list)
  }
  return map
}

function pickLayout(layouts: OperationalLayout[] | undefined): OperationalLayout | null {
  if (!layouts || layouts.length === 0) return null
  return layouts[0]
}

function applyLayoutOverlay(cells: dia.Cell[], layout: OperationalLayout): void {
  for (const cell of cells) {
    if (!cell.isElement()) continue
    const el = cell as dia.Element
    const entry = layout.elements[el.id as string]
    if (!entry) continue
    el.position(entry.position.x, entry.position.y)
    if (entry.size) el.resize(entry.size.width, entry.size.height)
  }
}

function hasElement(cells: dia.Cell[], id: string): boolean {
  return cells.some((c) => c.isElement() && c.id === id)
}
