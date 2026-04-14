import { useEffect, useRef } from 'react'
import { dia, shapes } from '@joint/plus'
import { observer } from 'mobx-react-lite'
import type { GraphModel } from '../models/GraphModel.ts'
import type { ProductUiDNA } from '../loaders/product-loader.ts'
import { productUiToGraphCells } from '../mappers/product-ui-to-graph.ts'
import { ZoomHandler, PanHandler } from '../features/interaction.ts'

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
 * satellites. Structurally identical to ProductApiCanvas aside from
 * the mapper + shape imports. With four canvas variants now in the
 * codebase, the next time we touch this file we should extract the
 * shared paper setup into a `useJointPaper` hook.
 */
export const ProductUiCanvas = observer(function ProductUiCanvas({ model, dna }: ProductUiCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const paperEl = document.createElement('div')
    paperEl.style.width = '100%'
    paperEl.style.height = '100%'
    paperEl.style.opacity = '0'
    paperEl.style.transition = 'opacity 220ms ease-out'
    containerRef.current.appendChild(paperEl)

    const graph = new dia.Graph({}, { cellNamespace: shapes })
    const paper = new dia.Paper({
      el: paperEl,
      model: graph,
      width: '100%',
      height: '100%',
      background: { color: '#0f172a' },
      gridSize: 10,
      drawGrid: { name: 'dot', args: { color: '#1e293b' } },
      sorting: dia.Paper.sorting.APPROX,
      cellViewNamespace: shapes,
      interactive: {
        elementMove: true,
        linkMove: true,
        labelMove: true,
      },
      defaultRouter: {
        name: 'manhattan',
        args: { step: 20, padding: 16 },
      },
      defaultConnector: { name: 'rounded', args: { radius: 6 } },
      embeddingMode: true,
      validateEmbedding: (_childView, parentView) => {
        return parentView.model.get('type') === 'cbaViz.ZoneContainer'
      },
    })

    model.setGraph(graph)
    model.setPaper(paper)

    const cells = productUiToGraphCells(dna)
    graph.resetCells(cells)

    graph.on('change:position', () => model.setDirty(true))
    graph.on('change:size', () => model.setDirty(true))
    graph.on('change:vertices', () => model.setDirty(true))
    graph.on('add', () => model.setDirty(true))
    graph.on('remove', () => model.setDirty(true))

    const zoomHandler = new ZoomHandler({
      paper,
      container: containerRef.current,
      onScaleChange: (scale) => model.setScale(scale),
    })
    const panHandler = new PanHandler({ paper })

    paper.on('cell:pointerclick', (cellView: dia.CellView) => {
      model.setSelectedCellView(cellView)
    })
    paper.on('blank:pointerclick', () => {
      model.setSelectedCellView(null)
    })

    paper.on('blank:pointerdown', (evt: dia.Event) => {
      const e = evt as unknown as MouseEvent
      panHandler.startPan(e.clientX, e.clientY)
    })

    const handleWheel = (evt: WheelEvent) => {
      evt.preventDefault()
      if (evt.ctrlKey || evt.metaKey) {
        zoomHandler.zoomAtPoint(evt.clientX, evt.clientY, evt.deltaY < 0)
      } else {
        panHandler.pan(-evt.deltaX, -evt.deltaY)
      }
    }
    containerRef.current.addEventListener('wheel', handleWheel, { passive: false })

    requestAnimationFrame(() => {
      try { zoomHandler.fitToContent() } catch (_) { /* paper may be removed */ }
      requestAnimationFrame(() => {
        paperEl.style.opacity = '1'
      })
    })

    return () => {
      containerRef.current?.removeEventListener('wheel', handleWheel)
      panHandler.cleanup()
      graph.clear()
      paper.remove()
      if (paperEl.parentNode) paperEl.parentNode.removeChild(paperEl)
      model.cleanup()
    }
  }, [dna, model])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
    />
  )
})
