import type { dia } from '@joint/plus'
import type { ProductCoreDNA } from '../loaders/product-loader.ts'
import type { OperationalDNA } from '../loaders/operational-loader.ts'
import { operationalToGraphCells } from './operational-to-graph.ts'

/**
 * Product Core → JointJS cells.
 *
 * Product core is a materialized slice of Operational DNA — the
 * per-primitive shapes (Noun, Capability, Rule, Outcome, Signal,
 * Cause, Relationship, Equation) are all identical. The
 * only structural difference is the domain wrapper: operational uses
 * a nested `Domain { domains[], nouns[] }` hierarchy, while product
 * core flattens everything — `nouns[]` lives at the document root.
 *
 * Rather than duplicate the mapper + shapes, we adapt the flat core
 * document into the nested operational shape and delegate. The
 * operational mapper's `pickLeafDomain` routine is fine with a
 * single-level domain tree, and downstream rendering doesn't care
 * whether the data came from operational.json or product.core.json.
 *
 * This means Product Core renders with the exact same visual palette
 * as Operational (slate Nouns, emerald Capability pills, amber/cyan
 * Rule hexagons, etc.). The value of the separate canvas is the
 * different data source — the user sees the *materialized subset* of
 * operational that product surfaces actually consume, which is what
 * the downstream cells read.
 */
export function productCoreToGraphCells(dna: ProductCoreDNA): dia.Cell[] {
  return operationalToGraphCells(productCoreToOperational(dna))
}

/**
 * Wrap a flat Product Core document into the nested shape the
 * operational mapper consumes. Pure, side-effect-free — returns a new
 * object with the same primitive arrays and a synthetic Domain node.
 */
export function productCoreToOperational(dna: ProductCoreDNA): OperationalDNA {
  return {
    domain: {
      name: dna.domain.name,
      path: dna.domain.path,
      description: dna.domain.description,
      nouns: dna.nouns,
    },
    capabilities: dna.capabilities,
    causes: dna.causes,
    rules: dna.rules,
    outcomes: dna.outcomes,
    equations: dna.equations,
    signals: dna.signals,
    relationships: dna.relationships,
    // Product core doesn't have a layouts[] field in its schema yet.
    // When we add layout persistence for product-core saves, it can
    // either mirror the operational approach (top-level `layouts`) or
    // live in a sibling file — decide in Phase 5c.3 persistence work.
    layouts: undefined,
  }
}
