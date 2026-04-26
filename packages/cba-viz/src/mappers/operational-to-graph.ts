import { dia, shapes } from '@joint/plus'
import type {
  OperationalDNA,
  Domain,
  NounLike,
  Operation,
  Trigger,
  Rule,
  Process,
  Task,
  OperationalLayout,
} from '../loaders/operational-loader.ts'
import {
  ResourceShape,
  PersonShape,
  RoleShape,
  GroupShape,
  type NounKind,
} from '../shapes/operational/NounShape.ts'
import { OperationShape } from '../shapes/operational/OperationShape.ts'
import { TriggerShape, TRIGGER_PALETTE, type TriggerSourceKind } from '../shapes/operational/TriggerShape.ts'
import { ProcessShape } from '../shapes/operational/ProcessShape.ts'
import { RuleShape, RULE_COLORS } from '../shapes/operational/RuleShape.ts'
import { ZoneContainer } from '../shapes/ZoneContainer.ts'

// ── Stable IDs for graph elements ──────────────────────────────────────
//
// IDs are UUID-based — each primitive carries a stable `id` field
// assigned on first load by the migration layer. Rename is just a
// display-name edit; references and layout keys never change.

export const ID = {
  domain: (path: string) => `domain:${path}`,
  // Note: legacy `noun:<uuid>` ids are now `resource:<uuid>` (rebuilt by
  // migrate-to-uuid.ts). Other noun primitives get distinct prefixes.
  resource:  (uuid: string) => `resource:${uuid}`,
  person:    (uuid: string) => `person:${uuid}`,
  role:      (uuid: string) => `role:${uuid}`,
  group:     (uuid: string) => `group:${uuid}`,
  operation: (uuid: string) => `operation:${uuid}`,
  trigger:   (uuid: string) => `trigger:${uuid}`,
  rule:      (uuid: string) => `rule:${uuid}`,
  task:      (uuid: string) => `task:${uuid}`,
  process:   (uuid: string) => `process:${uuid}`,
}

interface NounEntry {
  noun: NounLike
  kind: NounKind
}

// ── Layout geometry ────────────────────────────────────────────────────

const LANE_WIDTH = 560
const LANE_TOP_PAD = 64
const NOUN_X = 24
const NOUN_Y = LANE_TOP_PAD
const NOUN_SIZE = { width: 180, height: 56 }
const OP_X = 24
const OP_FIRST_Y = LANE_TOP_PAD + NOUN_SIZE.height + 32
const OP_SIZE = { width: 220, height: 40 }
const OP_ROW_GAP = 56
const SATELLITE_START_X_OFFSET = OP_X + OP_SIZE.width + 20
const RULE_SIZE = { width: 36, height: 32 }
const RULE_GAP = 6

const TRIGGER_SIZE = { width: 56, height: 56 }
const TRIGGER_ROW_GAP = 24
const TRIGGER_COLUMN_OFFSET = 40

const PROCESS_SIZE = { width: 220, height: 48 }
const PROCESS_ROW_GAP = 24

// ── Entry point ────────────────────────────────────────────────────────

/**
 * Convert an Operational DNA document into JointJS graph cells.
 *
 * Layout strategy (Phase 5 rewrite — new operational model):
 *   1. Pick the leaf domain that carries any noun primitives
 *   2. Lay out each noun primitive (Resource/Person/Role/Group) in its
 *      own lane, ordered by document occurrence
 *   3. Operations under their target's lane in document order
 *   4. Rule satellites attached to the operation pill
 *   5. Triggers in a right-side column (cross-noun, may target any op)
 *   6. Processes in a far-right column below triggers
 *   7. Wrap everything in a domain zone
 *   8. Apply saved layout overlay
 *   9. Create edges (Trigger→Operation, Process step Task→Operation)
 */
export function operationalToGraphCells(dna: OperationalDNA): dia.Cell[] {
  const cells: dia.Cell[] = []

  const leaf = pickLeafDomain(dna.domain)
  const nouns = leaf ? collectNouns(leaf) : []

  if (!leaf || nouns.length === 0) {
    cells.push(createDomainZone(dna.domain ?? leaf ?? ({ name: 'empty' } as Domain), 600, 200))
    return cells
  }

  const opsByTarget = groupOperationsByTarget(dna.operations ?? [])
  const rulesByOperation = groupRulesByOperation(dna.rules ?? [])
  const tasksByOperation = groupTasksByOperation(dna.tasks ?? [])
  const savedLayout = pickLayout(dna.layouts)

  const nounCount = nouns.length
  const triggers = dna.triggers ?? []
  const processes = dna.processes ?? []
  const sideColumnNeeded = triggers.length > 0 || processes.length > 0

  let totalWidth = LANE_WIDTH * nounCount + 48
  if (sideColumnNeeded) totalWidth += TRIGGER_COLUMN_OFFSET + Math.max(TRIGGER_SIZE.width, PROCESS_SIZE.width) + 40
  let totalHeight = LANE_TOP_PAD + NOUN_SIZE.height + 32

  // Per-noun lanes
  nouns.forEach((entry, laneIdx) => {
    const laneX = laneIdx * LANE_WIDTH + 24
    const noun = entry.noun

    const nounEl = createNoun(entry, laneX + NOUN_X, NOUN_Y)
    cells.push(nounEl)

    const ops = opsByTarget.get(noun.name) ?? []
    ops.forEach((op, opIdx) => {
      const opY = OP_FIRST_Y + opIdx * OP_ROW_GAP
      const opX = laneX + OP_X
      const rules = rulesByOperation.get(op.name) ?? []

      const opEl = createOperation(op, opX, opY, rules.length, op.changes?.length ?? 0)
      cells.push(opEl)

      const laneBottom = opY + OP_SIZE.height
      if (laneBottom + 40 > totalHeight) totalHeight = laneBottom + 40

      // Rule satellites — single horizontal row, vertically centered on
      // the operation pill.
      const satY = opY + (OP_SIZE.height - RULE_SIZE.height) / 2
      rules.forEach((rule, i) => {
        const rx = laneX + SATELLITE_START_X_OFFSET + i * (RULE_SIZE.width + RULE_GAP)
        cells.push(createRule(rule, rx, satY))
      })

      // Tasks render only as a count badge — they don't get their own
      // shape on the canvas in this pass. The (Process → Task) detail
      // lives in the inspector form. We use the count to enrich the
      // operation badge below.
      void tasksByOperation.get(op.name)
    })
  })

  // Right-column triggers
  const sideColumnX = nounCount * LANE_WIDTH + TRIGGER_COLUMN_OFFSET
  triggers.forEach((trigger, i) => {
    const ty = LANE_TOP_PAD + i * (TRIGGER_SIZE.height + TRIGGER_ROW_GAP)
    cells.push(createTrigger(trigger, sideColumnX, ty))
    const bottom = ty + TRIGGER_SIZE.height + 40
    if (bottom > totalHeight) totalHeight = bottom
  })

  // Processes below triggers
  const processBaseY = LANE_TOP_PAD + triggers.length * (TRIGGER_SIZE.height + TRIGGER_ROW_GAP) + 16
  processes.forEach((proc, i) => {
    const py = processBaseY + i * (PROCESS_SIZE.height + PROCESS_ROW_GAP)
    cells.push(createProcess(proc, sideColumnX, py))
    const bottom = py + PROCESS_SIZE.height + 40
    if (bottom > totalHeight) totalHeight = bottom
  })

  // Domain zone wraps everything
  const zoneEl = createDomainZone(leaf, totalWidth, totalHeight)
  zoneEl.set('z', 0)

  if (savedLayout) {
    applyLayoutOverlay(cells, savedLayout)
    applyLayoutOverlay([zoneEl], savedLayout)
  }

  for (const cell of cells) {
    if (cell.isElement()) {
      zoneEl.embed(cell as dia.Element)
      ;(cell as dia.Element).set('z', 2)
    }
  }

  const result: dia.Cell[] = [zoneEl, ...cells]

  // ── Edges ──
  // Build name→graph-id maps so trigger.operation references resolve.
  const opGraphId = new Map<string, string>()
  for (const op of dna.operations ?? []) opGraphId.set(op.name, ID.operation(op.id!))

  const procGraphId = new Map<string, string>()
  for (const p of processes) procGraphId.set(p.name, ID.process(p.id!))

  for (const trigger of triggers) {
    const fromId = ID.trigger(trigger.id!)
    if (trigger.operation) {
      const toId = opGraphId.get(trigger.operation)
      if (toId && hasElement(result, toId)) {
        result.push(createEdge(fromId, toId, { type: 'trigger', label: 'triggers' }))
      }
    }
    if (trigger.process) {
      const toId = procGraphId.get(trigger.process)
      if (toId && hasElement(result, toId)) {
        result.push(createEdge(fromId, toId, { type: 'trigger', label: 'starts' }))
      }
    }
    // Trigger.after — chain after a prior operation
    if (trigger.source === 'operation' && trigger.after) {
      const fromOp = opGraphId.get(trigger.after)
      const targetOp = trigger.operation ? opGraphId.get(trigger.operation) : null
      if (fromOp && targetOp && hasElement(result, fromOp) && hasElement(result, targetOp)) {
        result.push(createEdge(fromOp, targetOp, { type: 'after', label: 'after' }))
      }
    }
  }

  return result
}

// ── Element factories ──────────────────────────────────────────────────

function createDomainZone(domain: Domain, width: number, height: number): dia.Element {
  const path = domain.path ?? domain.name
  const el = new ZoneContainer({
    id: ID.domain(path),
    position: { x: 0, y: 0 },
    size: { width, height },
    attrs: {
      body: {
        fill: 'rgba(16, 185, 129, 0.06)',
        stroke: '#10b981',
        strokeWidth: 2,
      },
      headerBg: { fill: 'rgba(16, 185, 129, 0.18)' },
      label: {
        text: path.toUpperCase(),
        fill: '#6ee7b7',
      },
    },
  })
  el.set('dna', {
    kind: 'domain',
    id: ID.domain(path),
    layer: 'operational',
    name: domain.name,
    path: domain.path,
    description: domain.description,
    source: {
      name: domain.name,
      description: domain.description,
      path: domain.path,
    },
  })
  return el
}

function createNoun(entry: NounEntry, x: number, y: number): dia.Element {
  const noun = entry.noun
  const kind = entry.kind
  const id = nounIdFor(kind, noun.id!)
  const ShapeCtor = nounShapeFor(kind)
  const attrCount = noun.attributes?.length ?? 0
  const actionCount = noun.actions?.length ?? 0
  const badge = attrCount + actionCount > 0
    ? `${attrCount}a ${actionCount}f`
    : ''
  const el = new ShapeCtor({
    id,
    position: { x, y },
    size: NOUN_SIZE,
    attrs: {
      label: { text: noun.name },
      countLabel: { text: badge },
    },
  })
  el.set('dna', {
    kind,
    id,
    layer: 'operational',
    name: noun.name,
    description: noun.description,
    source: noun,
  })
  return el
}

function createOperation(
  op: Operation,
  x: number,
  y: number,
  ruleCount: number,
  changeCount: number,
): dia.Element {
  const id = ID.operation(op.id!)
  const badges: string[] = []
  if (ruleCount > 0) badges.push(`R:${ruleCount}`)
  if (changeCount > 0) badges.push(`Δ:${changeCount}`)
  const el = new OperationShape({
    id,
    position: { x, y },
    size: OP_SIZE,
    attrs: {
      label: { text: op.name },
      badges: { text: badges.join('  ') },
    },
  })
  el.set('dna', {
    kind: 'operation',
    id,
    layer: 'operational',
    name: op.name,
    description: op.description,
    source: op,
  })
  return el
}

function createTrigger(trigger: Trigger, x: number, y: number): dia.Element {
  const id = ID.trigger(trigger.id!)
  const sourceKind = (trigger.source ?? 'user') as TriggerSourceKind
  const palette = TRIGGER_PALETTE[sourceKind] ?? TRIGGER_PALETTE.user
  const targetLabel = trigger.operation ?? trigger.process ?? sourceKind
  const el = new TriggerShape({
    id,
    position: { x, y },
    size: TRIGGER_SIZE,
    attrs: {
      body: {
        fill: palette.fill,
        stroke: palette.stroke,
      },
      label: {
        text: shortLabel(targetLabel),
        fill: palette.label,
      },
    },
  })
  el.set('dna', {
    kind: 'trigger',
    id,
    layer: 'operational',
    name: `trigger:${targetLabel}`,
    description: trigger.description,
    source: trigger,
  })
  return el
}

function createRule(rule: Rule, x: number, y: number): dia.Element {
  // Each rule carries a UUID; satellite layout uses the operation row but
  // identity is per-rule so renames/refactors leave layout intact.
  const id = ID.rule(rule.id!)
  const colors = RULE_COLORS[rule.type ?? 'access']
  const el = new RuleShape({
    id,
    position: { x, y },
    size: RULE_SIZE,
    attrs: {
      body: { fill: colors.fill, stroke: colors.stroke },
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
    name: rule.name ?? `${rule.operation} ${rule.type ?? 'access'}`,
    description: rule.description,
    source: rule,
  })
  return el
}

function createProcess(proc: Process, x: number, y: number): dia.Element {
  const id = ID.process(proc.id!)
  const stepCount = proc.steps?.length ?? 0
  const el = new ProcessShape({
    id,
    position: { x, y },
    size: PROCESS_SIZE,
    attrs: {
      label: { text: proc.name },
      stepLabel: { text: `${stepCount} step${stepCount === 1 ? '' : 's'} · ${proc.operator}` },
    },
  })
  el.set('dna', {
    kind: 'process',
    id,
    layer: 'operational',
    name: proc.name,
    description: proc.description,
    source: proc,
  })
  return el
}

const EDGE_STYLES = {
  trigger: { stroke: '#fb7185', dash: '5,4',     opacity: 0.8 },
  after:   { stroke: '#34d399', dash: undefined, opacity: 0.85 },
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

function pickLeafDomain(domain: Domain): Domain | null {
  if (anyNouns(domain)) return domain
  for (const child of domain.domains ?? []) {
    const found = pickLeafDomain(child)
    if (found) return found
  }
  return null
}

function anyNouns(domain: Domain): boolean {
  return (
    (domain.resources?.length ?? 0) > 0 ||
    (domain.persons?.length ?? 0) > 0 ||
    (domain.roles?.length ?? 0) > 0 ||
    (domain.groups?.length ?? 0) > 0
  )
}

function collectNouns(domain: Domain): NounEntry[] {
  const entries: NounEntry[] = []
  for (const r of domain.resources ?? []) entries.push({ noun: r, kind: 'resource' })
  for (const p of domain.persons ?? []) entries.push({ noun: p, kind: 'person' })
  for (const r of domain.roles ?? []) entries.push({ noun: r, kind: 'role' })
  for (const g of domain.groups ?? []) entries.push({ noun: g, kind: 'group' })
  return entries
}

function nounShapeFor(kind: NounKind) {
  switch (kind) {
    case 'resource': return ResourceShape
    case 'person':   return PersonShape
    case 'role':     return RoleShape
    case 'group':    return GroupShape
  }
}

function nounIdFor(kind: NounKind, uuid: string): string {
  switch (kind) {
    case 'resource': return ID.resource(uuid)
    case 'person':   return ID.person(uuid)
    case 'role':     return ID.role(uuid)
    case 'group':    return ID.group(uuid)
  }
}

function groupOperationsByTarget(operations: Operation[]): Map<string, Operation[]> {
  const map = new Map<string, Operation[]>()
  for (const op of operations) {
    const list = map.get(op.target) ?? []
    list.push(op)
    map.set(op.target, list)
  }
  return map
}

function groupRulesByOperation(rules: Rule[]): Map<string, Rule[]> {
  const map = new Map<string, Rule[]>()
  for (const rule of rules) {
    const list = map.get(rule.operation) ?? []
    list.push(rule)
    map.set(rule.operation, list)
  }
  return map
}

function groupTasksByOperation(tasks: Task[]): Map<string, Task[]> {
  const map = new Map<string, Task[]>()
  for (const task of tasks) {
    const list = map.get(task.operation) ?? []
    list.push(task)
    map.set(task.operation, list)
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

function shortLabel(s: string): string {
  // Trim to fit inside the 56x56 diamond label region
  const segments = s.split('.')
  const tail = segments.slice(-2).join('.')
  return tail.length > 14 ? tail.slice(0, 12) + '…' : tail
}
