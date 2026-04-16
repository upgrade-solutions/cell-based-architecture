/**
 * Product DNA types + loaders.
 *
 * Phase 5c.3 foundation. Covers all three product sub-layers in one
 * file because they share types heavily (Resource, Field, Action,
 * Operation are used by product-core, product-api, and product-ui).
 * Splitting them would triple-import the same interfaces and invite
 * drift when schemas evolve.
 *
 * Field names and shapes must match `product/schemas/**.json` exactly.
 * The RJSF inspector form round-trips data through these interfaces
 * back to the schema — any drift breaks editing silently. If you
 * change a schema, update the matching interface here and re-run tsc.
 *
 * Product core shares its top-level primitives (capabilities, causes,
 * rules, outcomes, equations, signals, relationships,
 * nouns) with Operational DNA. We re-export those types from
 * `operational-loader` so there's exactly one source of truth for
 * shared primitives — materialization flattens the domain hierarchy
 * but doesn't change the per-primitive schemas.
 */

import type {
  Noun,
  Capability,
  Cause,
  Rule,
  Outcome,
  Equation,
  Signal,
  Relationship,
  Position,
  Person,
  Task,
  Process,
} from './operational-loader.ts'

// Re-export shared primitives so downstream consumers can import
// everything product-related from one place.
export type {
  Noun,
  Capability,
  Cause,
  Rule,
  Outcome,
  Equation,
  Signal,
  Relationship,
}

// ── Shared product primitives (product/schemas/core/) ───────────────────

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
  /** Operational Verb this action maps from. */
  verb?: string
  /** HTTP method when realized as an API endpoint. */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  input?: Field[]
  output?: Field[]
}

export interface Resource {
  name: string
  description?: string
  /** Operational Noun this resource maps from. */
  noun?: string
  fields?: Field[]
  actions?: Action[]
}

export interface Operation {
  resource: string
  action: string
  /** Canonical `Resource.Action` form. */
  name?: string
  description?: string
  /** Operational Capability this operation maps from, as `Noun.Verb`. */
  capability?: string
}

// ── Product Core (product.core.json) ─────────────────────────────────────
//
// Product core is a materialized, flattened slice of Operational DNA.
// Structurally identical primitive arrays; only the domain layout differs
// (flat nouns[] at the top instead of nested Domain.domains[].nouns[]).

export interface ProductCoreDomain {
  name: string
  path: string
  description?: string
}

export interface ProductCoreDNA {
  domain: ProductCoreDomain
  nouns: Noun[]
  capabilities?: Capability[]
  causes?: Cause[]
  rules?: Rule[]
  outcomes?: Outcome[]
  equations?: Equation[]
  signals?: Signal[]
  relationships?: Relationship[]
  roles?: { name: string; description?: string }[]
}

// ── Product API (product.api.json) ───────────────────────────────────────

export interface Namespace {
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
  method: HttpMethod
  path: string
  /** Operation this endpoint maps from, as `Resource.Action`. */
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

// ── Product UI (product.ui.json) ─────────────────────────────────────────

/**
 * Block structural type enum. UI adapters render each type into a
 * concrete component (table for `list`, form for `form`, etc.).
 */
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
  name: string
  type: BlockType
  description?: string
  /** Operation this block maps from, as `Resource.Action`. */
  operation?: string
  fields?: Field[]
}

export interface Page {
  name: string
  resource: string
  description?: string
  blocks?: Block[]
}

export interface Route {
  path: string
  page: string
  description?: string
  layout?: string
  protected?: boolean
}

/**
 * The Layout type is open-ended in the schema — different layout
 * variants (universal, marketing, auth, wizard) carry different
 * configuration shapes under distinct `type` discriminators. We
 * deliberately leave it as a permissive index signature so the
 * inspector form can surface arbitrary extra fields without
 * forcing every new layout variant to grow a new TypeScript type.
 */
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

// ── Parsers + loaders ───────────────────────────────────────────────────

/**
 * Minimal runtime validation — fail fast on structurally broken files.
 * Full schema validation is handled by RJSF's ajv on edit.
 */
export function parseProductCoreDNA(json: unknown): ProductCoreDNA {
  const data = json as ProductCoreDNA
  if (!data || typeof data !== 'object' || !data.domain || !Array.isArray(data.nouns)) {
    throw new Error('Invalid product core DNA: missing required "domain" and/or "nouns"')
  }
  return data
}

export function parseProductApiDNA(json: unknown): ProductApiDNA {
  const data = json as ProductApiDNA
  if (!data || typeof data !== 'object' || !data.namespace || !Array.isArray(data.endpoints)) {
    throw new Error('Invalid product API DNA: missing required "namespace" and/or "endpoints"')
  }
  return data
}

export function parseProductUiDNA(json: unknown): ProductUiDNA {
  const data = json as ProductUiDNA
  if (!data || typeof data !== 'object' || !data.layout || !Array.isArray(data.pages) || !Array.isArray(data.routes)) {
    throw new Error('Invalid product UI DNA: missing required "layout", "pages", and/or "routes"')
  }
  return data
}

/**
 * Fetch a product DNA sub-layer from the dev middleware. The middleware
 * URL tokens use `-` instead of `.` because dots are awkward in URL path
 * segments; the middleware maps `product-core` → `product.core.json`,
 * `product-api` → `product.api.json`, `product-ui` → `product.ui.json`.
 */
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
