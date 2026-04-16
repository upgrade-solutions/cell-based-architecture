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
// re-applied on reload and so edges can target specific primitives.
// IDs are UUID-based — each primitive carries a stable `id` field
// assigned on first load by the migration layer. Rename is just a
// display-name edit; references and layout keys never change.

export const ID = {
  domain: (path: string) => `domain:${path}`,
  noun: (uuid: string) => `noun:${uuid}`,
  capability: (uuid: string) => `capability:${uuid}`,
  rule: (capUuid: string, i: number) => `rule:${capUuid}:${i}`,
  outcome: (capUuid: string, i: number) => `outcome:${capUuid}:${i}`,
  signal: (uuid: string) => `signal:${uuid}`,
}

// ── Layout geometry ────────────────────────────────────────────────────
//
// Each Noun gets a vertical "lane". Layout inside a lane:
//
//   ┌─ Noun ────┐
//   │           │
//   └───────────┘
//       │
//   ┌─ Capability ───────┐ ◆ R ◆ R   ■ O ■ O
//   └────────────────────┘
//       │
//   ┌─ Capability ───────┐ ◆ R        ■ O
//   └────────────────────┘
//       ⋮
//
// Rules and Outcomes are satellites to the right of each Capability,
// laid out on a SINGLE horizontal row vertically centered against the
// capability pill — rules first (amber/cyan), then a small gap, then
// outcomes (violet). Row-gap math:
//
//   capability height 40, satellite height 32 → satellite y = capY+4
//   (capY+36 = satellite bottom)
//   next capability y = capY + CAPABILITY_ROW_GAP (52)
//   next satellite y = capY+56 → 20px clear breathing room between rows
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
const CAPABILITY_ROW_GAP = 52    // 40 cap + 12 gap — satellites stay in their row
const SATELLITE_START_X = CAPABILITY_X + CAPABILITY_SIZE.width + 20
const RULE_SIZE = { width: 36, height: 32 }
const RULE_GAP = 6
const OUTCOME_SIZE = { width: 32, height: 32 }
const SATELLITE_GROUP_GAP = 14   // horizontal gap between rules group and outcomes group
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

    const nounId = ID.noun(noun.id!)
    const nounEl = createNoun(nounId, noun, laneX + NOUN_X, NOUN_Y)
    cells.push(nounEl)

    const capNames = capabilitiesByNoun.get(noun.name) ?? []
    capNames.forEach((cap, capIdx) => {
      const capY = CAPABILITY_FIRST_Y + capIdx * CAPABILITY_ROW_GAP
      const capX = laneX + CAPABILITY_X

      const capName = cap.name ?? `${cap.noun}.${cap.verb}`
      const rules = rulesByCapability.get(capName) ?? []
      const outcomes = outcomesByCapability.get(capName) ?? []

      const capId = ID.capability(cap.id!)
      const capEl = createCapability(capId, cap, capX, capY, rules.length, outcomes.length)
      cells.push(capEl)

      // Track the lane bottom
      const laneBottom = capY + CAPABILITY_SIZE.height
      if (laneBottom + 40 > totalHeight) totalHeight = laneBottom + 40

      // Rules + outcomes share one satellite row, vertically centered
      // against the capability pill. Rules come first, then a small
      // horizontal gap, then outcomes. This keeps each capability's
      // "R/O profile" on a single visual line and prevents satellites
      // from bleeding into adjacent rows.
      const satY = capY + (CAPABILITY_SIZE.height - RULE_SIZE.height) / 2

      rules.forEach((rule, i) => {
        const rx = laneX + SATELLITE_START_X + i * (RULE_SIZE.width + RULE_GAP)
        const ruleId = ID.rule(cap.id!, i)
        cells.push(createRule(ruleId, rule, rx, satY))
      })

      const outcomesBaseX = laneX + SATELLITE_START_X
        + rules.length * (RULE_SIZE.width + RULE_GAP)
        + (rules.length > 0 ? SATELLITE_GROUP_GAP : 0)

      outcomes.forEach((outcome, i) => {
        const ox = outcomesBaseX + i * (OUTCOME_SIZE.width + RULE_GAP)
        const outcomeId = ID.outcome(cap.id!, i)
        cells.push(createOutcome(outcomeId, outcome, ox, satY))
      })
    })
  })

  // Signals in a column to the right of all noun lanes
  const signalColumnX = nounCount * LANE_WIDTH + SIGNAL_COLUMN_OFFSET
  signals.forEach((signal, i) => {
    const sy = LANE_TOP_PAD + i * (SIGNAL_SIZE.height + SIGNAL_ROW_GAP)
    const signalId = ID.signal(signal.id!)
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

  // ── Name→graphId lookup maps for edge wiring ──
  // Edges in DNA reference primitives by name (e.g. outcome.initiates
  // lists capability names). We resolve names to UUID-based graph IDs.
  const capGraphId = new Map<string, string>()
  for (const cap of dna.capabilities ?? []) {
    capGraphId.set(cap.name ?? `${cap.noun}.${cap.verb}`, ID.capability(cap.id!))
  }
  const signalGraphId = new Map<string, string>()
  for (const signal of signals) {
    signalGraphId.set(signal.name, ID.signal(signal.id!))
  }

  // ── Edges ──
  // Built after elements so the source/target ids all exist in the graph.
  for (const outcome of dna.outcomes ?? []) {
    const capName = outcome.capability
    const outcomes = outcomesByCapability.get(capName) ?? []
    const idx = outcomes.indexOf(outcome)
    if (idx < 0) continue
    const ownerCap = (dna.capabilities ?? []).find(c => (c.name ?? `${c.noun}.${c.verb}`) === capName)
    if (!ownerCap) continue
    const fromId = ID.outcome(ownerCap.id!, idx)

    // initiates → downstream capability (intra-domain, sync)
    for (const initiateName of outcome.initiates ?? []) {
      const targetId = capGraphId.get(initiateName)
      if (!targetId || !hasElement(result, targetId)) continue
      result.push(createEdge(fromId, targetId, {
        type: 'initiate',
        label: 'initiates',
      }))
    }

    // emits → signal (cross-domain, async)
    for (const signalName of outcome.emits ?? []) {
      const targetId = signalGraphId.get(signalName)
      if (!targetId || !hasElement(result, targetId)) continue
      result.push(createEdge(fromId, targetId, {
        type: 'emit',
        label: 'emits',
      }))
    }
  }

  // Causes: two patterns draw edges.
  //
  //   source === 'signal'      → Signal -> Capability   (triggers, dashed rose)
  //   source === 'capability'  → Capability -> Capability (after, solid emerald)
  //
  // Other sources (user, schedule, webhook) don't produce canvas edges
  // — they're properties of a capability rather than inter-node relations,
  // and the inspector form surfaces them on the target capability itself.
  for (const cause of dna.causes ?? []) {
    if (cause.source === 'signal' && cause.signal) {
      const sigId = signalGraphId.get(cause.signal)
      const capId = capGraphId.get(cause.capability)
      if (!sigId || !capId) continue
      if (!hasElement(result, sigId) || !hasElement(result, capId)) continue
      result.push(createEdge(sigId, capId, {
        type: 'trigger',
        label: 'triggers',
      }))
    } else if (cause.source === 'capability' && cause.after) {
      const afterId = capGraphId.get(cause.after)
      const capId = capGraphId.get(cause.capability)
      if (!afterId || !capId) continue
      if (!hasElement(result, afterId) || !hasElement(result, capId)) continue
      result.push(createEdge(afterId, capId, {
        type: 'initiate',
        label: 'after',
      }))
    }
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
    layer: 'operational',
    name: domain.name,
    path: domain.path,
    description: domain.description,
    // Pass the whole domain so clicking the zone opens the domain
    // schema form in the sidebar, same as every other operational
    // primitive. Sub-nouns / sub-domains are stripped because they
    // render as their own cells — the form edits only the top-level
    // fields (name, description, path).
    source: {
      name: domain.name,
      description: domain.description,
      path: domain.path,
    },
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
