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

interface TechnicalCanvasProps {
  model: GraphModel
  view: ArchView
}

/**
 * Canvas for the Technical DNA layer — renders the derived deployment
 * graph (cells, constructs, providers) with zone containers. This is the
 * original status-polling, URL-ribbon-enabled canvas. Operational DNA
 * gets its own sibling canvas (`OperationalCanvas`) so the two layers
 * can evolve independently without cross-layer if-branches.
 */
export const TechnicalCanvas = observer(function TechnicalCanvas({ model, view }: TechnicalCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Create a child element for JointJS so paper.remove() doesn't
    // destroy our React-managed container div.
    //
    // Start at opacity 0 and fade in after the graph is built so that every
    // re-render (view switch, status flip rebuilds the DNA object, etc.)
    // eases in instead of flashing. Cleanup below destroys this element
    // entirely on re-run, so the next mount always starts fresh at 0.
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
        args: {
          step: 20,
          padding: 20,
          startDirections: ['bottom'],
          endDirections: ['top'],
        },
      },
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

    // Open the deployed URL when the urlLabel on a cell is clicked.
    // This event name pattern is `element:<selector>:pointerclick` in JointJS,
    // but to keep it portable we check the click target's selector manually.
    paper.on('element:pointerclick', (elementView: dia.ElementView, evt: dia.Event) => {
      const target = (evt as unknown as { target: Element }).target
      // Walk up the SVG parent chain to see if we hit a urlLabel text node
      let el: Element | null = target
      let hitUrlLabel = false
      while (el && el !== elementView.el) {
        if (el.getAttribute('joint-selector') === 'urlLabel') {
          hitUrlLabel = true
          break
        }
        el = el.parentElement
      }
      if (!hitUrlLabel) return
      const dna = elementView.model.get('dna') as { metadata?: { url?: string } } | undefined
      const url = dna?.metadata?.url
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
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

    // Fit to content after initial render, then fade in. Double-rAF so the
    // browser has committed the initial cell layout before the opacity
    // transition starts — otherwise Chrome sometimes skips the animation.
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
      // paper.remove() cleans up JointJS internals but doesn't necessarily
      // detach the parent div we created. Remove it explicitly so re-runs
      // of this effect don't stack papers on top of each other.
      if (paperEl.parentNode) paperEl.parentNode.removeChild(paperEl)
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
