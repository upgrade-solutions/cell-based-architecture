import { useMemo } from 'react'
import type { GraphModel } from '../models/GraphModel.ts'
import type { ProductCoreDNA } from '../loaders/product-loader.ts'
import { productCoreToOperational } from '../mappers/product-core-to-graph.ts'
import { OperationalCanvas } from './OperationalCanvas.tsx'

interface ProductCoreCanvasProps {
  model: GraphModel
  dna: ProductCoreDNA
}

/**
 * Canvas for the Product Core layer — the materialized subset of
 * Operational DNA that product surfaces (API + UI) actually consume.
 *
 * Product Core reuses Operational's entire visual language — same
 * shape palette, same mapper, same inspector forms. The only thing
 * that differs is the data source: operational.json is the unfiltered
 * business logic, product.core.json is the subset downstream cells
 * read. Rendering them side by side (via the Toolbar tab) lets you
 * see at a glance what your product surfaces actually need from
 * operational versus what's "dark" (defined but never surfaced).
 *
 * Implementation is a one-line adapter delegation to OperationalCanvas
 * — the operational mapper expects `OperationalDNA` with a nested
 * domain hierarchy, and product core just wraps its flat nouns[] into
 * a synthetic single-level domain. `useMemo` keeps the adapted object
 * referentially stable so the underlying canvas doesn't tear down and
 * rebuild unless the source data actually changes.
 */
export function ProductCoreCanvas({ model, dna }: ProductCoreCanvasProps) {
  const adapted = useMemo(() => productCoreToOperational(dna), [dna])
  return <OperationalCanvas model={model} dna={adapted} />
}
