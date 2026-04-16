/**
 * Product DNA mutations.
 *
 * Pure helpers that take a ProductApiDNA or ProductUiDNA and return a
 * new document with a primitive added or deleted. Identity is UUID-based
 * — rename is just a display-name edit, no reference walks needed.
 */

import { generateId } from '../utils/uuid.ts'
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
    id: generateId(),
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
    id: generateId(),
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
    id: generateId(),
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
  const pageIdx = next.pages.findIndex((p) => p.name === input.page || p.id === input.page)
  if (pageIdx < 0) {
    // No matching page — return the clone untouched so the caller can
    // surface an error. Silent no-op would be worse: the user would
    // see no change and no explanation.
    return next
  }
  const page = next.pages[pageIdx]
  page.blocks = page.blocks ?? []
  const block: Block = {
    id: generateId(),
    name: input.name,
    type: input.type,
    description: input.description,
    fields: [],
  }
  page.blocks.push(block)
  return next
}

// ── Delete with cascade ────────────────────────────────────────────────

export interface RemovedProductPrimitive {
  kind: ProductApiPrimitiveKind | ProductUiPrimitiveKind
  name: string
}

/**
 * Preview what would be removed. `key` is the primitive's UUID `id`.
 */
export function previewCascadeProductApi(
  dna: ProductApiDNA,
  kind: ProductApiPrimitiveKind,
  key: string,
): RemovedProductPrimitive[] {
  const removed: RemovedProductPrimitive[] = []

  if (kind === 'resource') {
    const resource = (dna.resources ?? []).find((r) => r.id === key)
    const name = resource?.name ?? key
    removed.push({ kind: 'resource', name })
    if (resource) {
      for (const ep of dna.endpoints ?? []) {
        if (operationResource(ep.operation) === name) {
          removed.push({ kind: 'endpoint', name: `${ep.method} ${ep.path}` })
        }
      }
    }
    return removed
  }

  if (kind === 'endpoint') {
    const ep = (dna.endpoints ?? []).find((e) => e.id === key)
    if (ep) {
      removed.push({ kind: 'endpoint', name: `${ep.method} ${ep.path}` })
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
    const page = dna.pages.find((p) => p.id === key)
    const name = page?.name ?? key
    removed.push({ kind: 'page', name })
    if (page) {
      for (const block of page.blocks ?? []) {
        removed.push({ kind: 'block', name: `${name}.${block.name}` })
      }
    }
    if (page) {
      for (const route of dna.routes ?? []) {
        if (route.page === name) {
          removed.push({ kind: 'page', name: `route ${route.path}` })
        }
      }
    }
    return removed
  }

  if (kind === 'block') {
    // Find block by UUID across all pages
    for (const page of dna.pages) {
      const block = (page.blocks ?? []).find((b) => b.id === key)
      if (block) {
        removed.push({ kind: 'block', name: `${page.name}.${block.name}` })
        return removed
      }
    }
    return removed
  }

  return removed
}

/**
 * Remove a product-api primitive. `key` is the primitive's UUID `id`.
 */
export function deleteProductApiPrimitive(
  dna: ProductApiDNA,
  kind: ProductApiPrimitiveKind,
  key: string,
): { dna: ProductApiDNA; removed: RemovedProductPrimitive[] } {
  const next = clone(dna)
  const removed: RemovedProductPrimitive[] = []

  if (kind === 'resource') {
    const resource = (next.resources ?? []).find((r) => r.id === key)
    const name = resource?.name
    next.resources = (next.resources ?? []).filter((r) => r.id !== key)
    if (name) {
      removed.push({ kind: 'resource', name })
      if (next.namespace.resources) {
        next.namespace.resources = next.namespace.resources.filter((r) => r !== name)
      }
      next.endpoints = (next.endpoints ?? []).filter((ep) => {
        if (operationResource(ep.operation) === name) {
          removed.push({ kind: 'endpoint', name: `${ep.method} ${ep.path}` })
          return false
        }
        return true
      })
      next.operations = (next.operations ?? []).filter((op) => op.resource !== name)
    }
    return { dna: next, removed }
  }

  if (kind === 'endpoint') {
    const ep = (next.endpoints ?? []).find((e) => e.id === key)
    if (ep) {
      next.endpoints = next.endpoints.filter((e) => e.id !== key)
      removed.push({ kind: 'endpoint', name: `${ep.method} ${ep.path}` })
    }
    return { dna: next, removed }
  }

  return { dna: next, removed }
}

/**
 * Remove a product-ui primitive. `key` is the primitive's UUID `id`.
 */
export function deleteProductUiPrimitive(
  dna: ProductUiDNA,
  kind: ProductUiPrimitiveKind,
  key: string,
): { dna: ProductUiDNA; removed: RemovedProductPrimitive[] } {
  const next = clone(dna)
  const removed: RemovedProductPrimitive[] = []

  if (kind === 'page') {
    const page = next.pages.find((p) => p.id === key)
    const name = page?.name
    next.pages = next.pages.filter((p) => p.id !== key)
    if (name) {
      removed.push({ kind: 'page', name })
      if (page) {
        for (const block of page.blocks ?? []) {
          removed.push({ kind: 'block', name: `${name}.${block.name}` })
        }
      }
      next.routes = (next.routes ?? []).filter((r) => r.page !== name)
    }
    return { dna: next, removed }
  }

  if (kind === 'block') {
    for (let pi = 0; pi < next.pages.length; pi++) {
      const page = next.pages[pi]
      const blocks = page.blocks ?? []
      const bi = blocks.findIndex((b) => b.id === key)
      if (bi >= 0) {
        const target = blocks[bi]
        next.pages[pi] = { ...page, blocks: blocks.filter((_, i) => i !== bi) }
        removed.push({ kind: 'block', name: `${page.name}.${target.name}` })
        return { dna: next, removed }
      }
    }
    return { dna: next, removed }
  }

  return { dna: next, removed }
}

// ── Helpers ───────────────────────────────────────────────────────────

function operationResource(opName: string): string {
  const idx = opName.indexOf('.')
  if (idx < 0) return opName
  return opName.slice(0, idx)
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
