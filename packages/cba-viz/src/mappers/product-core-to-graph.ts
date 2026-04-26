import type { dia } from '@joint/plus'
import type { ProductCoreDNA } from '../loaders/product-loader.ts'
import type { OperationalDNA, Operation, Resource } from '../loaders/operational-loader.ts'
import { operationalToGraphCells } from './operational-to-graph.ts'

/**
 * Product Core → JointJS cells.
 *
 * Product Core is a materialized slice of Operational DNA — the
 * per-primitive shapes (Resource, Operation, Trigger, Rule, Process)
 * are all identical. The only structural difference is the domain
 * wrapper: operational uses a nested `Domain { domains[], resources[],
 * persons[], roles[], groups[] }` hierarchy, while product core flattens
 * everything — `resources[]` lives at the document root.
 *
 * Rather than duplicate the mapper + shapes, we adapt the flat core
 * document into the nested operational shape and delegate. The
 * operational mapper is fine with a single-level domain tree, and
 * downstream rendering doesn't care which file the data came from.
 */
export function productCoreToGraphCells(dna: ProductCoreDNA): dia.Cell[] {
  return operationalToGraphCells(productCoreToOperational(dna))
}

/**
 * Wrap a flat Product Core document into the nested operational shape
 * the operational mapper consumes. Pure, side-effect-free — returns a
 * new object with the same primitive arrays and a synthetic Domain.
 *
 * Product Core's Operation type uses an optional `target` field instead
 * of operational's required `target`. We default to empty when absent
 * so the operational mapper's grouping doesn't trip over undefined.
 */
export function productCoreToOperational(dna: ProductCoreDNA): OperationalDNA {
  const operations: Operation[] = (dna.operations ?? []).map((op) => ({
    id: op.id,
    name: op.name,
    target: op.target,
    action: op.action,
    description: op.description,
    changes: op.changes,
  }))

  return {
    domain: {
      name: dna.domain.name,
      path: dna.domain.path,
      description: dna.domain.description,
      // Product Core's resources[] map directly to operational Resource[].
      // Person/Role/Group don't ride along — those are operational-only.
      resources: dna.resources as Resource[] | undefined,
    },
    operations,
    triggers: dna.triggers,
    relationships: dna.relationships,
    layouts: undefined,
  }
}
