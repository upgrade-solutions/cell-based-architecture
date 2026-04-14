import { dia } from '@joint/plus'
import type {
  ProductApiDNA,
  ProductUiDNA,
  Resource,
  Endpoint,
  Namespace,
  Page,
  Block,
  Layout,
  Route,
} from '../loaders/product-loader.ts'

/**
 * Product API + UI persistence.
 *
 * Same mutate-by-id strategy as operational-persistence.ts: start from
 * the last-loaded DNA and update primitives in place by walking the
 * graph. This preserves fields we don't render (additional_properties,
 * examples[], nested configs on layouts, etc.) rather than re-emitting
 * from scratch and dropping anything the mapper didn't surface.
 *
 * Block identity is a particular corner case worth noting — blocks
 * aren't globally unique on their name alone because two different
 * pages can each have a "List" block. The mapper encodes the owning
 * page into the graph element id (`block:${pageName}:${i}`), so here
 * we parse that id back to locate the right (page, index) target.
 */

// ── Product API ────────────────────────────────────────────────────────

export function graphToProductApiDNA(
  graph: dia.Graph,
  original: ProductApiDNA,
): ProductApiDNA {
  const next: ProductApiDNA = {
    ...original,
    namespace: { ...original.namespace },
    resources: (original.resources ?? []).slice(),
    operations: (original.operations ?? []).slice(),
    endpoints: original.endpoints.slice(),
  }

  for (const el of graph.getElements()) {
    const dna = el.get('dna') as { kind?: string; source?: unknown } | undefined
    if (!dna?.kind || !dna.source) continue

    switch (dna.kind) {
      case 'namespace': {
        next.namespace = { ...next.namespace, ...(dna.source as Namespace) }
        break
      }
      case 'resource': {
        const updated = dna.source as Resource
        const idx = next.resources!.findIndex((r) => r.name === updated.name)
        if (idx >= 0) next.resources![idx] = updated
        break
      }
      case 'endpoint': {
        const updated = dna.source as Endpoint
        // Endpoints are keyed on method+path since those are the only
        // unique identifiers in the JSON array. We look up by the
        // ORIGINAL method+path (the cell id was assigned at mapper
        // time) rather than the updated values — otherwise renaming
        // the path would orphan the old entry instead of updating it.
        const originalRef = original.endpoints
        const byRef = originalRef.indexOf(updated)
        if (byRef >= 0) {
          next.endpoints[byRef] = updated
          break
        }
        // Fall back to id parsing when the user edited the endpoint
        // body (which replaced dna.source with a new object reference).
        const id = el.id as string
        const m = id.match(/^endpoint:([^:]+):(.+)$/)
        if (m) {
          const [, origMethod, origPath] = m
          const idx = next.endpoints.findIndex(
            (e) => e.method === origMethod && e.path === origPath,
          )
          if (idx >= 0) next.endpoints[idx] = updated
        }
        break
      }
    }
  }

  return next
}

export async function saveProductApi(domain: string, dna: ProductApiDNA): Promise<void> {
  const response = await fetch(`/api/dna/product-api/${encodeURIComponent(domain)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dna),
  })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Failed to save product API DNA: ${response.status} ${body}`)
  }
}

// ── Product UI ─────────────────────────────────────────────────────────

export function graphToProductUiDNA(
  graph: dia.Graph,
  original: ProductUiDNA,
): ProductUiDNA {
  const next: ProductUiDNA = {
    ...original,
    layout: { ...original.layout },
    pages: original.pages.map((p) => ({ ...p, blocks: (p.blocks ?? []).slice() })),
    routes: original.routes.slice(),
  }

  // Collect routes per page from the graph as we walk. Routes live on
  // the Page element's dna.routes (the mapper moved them there during
  // rendering so each Page can show its routes in the inspector). On
  // save we flatten them back into the top-level routes[] array.
  const routesByPageName = new Map<string, Route[]>()

  for (const el of graph.getElements()) {
    const dna = el.get('dna') as { kind?: string; source?: unknown; routes?: Route[] } | undefined
    if (!dna?.kind || !dna.source) continue

    switch (dna.kind) {
      case 'layout': {
        next.layout = { ...next.layout, ...(dna.source as Layout) }
        break
      }
      case 'page': {
        const updated = dna.source as Page
        const idx = next.pages.findIndex((p) => p.name === updated.name)
        if (idx >= 0) {
          // Preserve the existing blocks array — blocks are edited as
          // their own graph elements (handled in the `block` case
          // below), so we don't want to overwrite them from the page's
          // source (which may be stale).
          const existingBlocks = next.pages[idx].blocks ?? []
          next.pages[idx] = { ...updated, blocks: existingBlocks }
        }
        if (dna.routes) {
          routesByPageName.set(updated.name, dna.routes)
        }
        break
      }
      case 'block': {
        const updated = dna.source as Block
        // Parse block id to find (pageName, index) — the id encodes
        // both. Without this, blocks with shared names across pages
        // (e.g. "List" on two resources) would collide.
        const id = el.id as string
        const m = id.match(/^block:(.+):(\d+)$/)
        if (!m) break
        const pageName = m[1]
        const blockIdx = parseInt(m[2], 10)
        const pageIdx = next.pages.findIndex((p) => p.name === pageName)
        if (pageIdx < 0) break
        const blocks = next.pages[pageIdx].blocks ?? []
        if (blockIdx >= 0 && blockIdx < blocks.length) {
          blocks[blockIdx] = updated
          next.pages[pageIdx] = { ...next.pages[pageIdx], blocks }
        }
        break
      }
    }
  }

  // Flatten routes from per-page metadata back into the top-level
  // routes[] array. We preserve the original route order where
  // possible — routes are keyed by (path, page) and we walk the
  // original list first, updating each entry in place with the
  // current metadata before adding any new routes at the end.
  if (routesByPageName.size > 0) {
    const updatedRoutes: Route[] = []
    const seen = new Set<string>()
    const key = (r: Route) => `${r.path}::${r.page}`
    // Walk the original routes first — preserves order and catches
    // routes that weren't attached to a rendered page (edge case).
    for (const r of next.routes) {
      const pageRoutes = routesByPageName.get(r.page) ?? []
      const match = pageRoutes.find((pr) => pr.path === r.path)
      if (match) {
        updatedRoutes.push(match)
        seen.add(key(match))
      } else {
        updatedRoutes.push(r)
        seen.add(key(r))
      }
    }
    // Append any routes that appeared on a page but weren't in the
    // original list (new route added via inspector edit)
    for (const [, routes] of routesByPageName) {
      for (const r of routes) {
        if (!seen.has(key(r))) {
          updatedRoutes.push(r)
          seen.add(key(r))
        }
      }
    }
    next.routes = updatedRoutes
  }

  return next
}

export async function saveProductUi(domain: string, dna: ProductUiDNA): Promise<void> {
  const response = await fetch(`/api/dna/product-ui/${encodeURIComponent(domain)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dna),
  })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Failed to save product UI DNA: ${response.status} ${body}`)
  }
}
