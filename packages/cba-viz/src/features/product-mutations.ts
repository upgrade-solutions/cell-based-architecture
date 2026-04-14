/**
 * Product DNA mutations — Phase 5c.4 Chunk 2.
 *
 * Pure helpers that take a ProductApiDNA or ProductUiDNA and return a
 * new document with a primitive added, renamed, or deleted. Mirrors
 * `features/operational-mutations.ts` in shape: addX / renameX /
 * deleteX / previewCascade, JSON-clone, name-based identity.
 *
 * ─── Scope (Chunk 2) ────────────────────────────────────────────────
 *
 * Product API:
 *   - Create Resource + Endpoint (Namespace is singular per doc)
 *   - Rename Resource (walks Operation.resource, Endpoint.operation
 *     `Resource.Action` prefix, and Page.resource across product-ui)
 *   - Delete Resource (cascade endpoints + related operations) or
 *     Endpoint (just itself)
 *
 * Product UI:
 *   - Create Page + Block (Layout is singular per doc)
 *   - Rename Page (walks Route.page references)
 *   - Delete Page (cascade routes + blocks) or Block (just itself)
 *
 * Cross-layer note: renaming a Resource cascades through the companion
 * ProductUiDNA's Page.resource field. The caller passes the ui doc in
 * alongside the api doc so this module can rewrite both and return
 * both. That keeps the walk in one place rather than hoping App.tsx
 * remembers to do the cross-layer fixup at save time.
 *
 * Same name-based identity caveat as operational-mutations.ts applies
 * — stable UUIDs are a future chunk. Until then, rename walks must
 * stay in lockstep with the product schemas; adding a new field that
 * carries a Resource / Operation / Page name means updating the
 * rename helpers below.
 */

import type {
  ProductApiDNA,
  ProductUiDNA,
  Resource,
  Endpoint,
  Operation,
  Page,
  Block,
  BlockType,
  HttpMethod,
} from '../loaders/product-loader.ts'

// ── Kinds we can create / delete ───────────────────────────────────────

export type ProductApiPrimitiveKind = 'resource' | 'endpoint'
export type ProductUiPrimitiveKind = 'page' | 'block'

// ── Clone ──────────────────────────────────────────────────────────────

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

// ── Product API: create ────────────────────────────────────────────────

export interface AddResourceInput {
  name: string
  description?: string
}

export function addResource(dna: ProductApiDNA, input: AddResourceInput): ProductApiDNA {
  const next = clone(dna)
  next.resources = next.resources ?? []
  next.resources.push({
    name: input.name,
    description: input.description,
    fields: [],
    actions: [],
  })
  // Attach to the namespace listing so downstream tooling knows which
  // namespace the resource lives under. Namespaces are singular per
  // doc so we just push onto the sole namespace's resources[].
  next.namespace.resources = next.namespace.resources ?? []
  if (!next.namespace.resources.includes(input.name)) {
    next.namespace.resources.push(input.name)
  }
  return next
}

export interface AddEndpointInput {
  method: HttpMethod
  path: string
  /** Canonical `Resource.Action` form. */
  operation: string
  description?: string
}

export function addEndpoint(dna: ProductApiDNA, input: AddEndpointInput): ProductApiDNA {
  const next = clone(dna)
  next.endpoints = next.endpoints ?? []
  next.endpoints.push({
    method: input.method,
    path: input.path,
    operation: input.operation,
    description: input.description,
  })
  // If the operation doesn't already exist in the operations[] list,
  // add a stub so the endpoint has something to point at. The user
  // can fill in the Resource + Action details in the inspector.
  next.operations = next.operations ?? []
  if (!next.operations.some((op) => (op.name ?? `${op.resource}.${op.action}`) === input.operation)) {
    const dot = input.operation.indexOf('.')
    if (dot > 0) {
      const resource = input.operation.slice(0, dot)
      const action = input.operation.slice(dot + 1)
      const op: Operation = {
        resource,
        action,
        name: input.operation,
      }
      next.operations.push(op)
    }
  }
  return next
}

// ── Product UI: create ─────────────────────────────────────────────────

export interface AddPageInput {
  name: string
  resource: string
  description?: string
}

export function addPage(dna: ProductUiDNA, input: AddPageInput): ProductUiDNA {
  const next = clone(dna)
  next.pages = next.pages ?? []
  next.pages.push({
    name: input.name,
    resource: input.resource,
    description: input.description,
    blocks: [],
  })
  return next
}

export interface AddBlockInput {
  /** Page name the block belongs to. */
  page: string
  name: string
  type: BlockType
  description?: string
}

export function addBlock(dna: ProductUiDNA, input: AddBlockInput): ProductUiDNA {
  const next = clone(dna)
  const pageIdx = next.pages.findIndex((p) => p.name === input.page)
  if (pageIdx < 0) {
    // No matching page — return the clone untouched so the caller can
    // surface an error. Silent no-op would be worse: the user would
    // see no change and no explanation.
    return next
  }
  const page = next.pages[pageIdx]
  page.blocks = page.blocks ?? []
  const block: Block = {
    name: input.name,
    type: input.type,
    description: input.description,
    fields: [],
  }
  page.blocks.push(block)
  return next
}

// ── Product API: rename ────────────────────────────────────────────────

/**
 * Rewrite every reference to a Resource when its name changes.
 *
 * In-document references:
 *   - Resource.name itself
 *   - Operation.resource (and Operation.name via `Resource.Action`)
 *   - Endpoint.operation (same `Resource.Action` prefix)
 *   - Schema.resource (request + response on each endpoint)
 *   - Namespace.resources[] listing
 *
 * Cross-document references (into ProductUiDNA):
 *   - Page.resource on every page
 *
 * The cross-doc rewrite is handled by the companion `renameResourceUi`
 * below — callers who have both DNAs pass them through in sequence so
 * both documents end up consistent.
 *
 * Safe to call with `oldName === newName` — just returns a clone.
 */
export function renameResource(
  dna: ProductApiDNA,
  oldName: string,
  newName: string,
): ProductApiDNA {
  if (oldName === newName) return clone(dna)
  const next = clone(dna)

  const rewriteOp = (opName: string): string => {
    const idx = opName.indexOf('.')
    if (idx < 0) return opName
    const resourcePart = opName.slice(0, idx)
    if (resourcePart !== oldName) return opName
    return `${newName}.${opName.slice(idx + 1)}`
  }

  // 1. Resource itself
  for (const resource of next.resources ?? []) {
    if (resource.name === oldName) resource.name = newName
  }

  // 2. Operations — resource field + name prefix
  for (const op of next.operations ?? []) {
    if (op.resource === oldName) op.resource = newName
    if (op.name) op.name = rewriteOp(op.name)
  }

  // 3. Endpoints — operation prefix + request/response schema.resource
  for (const endpoint of next.endpoints ?? []) {
    endpoint.operation = rewriteOp(endpoint.operation)
    if (endpoint.request?.resource === oldName) {
      endpoint.request.resource = newName
    }
    if (endpoint.response?.resource === oldName) {
      endpoint.response.resource = newName
    }
  }

  // 4. Namespace.resources[] listing
  if (next.namespace.resources) {
    next.namespace.resources = next.namespace.resources.map((r) =>
      r === oldName ? newName : r,
    )
  }

  return next
}

/**
 * Cross-layer companion to `renameResource`. Walks the ProductUiDNA
 * and rewrites every Page.resource that points at the old name.
 * Pages are the only place in product-ui where a Resource name
 * appears — Blocks reference operations by `Resource.Action` which is
 * handled by `renameResourceUiBlocks` below.
 */
export function renameResourceUi(
  dna: ProductUiDNA,
  oldName: string,
  newName: string,
): ProductUiDNA {
  if (oldName === newName) return clone(dna)
  const next = clone(dna)

  const rewriteOp = (opName: string | undefined): string | undefined => {
    if (!opName) return opName
    const idx = opName.indexOf('.')
    if (idx < 0) return opName
    const resourcePart = opName.slice(0, idx)
    if (resourcePart !== oldName) return opName
    return `${newName}.${opName.slice(idx + 1)}`
  }

  for (const page of next.pages ?? []) {
    if (page.resource === oldName) page.resource = newName
    // Block.operation carries a `Resource.Action` string too.
    for (const block of page.blocks ?? []) {
      const rewritten = rewriteOp(block.operation)
      if (rewritten !== undefined) block.operation = rewritten
    }
  }

  return next
}

// ── Product UI: rename ─────────────────────────────────────────────────

/**
 * Rewrite every reference to a Page when its name changes. Pages are
 * referenced by name in Route.page, so the walk is short: update the
 * Page.name itself and every matching Route.page.
 *
 * Blocks are owned by their parent Page and carry no page-level name
 * reference themselves — they follow their page through persistence
 * via (pageName, index) identity in `product-persistence.ts`.
 */
export function renamePage(
  dna: ProductUiDNA,
  oldName: string,
  newName: string,
): ProductUiDNA {
  if (oldName === newName) return clone(dna)
  const next = clone(dna)

  for (const page of next.pages ?? []) {
    if (page.name === oldName) page.name = newName
  }
  for (const route of next.routes ?? []) {
    if (route.page === oldName) route.page = newName
  }

  return next
}

// ── Delete with cascade ────────────────────────────────────────────────

export interface RemovedProductPrimitive {
  kind: ProductApiPrimitiveKind | ProductUiPrimitiveKind
  name: string
}

/**
 * Preview what would be removed by deleting (kind, key) without
 * actually mutating anything. Drives the confirmation dialog so users
 * can see the blast radius before committing.
 *
 * Key format per kind:
 *   - resource → Resource.name
 *   - endpoint → graph id `endpoint:<METHOD>:<path>`
 *   - page     → Page.name
 *   - block    → graph id `block:<PageName>:<index>`
 */
export function previewCascadeProductApi(
  dna: ProductApiDNA,
  kind: ProductApiPrimitiveKind,
  key: string,
): RemovedProductPrimitive[] {
  const removed: RemovedProductPrimitive[] = []

  if (kind === 'resource') {
    removed.push({ kind: 'resource', name: key })
    // Endpoints whose operation lives on this resource (prefix match)
    for (const ep of dna.endpoints ?? []) {
      if (operationResource(ep.operation) === key) {
        removed.push({ kind: 'endpoint', name: `${ep.method} ${ep.path}` })
      }
    }
    return removed
  }

  if (kind === 'endpoint') {
    const parsed = parseEndpointId(key)
    if (!parsed) return removed
    const match = (dna.endpoints ?? []).find(
      (e) => e.method === parsed.method && e.path === parsed.path,
    )
    if (match) {
      removed.push({ kind: 'endpoint', name: `${match.method} ${match.path}` })
    }
    return removed
  }

  return removed
}

export function previewCascadeProductUi(
  dna: ProductUiDNA,
  kind: ProductUiPrimitiveKind,
  key: string,
): RemovedProductPrimitive[] {
  const removed: RemovedProductPrimitive[] = []

  if (kind === 'page') {
    removed.push({ kind: 'page', name: key })
    const page = dna.pages.find((p) => p.name === key)
    if (page) {
      for (const block of page.blocks ?? []) {
        removed.push({ kind: 'block', name: `${key}.${block.name}` })
      }
    }
    for (const route of dna.routes ?? []) {
      if (route.page === key) {
        // Routes have no name; describe them by path
        removed.push({ kind: 'page', name: `route ${route.path}` })
      }
    }
    return removed
  }

  if (kind === 'block') {
    const parsed = parseBlockId(key)
    if (!parsed) return removed
    const page = dna.pages.find((p) => p.name === parsed.page)
    const block = page?.blocks?.[parsed.index]
    if (block) {
      removed.push({ kind: 'block', name: `${parsed.page}.${block.name}` })
    }
    return removed
  }

  return removed
}

/**
 * Remove a product-api primitive (and cascades). Returns the new doc
 * plus the list of what got removed.
 *
 * Cascade rules:
 *   - resource → its endpoints + its operations (everything with
 *     `Resource.Action` prefix)
 *   - endpoint → just itself
 */
export function deleteProductApiPrimitive(
  dna: ProductApiDNA,
  kind: ProductApiPrimitiveKind,
  key: string,
): { dna: ProductApiDNA; removed: RemovedProductPrimitive[] } {
  const next = clone(dna)
  const removed: RemovedProductPrimitive[] = []

  if (kind === 'resource') {
    next.resources = (next.resources ?? []).filter((r) => r.name !== key)
    removed.push({ kind: 'resource', name: key })

    // Prune namespace listing
    if (next.namespace.resources) {
      next.namespace.resources = next.namespace.resources.filter((r) => r !== key)
    }

    // Endpoints whose operation lives on this resource
    next.endpoints = (next.endpoints ?? []).filter((ep) => {
      if (operationResource(ep.operation) === key) {
        removed.push({ kind: 'endpoint', name: `${ep.method} ${ep.path}` })
        return false
      }
      return true
    })

    // Operations anchored on this resource
    next.operations = (next.operations ?? []).filter((op) => op.resource !== key)

    return { dna: next, removed }
  }

  if (kind === 'endpoint') {
    const parsed = parseEndpointId(key)
    if (!parsed) return { dna: next, removed }
    const before = next.endpoints.length
    next.endpoints = next.endpoints.filter(
      (e) => !(e.method === parsed.method && e.path === parsed.path),
    )
    if (next.endpoints.length < before) {
      removed.push({ kind: 'endpoint', name: `${parsed.method} ${parsed.path}` })
    }
    return { dna: next, removed }
  }

  return { dna: next, removed }
}

/**
 * Remove a product-ui primitive (and cascades).
 *
 * Cascade rules:
 *   - page  → routes pointing at it + its blocks (blocks are nested
 *     so they disappear with the page automatically)
 *   - block → just itself
 */
export function deleteProductUiPrimitive(
  dna: ProductUiDNA,
  kind: ProductUiPrimitiveKind,
  key: string,
): { dna: ProductUiDNA; removed: RemovedProductPrimitive[] } {
  const next = clone(dna)
  const removed: RemovedProductPrimitive[] = []

  if (kind === 'page') {
    const page = next.pages.find((p) => p.name === key)
    next.pages = next.pages.filter((p) => p.name !== key)
    removed.push({ kind: 'page', name: key })
    if (page) {
      for (const block of page.blocks ?? []) {
        removed.push({ kind: 'block', name: `${key}.${block.name}` })
      }
    }
    next.routes = (next.routes ?? []).filter((r) => r.page !== key)
    return { dna: next, removed }
  }

  if (kind === 'block') {
    const parsed = parseBlockId(key)
    if (!parsed) return { dna: next, removed }
    const pageIdx = next.pages.findIndex((p) => p.name === parsed.page)
    if (pageIdx < 0) return { dna: next, removed }
    const page = next.pages[pageIdx]
    const blocks = page.blocks ?? []
    if (parsed.index < 0 || parsed.index >= blocks.length) {
      return { dna: next, removed }
    }
    const target = blocks[parsed.index]
    const nextBlocks = blocks.filter((_, i) => i !== parsed.index)
    next.pages[pageIdx] = { ...page, blocks: nextBlocks }
    removed.push({ kind: 'block', name: `${parsed.page}.${target.name}` })
    return { dna: next, removed }
  }

  return { dna: next, removed }
}

// ── Parsing helpers ────────────────────────────────────────────────────

/**
 * Pull the resource prefix out of a `Resource.Action` operation name.
 * Operations without a dot have no clear resource anchor — return the
 * whole string so callers can decide how to handle it.
 */
function operationResource(opName: string): string {
  const idx = opName.indexOf('.')
  if (idx < 0) return opName
  return opName.slice(0, idx)
}

/**
 * Parse an endpoint graph id like `endpoint:GET:/widgets/{id}` back
 * into its method + path components. The path may itself contain
 * colons (rare, but legal), so we split on the FIRST colon after the
 * `endpoint:` prefix and keep everything after as the path.
 */
function parseEndpointId(id: string): { method: string; path: string } | null {
  const firstColon = id.indexOf(':')
  if (firstColon < 0) return null
  const prefix = id.slice(0, firstColon)
  if (prefix !== 'endpoint') return null
  const rest = id.slice(firstColon + 1)
  const nextColon = rest.indexOf(':')
  if (nextColon < 0) return null
  const method = rest.slice(0, nextColon)
  const path = rest.slice(nextColon + 1)
  return { method, path }
}

/**
 * Parse a block graph id like `block:PageName:2` into its page +
 * index components. Page names contain no colons by schema so the
 * split is unambiguous.
 */
function parseBlockId(id: string): { page: string; index: number } | null {
  const m = id.match(/^block:(.+):(\d+)$/)
  if (!m) return null
  const index = parseInt(m[2], 10)
  if (!Number.isFinite(index)) return null
  return { page: m[1], index }
}

// ── Convenience: enumerate existing primitives ────────────────────────

export function listResources(dna: ProductApiDNA): Resource[] {
  return dna.resources ?? []
}

export function listEndpoints(dna: ProductApiDNA): Endpoint[] {
  return dna.endpoints ?? []
}

export function listPages(dna: ProductUiDNA): Page[] {
  return dna.pages ?? []
}
