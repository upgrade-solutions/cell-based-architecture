import { useEffect, useRef } from 'react'
import { observer } from 'mobx-react-lite'
import type { GraphModel } from '../models/GraphModel.ts'
import type { ProductApiDNA } from '../loaders/product-loader.ts'
import { productApiToGraphCells } from '../mappers/product-api-to-graph.ts'
import { mountJointPaper } from '../features/joint-paper.ts'

// Register product shapes so JointJS can deserialize them by type.
import '../shapes/product/ResourceShape.ts'
import '../shapes/product/EndpointShape.ts'
import '../shapes/ZoneContainer.ts'

interface ProductApiCanvasProps {
  model: GraphModel
  dna: ProductApiDNA
}

/**
 * Canvas for the Product API layer — namespace zones, resource cards,
 * endpoint satellites. Paper plumbing lives in `mountJointPaper`.
 */
export const ProductApiCanvas = observer(function ProductApiCanvas({ model, dna }: ProductApiCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    return mountJointPaper(containerRef.current, {
      model,
      cells: productApiToGraphCells(dna),
    })
  }, [dna, model])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
    />
  )
})
