import { useEffect, useRef } from 'react'
import { dia, shapes } from '@joint/plus'
import { observer } from 'mobx-react-lite'
import type { GraphModel } from '../models/GraphModel.ts'
import type { ArchView } from '../loaders/dna-loader.ts'
import { viewToGraphCells } from '../mappers/dna-to-graph.ts'
import { ZoomHandler, PanHandler } from '../features/interaction.ts'

// Register custom shapes
import '../shapes/CellShape.ts'
import '../shapes/ConstructShape.ts'
import '../shapes/ProviderShape.ts'
import '../shapes/ZoneContainer.ts'

interface CanvasProps {
  model: GraphModel
  view: ArchView
}

export const Canvas = observer(function Canvas({ model, view }: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Create a child element for JointJS so paper.remove() doesn't
    // destroy our React-managed container div
    const paperEl = document.createElement('div')
    paperEl.style.width = '100%'
    paperEl.style.height = '100%'
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
      defaultRouter: { name: 'manhattan', args: { step: 20, padding: 20 } },
      defaultConnector: { name: 'rounded', args: { radius: 8 } },
      embeddingMode: true,
      validateEmbedding: (_childView, parentView) => {
        // Only allow embedding into zone containers
        return parentView.model.get('type') === 'cbaViz.ZoneContainer'
      },
    })

    model.setGraph(graph)
    model.setPaper(paper)

    // Populate graph from view data
    const cells = viewToGraphCells(view)
    graph.resetCells(cells)

    // Mark dirty on any change
    graph.on('change:position', () => model.setDirty(true))
    graph.on('change:size', () => model.setDirty(true))
    graph.on('change:vertices', () => model.setDirty(true))
    graph.on('add', () => model.setDirty(true))
    graph.on('remove', () => model.setDirty(true))

    // Zoom handler
    const zoomHandler = new ZoomHandler({
      paper,
      container: containerRef.current,
      onScaleChange: (scale) => model.setScale(scale),
    })

    // Pan handler
    const panHandler = new PanHandler({ paper })

    // Selection handler
    paper.on('cell:pointerclick', (cellView: dia.CellView) => {
      model.setSelectedCellView(cellView)
    })
    paper.on('blank:pointerclick', () => {
      model.setSelectedCellView(null)
    })

    // Blank drag to pan
    paper.on('blank:pointerdown', (evt: dia.Event) => {
      const e = evt as unknown as MouseEvent
      panHandler.startPan(e.clientX, e.clientY)
    })

    // Wheel: Ctrl/Cmd + scroll = zoom, plain scroll = pan
    const handleWheel = (evt: WheelEvent) => {
      evt.preventDefault()
      if (evt.ctrlKey || evt.metaKey) {
        zoomHandler.zoomAtPoint(evt.clientX, evt.clientY, evt.deltaY < 0)
      } else {
        panHandler.pan(-evt.deltaX, -evt.deltaY)
      }
    }
    containerRef.current.addEventListener('wheel', handleWheel, { passive: false })

    // Fit to content after initial render
    requestAnimationFrame(() => {
      try { zoomHandler.fitToContent() } catch (_) { /* paper may be removed */ }
    })

    return () => {
      containerRef.current?.removeEventListener('wheel', handleWheel)
      panHandler.cleanup()
      graph.clear()
      paper.remove()
      model.cleanup()
    }
  }, [view, model])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
    />
  )
})
