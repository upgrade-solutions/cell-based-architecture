import { dia } from '@joint/plus'
import type {
  OperationalDNA,
  Operation,
  Trigger,
  Rule,
  Task,
  Process,
  Membership,
  NounLike,
  Domain,
  OperationalLayout,
} from '../loaders/operational-loader.ts'
import { ID } from '../mappers/operational-to-graph.ts'

/**
 * Extract the current graph state as an updated OperationalDNA document.
 *
 * Strategy: *start from the last-loaded DNA* and patch by id, rather
 * than rebuilding from scratch. The mapper only renders a subset of
 * primitives — Memberships, Relationships, etc. are inspector-only —
 * so rebuilding would silently drop them.
 *
 * Layout positions are written into `layouts[0]`.
 */
export function graphToOperationalDNA(
  graph: dia.Graph,
  original: OperationalDNA,
): OperationalDNA {
  const next: OperationalDNA = {
    ...original,
    domain: cloneDomain(original.domain),
    memberships: (original.memberships ?? []).slice(),
    operations: (original.operations ?? []).slice(),
    triggers: (original.triggers ?? []).slice(),
    rules: (original.rules ?? []).slice(),
    tasks: (original.tasks ?? []).slice(),
    processes: (original.processes ?? []).slice(),
    relationships: (original.relationships ?? []).slice(),
    layouts: (original.layouts ?? []).slice(),
  }

  const elements = graph.getElements()

  for (const el of elements) {
    const dna = el.get('dna') as { kind?: string; id?: string; source?: unknown } | undefined
    if (!dna?.kind || !dna.source) continue

    switch (dna.kind) {
      case 'resource':
      case 'person':
      case 'role':
      case 'group': {
        const updated = dna.source as NounLike
        patchNoun(next.domain, dna.kind, updated)
        break
      }
      case 'operation': {
        const updated = dna.source as Operation
        const idx = next.operations!.findIndex((o) => o.id === updated.id)
        if (idx >= 0) next.operations![idx] = updated
        break
      }
      case 'trigger': {
        const updated = dna.source as Trigger
        const idx = next.triggers!.findIndex((t) => t.id === updated.id)
        if (idx >= 0) next.triggers![idx] = updated
        break
      }
      case 'rule': {
        const updated = dna.source as Rule
        const idx = next.rules!.findIndex((r) => r.id === updated.id)
        if (idx >= 0) next.rules![idx] = updated
        break
      }
      case 'task': {
        const updated = dna.source as Task
        const idx = next.tasks!.findIndex((t) => t.id === updated.id)
        if (idx >= 0) next.tasks![idx] = updated
        break
      }
      case 'process': {
        const updated = dna.source as Process
        const idx = next.processes!.findIndex((p) => p.id === updated.id)
        if (idx >= 0) next.processes![idx] = updated
        break
      }
      case 'membership': {
        const updated = dna.source as Membership
        const idx = next.memberships!.findIndex((m) => m.id === updated.id)
        if (idx >= 0) next.memberships![idx] = updated
        break
      }
      case 'domain': {
        const updated = dna.source as Partial<Domain>
        if (updated.name) next.domain.name = updated.name
        if (updated.description !== undefined) next.domain.description = updated.description
        if (updated.path) next.domain.path = updated.path
        break
      }
    }
  }

  // Layout overlay
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

function cloneDomain(domain: Domain): Domain {
  return {
    ...domain,
    domains: domain.domains?.map(cloneDomain),
    resources: domain.resources?.map((n) => ({ ...n })),
    persons:   domain.persons?.map((n) => ({ ...n })),
    roles:     domain.roles?.map((n) => ({ ...n })),
    groups:    domain.groups?.map((n) => ({ ...n })),
  }
}

function patchNoun(domain: Domain, kind: 'resource' | 'person' | 'role' | 'group', updated: NounLike): boolean {
  const arr = nounArrayOn(domain, kind)
  if (arr) {
    const idx = arr.findIndex((n) => n.id === updated.id)
    if (idx >= 0) {
      arr[idx] = updated
      return true
    }
  }
  for (const child of domain.domains ?? []) {
    if (patchNoun(child, kind, updated)) return true
  }
  return false
}

function nounArrayOn(domain: Domain, kind: 'resource' | 'person' | 'role' | 'group'): NounLike[] | undefined {
  switch (kind) {
    case 'resource': return domain.resources
    case 'person':   return domain.persons
    case 'role':     return domain.roles
    case 'group':    return domain.groups
  }
}

void ID
