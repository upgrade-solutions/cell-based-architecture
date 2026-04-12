import { ParsedArgs, flag, boolFlag } from './args'
import { emitError } from './output'
import { buildPlan, EnvironmentPlan } from './deliver/plan'
import { loadLayer, resolveDomain } from './context'

/**
 * `cba views <domain> --env <env>` — derive architecture graph JSON from technical DNA.
 *
 * The graph is auto-derived from the cells, constructs, and providers arrays in
 * technical.json (with environment overlay applied). The hand-maintained
 * technical.json `views[]` section is treated as a pure layout overlay:
 * saved position/size are merged onto derived nodes. This means:
 *
 *   - Adding a cell/construct/provider to technical DNA makes it appear automatically
 *   - Removing one removes it from the graph
 *   - Manual position edits persist across DNA changes
 *
 * Output: { views: [ { name: 'deployment', nodes: [...], connections: [...], zones: [...] } ] }
 */
export function runViews(argv: string[], args: ParsedArgs): void {
  const opts = { json: boolFlag(args, 'json') }
  const [domain] = argv
  if (!domain) {
    emitError('Usage: cba views <domain> [--env <environment>]', opts)
    process.exit(1)
  }

  // Environment is optional — if omitted, pick the first one declared in technical DNA
  let environment = flag(args, 'env')
  if (!environment) {
    try {
      const paths = resolveDomain(domain)
      const technical = loadLayer(paths, 'technical')
      environment = (technical.environments?.[0]?.name) ?? 'dev'
    } catch (err) {
      emitError((err as Error).message, opts)
      process.exit(1)
    }
  }

  let plan: EnvironmentPlan
  try {
    plan = buildPlan(domain, environment!)
  } catch (err) {
    emitError((err as Error).message, opts)
    process.exit(1)
  }

  // Read the existing views[] section as a layout overlay (positions, sizes, zone bounds)
  const technical = loadLayer(plan.paths, 'technical')
  const savedViews: ArchView[] = technical.views ?? []

  const derived = deriveView(plan, savedViews[0])
  const output = { views: [derived] }

  if (opts.json) {
    process.stdout.write(JSON.stringify(output))
  } else {
    process.stdout.write(JSON.stringify(output, null, 2))
  }
}

// ── Types (duplicated from cba-viz dna-loader to keep packages decoupled) ──

type NodeStatus = 'proposed' | 'planned' | 'deployed'

interface ArchNode {
  id: string
  name: string
  type: 'cell' | 'construct' | 'provider' | 'domain' | 'noun' | 'external' | 'custom'
  status?: NodeStatus
  position?: { x: number; y: number }
  size?: { width: number; height: number }
  description?: string
  metadata?: Record<string, unknown>
}

interface ArchConnection {
  id: string
  source: string
  target: string
  type: 'depends-on' | 'data-flow' | 'communicates-with' | 'publishes-to'
  label?: string
  vertices?: Array<{ x: number; y: number }>
}

interface ArchZone {
  id: string
  name: string
  type: 'tier' | 'boundary' | 'environment' | 'domain'
  nodes: string[]
  position?: { x: number; y: number }
  size?: { width: number; height: number }
}

interface ArchView {
  name: string
  description?: string
  nodes: ArchNode[]
  connections?: ArchConnection[]
  zones?: ArchZone[]
}

// ── Derivation ──

/**
 * Adapters that don't produce a running service of their own — their entire
 * purpose is to provision an underlying Construct (schema, queue config, etc.).
 * On a deployment view these cells are redundant with their construct, so we
 * hide them. The provisioning relationship still lives in technical DNA's
 * `cell.constructs[]`; it's just not shown as a separate node.
 */
const PROVISIONER_ADAPTERS = new Set([
  'postgres',
  'node/event-bus',
])

function isProvisioner(cell: { adapterType: string }): boolean {
  return PROVISIONER_ADAPTERS.has(cell.adapterType)
}

/**
 * Derive a single deployment view from an EnvironmentPlan.
 *
 * Layout rules:
 *   - Cells (excluding provisioners) in a row at the top
 *   - Constructs in a row below
 *   - If savedView has a node with the same id, its position/size wins
 *
 * Providers are NOT rendered on the deployment view — they're config
 * (which cloud, which auth backend), not deployable infrastructure.
 * The provider reference still lives on each Construct's `provider` field.
 */
function deriveView(plan: EnvironmentPlan, savedView?: ArchView): ArchView {
  // Visible cells excludes provisioner cells (those whose job is to set up
  // a construct — they have no independent runtime service)
  const visibleCells = plan.cells.filter((c) => !isProvisioner(c))
  // Build a lookup of saved positions by node id
  const savedPositions = new Map<string, { pos?: ArchNode['position']; size?: ArchNode['size'] }>()
  for (const node of savedView?.nodes ?? []) {
    savedPositions.set(node.id, { pos: node.position, size: node.size })
  }
  const savedZoneLayout = new Map<string, { pos?: ArchZone['position']; size?: ArchZone['size'] }>()
  for (const zone of savedView?.zones ?? []) {
    savedZoneLayout.set(zone.id, { pos: zone.position, size: zone.size })
  }

  const nodes: ArchNode[] = []
  const connections: ArchConnection[] = []

  // ── Layout constants — tight grid, single-row tiers ──
  const CELL_W = 160
  const CELL_H = 70
  const CONSTRUCT_W = 160
  const CONSTRUCT_H = 60
  const GAP_X = 40  // horizontal gap between siblings
  const GAP_Y = 80  // vertical gap between tiers (inside a zone)
  const MARGIN = 40 // margin inside a zone
  const CELL_ROW_Y = MARGIN + 30 // room for zone header

  // ── Cells (compute tier) — provisioners excluded ──
  let cellX = MARGIN
  for (const cell of visibleCells) {
    const saved = savedPositions.get(cell.name)
    nodes.push({
      id: cell.name,
      name: cell.name,
      type: 'cell',
      status: 'planned',
      position: saved?.pos ?? { x: cellX, y: CELL_ROW_Y },
      size: saved?.size ?? { width: CELL_W, height: CELL_H },
      description: cell.description,
      metadata: { adapter: cell.adapterType },
    })
    cellX += CELL_W + GAP_X
  }

  // ── Constructs (storage tier) ──
  // Put the storage tier below compute with a zone gap in between
  const constructRowY = CELL_ROW_Y + CELL_H + GAP_Y + 30 // extra for next zone header
  let constructX = MARGIN
  for (const construct of plan.constructs) {
    const saved = savedPositions.get(construct.name)
    const engine = (construct.config?.engine as string | undefined) ?? construct.type
    nodes.push({
      id: construct.name,
      name: construct.name,
      type: 'construct',
      status: 'planned',
      position: saved?.pos ?? { x: constructX, y: constructRowY },
      size: saved?.size ?? { width: CONSTRUCT_W, height: CONSTRUCT_H },
      description: construct.description,
      metadata: {
        category: construct.category,
        type: construct.type,
        engine,
        provider: construct.provider,
      },
    })
    constructX += CONSTRUCT_W + GAP_X
  }

  // ── Connections: visible cells → their constructs (depends-on) ──
  // Provisioner cells are excluded, so we don't emit edges from them.
  for (const cell of visibleCells) {
    for (const constructName of cell.constructs) {
      if (!plan.constructs.some((c) => c.name === constructName)) continue
      connections.push({
        id: `${cell.name}->${constructName}`,
        source: cell.name,
        target: constructName,
        type: 'depends-on',
      })
    }
  }

  // ── Connections: cell → cell (communicates-with) ──
  //
  // Two inference rules, both emit a `communicates-with` edge:
  //
  //   1. adapter.config.api_dna matches another cell's `dna` field.
  //      (e.g. ui-cell.api_dna = torts/marshall/product.api, api-cell.dna = same)
  //      This catches the authoring-time relationship: a UI cell is built
  //      against a specific Product API DNA, so it talks to whichever cell
  //      serves that DNA. Works even when the UI has no explicit api_base URL.
  //
  //   2. adapter.config.api_base matches another cell's outputs[].value.
  //      (e.g. admin-ui-cell.api_base = http://localhost:3001 matches
  //       api-cell outputs.api_url = http://localhost:3001)
  //      This catches the runtime-URL relationship.
  //
  // Rule 1 subsumes rule 2 for well-formed DNA, but we keep both for robustness.
  // Duplicates are deduped by edge id.
  const cellByDna = new Map<string, string>()
  const cellByOutputUrl = new Map<string, string>()
  for (const cell of visibleCells) {
    if (cell.dna) cellByDna.set(cell.dna, cell.name)
    for (const output of cell.outputs ?? []) {
      if (output?.value) cellByOutputUrl.set(output.value, cell.name)
    }
  }
  const addedEdges = new Set<string>()
  const addEdge = (source: string, target: string) => {
    if (!target || source === target) return
    const id = `${source}->${target}`
    if (addedEdges.has(id)) return
    addedEdges.add(id)
    connections.push({ id, source, target, type: 'communicates-with' })
  }
  for (const cell of visibleCells) {
    const apiDna = cell.adapterConfig?.api_dna as string | undefined
    if (apiDna) {
      const target = cellByDna.get(apiDna)
      if (target) addEdge(cell.name, target)
    }
    const apiBase = cell.adapterConfig?.api_base as string | undefined
    if (apiBase) {
      const target = cellByOutputUrl.get(apiBase)
      if (target) addEdge(cell.name, target)
    }
  }

  // ── Zones: Compute tier (cells) + Storage tier (constructs) ──
  const zones: ArchZone[] = []
  if (visibleCells.length > 0) {
    const savedZone = savedZoneLayout.get('zone-compute')
    zones.push({
      id: 'zone-compute',
      name: 'Compute',
      type: 'tier',
      nodes: visibleCells.map((c) => c.name),
      position: savedZone?.pos,
      size: savedZone?.size,
    })
  }
  if (plan.constructs.length > 0) {
    const savedZone = savedZoneLayout.get('zone-storage')
    zones.push({
      id: 'zone-storage',
      name: 'Storage',
      type: 'tier',
      nodes: plan.constructs.map((c) => c.name),
      position: savedZone?.pos,
      size: savedZone?.size,
    })
  }

  return {
    name: 'deployment',
    description: `Derived from ${plan.domain} technical DNA (environment: ${plan.environment}).`,
    nodes,
    connections,
    zones,
  }
}
