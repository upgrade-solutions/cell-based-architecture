import { dia } from '@joint/plus'
import type {
  OperationalDNA,
  Capability,
  Rule,
  Outcome,
  Signal,
  Noun,
  Domain,
  OperationalLayout,
} from '../loaders/operational-loader.ts'
import { ID } from '../mappers/operational-to-graph.ts'

/**
 * Extract the current graph state as an updated OperationalDNA document.
 *
 * Strategy: *start from the last-loaded DNA* and mutate by id, rather
 * than rebuilding from scratch. Two reasons:
 *
 *   1. The mapper only surfaces a subset of primitives on the canvas
 *      (we don't render Relationships, Equations, Positions, Persons, Tasks, Processes as shapes
 *      in Phase 1). Rebuilding would silently drop them.
 *   2. RJSF form edits live in `dna.source` on the cell — which is a
 *      reference to the primitive *within the original document*. Walking
 *      elements and swapping each primitive by id keeps every downstream
 *      field the user might care about (examples[], additional_properties)
 *      untouched.
 *
 * Layout also gets written into the top-level `layouts[]` field so that
 * positions persist across reloads.
 */
export function graphToOperationalDNA(
  graph: dia.Graph,
  original: OperationalDNA,
): OperationalDNA {
  // Deep-ish clone to avoid mutating the caller's DNA reference. We
  // shallow-clone the top level and copy the arrays we intend to modify.
  const next: OperationalDNA = {
    ...original,
    domain: cloneDomain(original.domain),
    capabilities: (original.capabilities ?? []).slice(),
    rules: (original.rules ?? []).slice(),
    outcomes: (original.outcomes ?? []).slice(),
    signals: (original.signals ?? []).slice(),
    causes: (original.causes ?? []).slice(),
    relationships: (original.relationships ?? []).slice(),
    equations: (original.equations ?? []).slice(),
    positions: (original.positions ?? []).slice(),
    persons: (original.persons ?? []).slice(),
    tasks: (original.tasks ?? []).slice(),
    processes: (original.processes ?? []).slice(),
    layouts: (original.layouts ?? []).slice(),
  }

  // ── Per-element updates from the canvas ──
  //
  // Every operational element on the canvas carries `dna.source` — the
  // reference to its primitive. We walk the graph and, for each element,
  // find the matching entry in `next` and replace it with the latest
  // source from the cell. This preserves identity (array position) so
  // diffs to operational.json stay minimal.

  const elements = graph.getElements()

  for (const el of elements) {
    const dna = el.get('dna') as { kind?: string; id?: string; source?: unknown } | undefined
    if (!dna?.kind || !dna.source) continue

    switch (dna.kind) {
      case 'noun': {
        const updated = dna.source as Noun
        patchNoun(next.domain, updated)
        break
      }
      case 'capability': {
        const updated = dna.source as Capability
        const idx = next.capabilities!.findIndex((c) => c.id === updated.id)
        if (idx >= 0) next.capabilities![idx] = updated
        break
      }
      case 'rule': {
        const updated = dna.source as Rule
        const idx = next.rules!.findIndex((r) => r.id === updated.id)
        if (idx >= 0) next.rules![idx] = updated
        break
      }
      case 'outcome': {
        const updated = dna.source as Outcome
        const idx = next.outcomes!.findIndex((o) => o.id === updated.id)
        if (idx >= 0) next.outcomes![idx] = updated
        break
      }
      case 'signal': {
        const updated = dna.source as Signal
        const idx = next.signals!.findIndex((s) => s.id === updated.id)
        if (idx >= 0) next.signals![idx] = updated
        break
      }
      case 'domain': {
        // Domain edits are flat: name, description, path. The hierarchical
        // `domains[]` / `nouns[]` arrays are preserved by cloneDomain.
        const updated = dna.source as Partial<Domain>
        if (updated.name) next.domain.name = updated.name
        if (updated.description !== undefined) next.domain.description = updated.description
        if (updated.path) next.domain.path = updated.path
        break
      }
    }
  }

  // ── Layout overlay ──
  //
  // Collect positions (+ sizes for zones) for every element on the
  // canvas and write them into `layouts[0]`. First save creates the
  // default layout; subsequent saves replace it in place so diffs stay
  // tight.
  const layoutElements: OperationalLayout['elements'] = {}
  for (const el of elements) {
    const pos = el.position()
    const size = el.size()
    const id = el.id as string
    layoutElements[id] = {
      position: { x: Math.round(pos.x), y: Math.round(pos.y) },
      size: { width: Math.round(size.width), height: Math.round(size.height) },
    }
  }
  const layout: OperationalLayout = { name: 'default', elements: layoutElements }
  if (!next.layouts || next.layouts.length === 0) {
    next.layouts = [layout]
  } else {
    next.layouts[0] = layout
  }

  return next
}

/**
 * POST the updated operational DNA to the dev middleware.
 * Mirrors `saveViews` but targets `/api/dna/operational/:domain`.
 */
export async function saveOperational(domain: string, dna: OperationalDNA): Promise<void> {
  const response = await fetch(`/api/dna/operational/${encodeURIComponent(domain)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dna),
  })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Failed to save operational DNA: ${response.status} ${body}`)
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Clone a domain subtree. We don't bother with structuredClone because
 * Nouns inside the domain may contain references the caller still holds
 * (examples[], attributes[]) — the clone is shallow on leaves and deep
 * only on the hierarchy spine so mutations at the top level can't
 * accidentally alter the caller's source.
 */
function cloneDomain(domain: Domain): Domain {
  return {
    ...domain,
    domains: domain.domains?.map(cloneDomain),
    nouns: domain.nouns?.map((n) => ({ ...n })),
  }
}

function patchNoun(domain: Domain, updated: Noun): boolean {
  if (domain.nouns) {
    const idx = domain.nouns.findIndex((n) => n.id === updated.id)
    if (idx >= 0) {
      domain.nouns[idx] = updated
      return true
    }
  }
  for (const child of domain.domains ?? []) {
    if (patchNoun(child, updated)) return true
  }
  return false
}

// Suppress unused-import linting for ID — referenced by consumers that
// need to reconstruct graph element ids from a primitive reference.
void ID
