import { useEffect, useRef } from 'react'
import { observer } from 'mobx-react-lite'
import type { GraphModel } from '../models/GraphModel.ts'
import type { ProductUiDNA } from '../loaders/product-loader.ts'
import { productUiToGraphCells } from '../mappers/product-ui-to-graph.ts'
import { mountJointPaper } from '../features/joint-paper.ts'

// Register product UI shapes
import '../shapes/product/PageShape.ts'
import '../shapes/product/BlockShape.ts'
import '../shapes/ZoneContainer.ts'

interface ProductUiCanvasProps {
  model: GraphModel
  dna: ProductUiDNA
}

/**
 * Canvas for the Product UI layer — layout zone, page cards, block
 * satellites. Paper plumbing lives in `mountJointPaper`.
 */
export const ProductUiCanvas = observer(function ProductUiCanvas({ model, dna }: ProductUiCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    return mountJointPaper(containerRef.current, {
      model,
      cells: productUiToGraphCells(dna),
    })
  }, [dna, model])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
    />
  )
})
