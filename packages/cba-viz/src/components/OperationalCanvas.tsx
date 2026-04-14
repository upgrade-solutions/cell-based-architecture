import { useEffect, useRef } from 'react'
import { dia, shapes } from '@joint/plus'
import { observer } from 'mobx-react-lite'
import type { GraphModel } from '../models/GraphModel.ts'
import type { OperationalDNA } from '../loaders/operational-loader.ts'
import { operationalToGraphCells } from '../mappers/operational-to-graph.ts'
import { ZoomHandler, PanHandler } from '../features/interaction.ts'

// Register operational shapes so JointJS can deserialize them by type.
// Each shape file self-registers on import; we just need to reach the
// side effect.
import '../shapes/operational/NounShape.ts'
import '../shapes/operational/CapabilityShape.ts'
import '../shapes/operational/RuleShape.ts'
import '../shapes/operational/OutcomeShape.ts'
import '../shapes/operational/SignalShape.ts'
import '../shapes/ZoneContainer.ts'

interface OperationalCanvasProps {
  model: GraphModel
  dna: OperationalDNA
}

/**
 * Canvas for the Operational DNA layer — renders Nouns, Capabilities,
 * Rules, Outcomes, and Signals grouped by domain. Differs from the
 * Technical canvas in three ways:
 *
 *   1. It's driven by `operationalToGraphCells(dna)`, not `viewToGraphCells(view)`.
 *   2. Router defaults are orthogonal/manhattan without forced directions —
 *      the technical canvas forces top-to-bottom flow for deployment graphs,
 *      but operational relationships fan out in all directions (rules/outcomes
 *      orbit capabilities, signals sit off to the side).
 *   3. No URL-label click-through logic — operational nodes don't have
 *      deployed URLs.
 *
 * Zoom, pan, fade-in, selection handling, and the dirty-on-change wiring
 * all mirror TechnicalCanvas for consistency.
 */
export const OperationalCanvas = observer(function OperationalCanvas({ model, dna }: OperationalCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Create a child element for JointJS so paper.remove() doesn't
    // destroy our React-managed container div. Fade-in mirrors the
    // technical canvas — every re-render eases in rather than flashing.
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
      // Operational graphs fan out in all directions (rules orbit, signals
      // sit to the side, chained capabilities flow freely), so we don't
      // constrain the router's start/end directions like the technical
      // canvas does — that would force awkward U-shape detours here.
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

    // Populate graph from operational DNA
    const cells = operationalToGraphCells(dna)
    graph.resetCells(cells)

    // Mark dirty on any change — triggers the save button / Ctrl+S
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
