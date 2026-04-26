/**
 * Product DNA types + loaders.
 *
 * Covers all three product sub-layers in one file because they share types
 * heavily (Resource, Field, Action, Operation are used by product-core,
 * product-api, and product-ui).
 *
 * Field names and shapes mirror `@dna-codes/schemas/product/**.json`. The
 * RJSF inspector form round-trips data through these interfaces back to the
 * schema — any drift breaks editing silently.
 *
 * Product Core re-uses the operational primitive shapes (Resource shape,
 * Operation shape, Trigger shape, Relationship shape) from
 * `operational-loader`. Materialization flattens the domain hierarchy but
 * doesn't change the per-primitive schemas.
 */

import type {
  Resource as OpResource,
  Operation as OpOperation,
  Trigger,
  Relationship,
} from './operational-loader.ts'
import { migrateProductApiDNA, migrateProductUiDNA } from './migrate-to-uuid.ts'

// Re-export shared primitives for downstream consumers.
export type {
  Trigger,
  Relationship,
}

// ── Shared product primitives (product/core/) ─────────────────────────

/**
 * Field type enum. Extends Operational Attribute types with UI-only
 * semantic variants (email, phone, url) that UI adapters can lift into
 * typed form controls.
 */
export type FieldType =
  | 'string'
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'email'
  | 'phone'
  | 'url'
  | 'enum'
  | 'reference'

export interface Field {
  name: string
  label?: string
  type: FieldType
  description?: string
  required?: boolean
  readonly?: boolean
  values?: string[]
  /** Operational Attribute this field maps from. */
  attribute?: string
}

export interface Action {
  name: string
  description?: string
  /** Operational Action this maps from (Resource.actions[].name). */
  action?: string
  /** HTTP method when realized as an API endpoint. */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  input?: Field[]
  output?: Field[]
}

export interface Resource {
  id?: string
  name: string
  description?: string
  /** Operational Resource this maps from. */
  resource?: string
  fields?: Field[]
  actions?: Action[]
}

export interface Operation {
  id?: string
  /** Operational target (Resource/Person/Role/Group/Process) — optional alias of `target`. */
  resource?: string
  /** Operational target name. Mirrors operational `Operation.target`. */
  target?: string
  action: string
  /** Canonical `Target.Action` form. */
  name?: string
  description?: string
}

// ── Product Core (product.core.json) ──────────────────────────────────

export interface ProductCoreDomain {
  name: string
  path: string
  description?: string
}

/**
 * Product Core is a materialized projection of operational DNA. Its shape
 * follows `@dna-codes/core`'s ProductCoreDNA: domain + resources, operations,
 * triggers, relationships. The legacy fields (capabilities, outcomes, signals,
 * equations, lifecycles) are gone with the model rewrite.
 */
export interface ProductCoreDNA {
  domain: ProductCoreDomain
  resources?: OpResource[]
  operations?: OpOperation[]
  triggers?: Trigger[]
  relationships?: Relationship[]
}

// ── Product API (product.api.json) ────────────────────────────────────

export interface Namespace {
  id?: string
  name: string
  path: string
  description?: string
  /** Operational Domain this namespace maps from. */
  domain?: string
  /** Names of Resources grouped under this namespace. */
  resources?: string[]
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type ParamLocation = 'path' | 'query' | 'header'

export interface Param {
  name: string
  in: ParamLocation
  type: 'string' | 'number' | 'boolean' | 'enum'
  description?: string
  required?: boolean
  values?: string[]
  /** Operational Attribute this param maps from. */
  attribute?: string
}

export interface Schema {
  name: string
  description?: string
  fields: Field[]
  /** Resource this schema maps from. */
  resource?: string
}

export interface Endpoint {
  id?: string
  method: HttpMethod
  path: string
  /** Operation this endpoint serves, as `Resource.Action`. */
  operation: string
  description?: string
  params?: Param[]
  request?: Schema
  response?: Schema
}

export interface ProductApiDNA {
  namespace: Namespace
  resources?: Resource[]
  operations?: Operation[]
  endpoints: Endpoint[]
}

// ── Product UI (product.ui.json) ──────────────────────────────────────

export type BlockType =
  | 'list'
  | 'detail'
  | 'form'
  | 'survey'
  | 'actions'
  | 'table'
  | 'summary'
  | 'empty-state'

export interface Block {
  id?: string
  name: string
  type: BlockType
  description?: string
  /** Operation this block calls, as `Resource.Action`. */
  operation?: string
  fields?: Field[]
}

export interface Page {
  id?: string
  name: string
  resource: string
  description?: string
  blocks?: Block[]
}

export interface Route {
  id?: string
  path: string
  page: string
  description?: string
  layout?: string
  protected?: boolean
}

export interface Layout {
  name: string
  type?: string
  description?: string
  [key: string]: unknown
}

export interface ProductUiDNA {
  layout: Layout
  pages: Page[]
  routes: Route[]
}

// ── Parsers + loaders ─────────────────────────────────────────────────

export function parseProductCoreDNA(json: unknown): ProductCoreDNA {
  const data = json as ProductCoreDNA
  if (!data || typeof data !== 'object' || !data.domain) {
    throw new Error('Invalid product core DNA: missing required "domain"')
  }
  return data
}

export function parseProductApiDNA(json: unknown): ProductApiDNA {
  const data = json as ProductApiDNA
  if (!data || typeof data !== 'object' || !data.namespace || !Array.isArray(data.endpoints)) {
    throw new Error('Invalid product API DNA: missing required "namespace" and/or "endpoints"')
  }
  return migrateProductApiDNA(data)
}

export function parseProductUiDNA(json: unknown): ProductUiDNA {
  const data = json as ProductUiDNA
  if (!data || typeof data !== 'object' || !data.layout || !Array.isArray(data.pages) || !Array.isArray(data.routes)) {
    throw new Error('Invalid product UI DNA: missing required "layout", "pages", and/or "routes"')
  }
  return migrateProductUiDNA(data)
}

export async function loadProductCoreDNA(domain: string): Promise<ProductCoreDNA> {
  const response = await fetch(`/api/dna/product-core/${encodeURIComponent(domain)}`)
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Failed to load product core DNA for "${domain}": ${response.status} ${body}`)
  }
  return parseProductCoreDNA(await response.json())
}

export async function loadProductApiDNA(domain: string): Promise<ProductApiDNA> {
  const response = await fetch(`/api/dna/product-api/${encodeURIComponent(domain)}`)
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Failed to load product API DNA for "${domain}": ${response.status} ${body}`)
  }
  return parseProductApiDNA(await response.json())
}

export async function loadProductUiDNA(domain: string): Promise<ProductUiDNA> {
  const response = await fetch(`/api/dna/product-ui/${encodeURIComponent(domain)}`)
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Failed to load product UI DNA for "${domain}": ${response.status} ${body}`)
  }
  return parseProductUiDNA(await response.json())
}
