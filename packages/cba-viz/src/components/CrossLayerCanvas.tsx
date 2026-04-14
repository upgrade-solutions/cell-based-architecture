import { useEffect, useRef } from 'react'
import { dia, shapes } from '@joint/plus'
import { observer } from 'mobx-react-lite'
import type { GraphModel } from '../models/GraphModel.ts'
import type { OperationalDNA } from '../loaders/operational-loader.ts'
import type { ProductApiDNA, ProductUiDNA } from '../loaders/product-loader.ts'
import { crossLayerToGraphCells } from '../mappers/cross-layer-to-graph.ts'
import { ZoomHandler, PanHandler } from '../features/interaction.ts'
import { CapabilityPicker } from './CapabilityPicker.tsx'

// Register all shapes that the cross-layer mapper might use so JointJS
// can deserialize them by type.
import '../shapes/operational/CapabilityShape.ts'
import '../shapes/operational/RuleShape.ts'
import '../shapes/operational/OutcomeShape.ts'
import '../shapes/product/ResourceShape.ts'
import '../shapes/product/EndpointShape.ts'
import '../shapes/product/PageShape.ts'
import '../shapes/product/BlockShape.ts'
import '../shapes/ZoneContainer.ts'

interface CrossLayerCanvasProps {
  model: GraphModel
  operationalDna: OperationalDNA
  productApiDna: ProductApiDNA | null
  productUiDna: ProductUiDNA | null
  capabilityName: string | null
  onCapabilityChange: (name: string | null) => void
}

/**
 * Capability-centric canvas spanning Operational → Product API → Product UI.
 *
 * Reuses the shapes from all three layers so clicking any element
 * opens its normal RJSF inspector form via the sidebar's (layer, kind)
 * routing. A floating CapabilityPicker overlays the top-left corner
 * for selecting which capability to explore.
 *
 * This is the sixth canvas variant in the codebase — next touch of
 * any canvas file should extract the shared JointJS paper setup
 * (paper creation, zoom, pan, fade-in, selection handlers) into a
 * `useJointPaper` hook. For now the duplication is controlled.
 */
export const CrossLayerCanvas = observer(function CrossLayerCanvas({
  model,
  operationalDna,
  productApiDna,
  productUiDna,
  capabilityName,
  onCapabilityChange,
}: CrossLayerCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const paperContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!paperContainerRef.current) return

    const paperEl = document.createElement('div')
    paperEl.style.width = '100%'
    paperEl.style.height = '100%'
    paperEl.style.opacity = '0'
    paperEl.style.transition = 'opacity 220ms ease-out'
    paperContainerRef.current.appendChild(paperEl)

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
        // Cross-layer is read-only exploration — dragging is allowed
        // (you can rearrange for readability) but the results aren't
        // persisted anywhere. App.tsx blocks saves from this view.
        elementMove: true,
        linkMove: false,
        labelMove: false,
      },
      defaultRouter: { name: 'manhattan', args: { step: 20, padding: 16 } },
      defaultConnector: { name: 'rounded', args: { radius: 6 } },
      embeddingMode: true,
      validateEmbedding: (_childView, parentView) => {
        return parentView.model.get('type') === 'cbaViz.ZoneContainer'
      },
    })

    model.setGraph(graph)
    model.setPaper(paper)

    const cells = crossLayerToGraphCells({
      operationalDna,
      productApiDna,
      productUiDna,
      capabilityName,
    })
    graph.resetCells(cells)

    // Dirty tracking still runs so layout drags feel alive, but
    // handleSave in App.tsx refuses to persist from this canvas.
    graph.on('change:position', () => model.setDirty(true))
    graph.on('change:size', () => model.setDirty(true))
    graph.on('change:vertices', () => model.setDirty(true))

    const zoomHandler = new ZoomHandler({
      paper,
      container: paperContainerRef.current,
      onScaleChange: (scale) => model.setScale(scale),
    })
    const panHandler = new PanHandler({ paper })

    paper.on('cell:pointerclick', (cellView: dia.CellView) => {
      // Bands and banners don't have a schema-backed dna.layer so the
      // sidebar will ignore them — but we still set the selection so
      // the canvas shows the "you clicked this" highlight.
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
    paperContainerRef.current.addEventListener('wheel', handleWheel, { passive: false })

    requestAnimationFrame(() => {
      try { zoomHandler.fitToContent() } catch (_) { /* paper may be removed */ }
      requestAnimationFrame(() => {
        paperEl.style.opacity = '1'
      })
    })

    return () => {
      paperContainerRef.current?.removeEventListener('wheel', handleWheel)
      panHandler.cleanup()
      graph.clear()
      paper.remove()
      if (paperEl.parentNode) paperEl.parentNode.removeChild(paperEl)
      model.cleanup()
    }
  }, [operationalDna, productApiDna, productUiDna, capabilityName, model])

  return (
    <div ref={containerRef} style={outerStyle}>
      <div ref={paperContainerRef} style={paperStyle} />

      <CapabilityPicker
        capabilities={operationalDna.capabilities ?? []}
        selected={capabilityName}
        onChange={onCapabilityChange}
      />

      {capabilityName === null ? (
        <div style={emptyHintStyle}>
          Pick a capability from the chip in the top-left to explore its full footprint across Operational,
          Product API, and Product UI.
        </div>
      ) : null}
    </div>
  )
})

// ── Styles ──────────────────────────────────────────────────────────────

const outerStyle: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
}

const paperStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
}

const emptyHintStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  maxWidth: 480,
  textAlign: 'center',
  padding: 24,
  background: '#1e293b',
  border: '1px dashed #475569',
  borderRadius: 6,
  color: '#94a3b8',
  fontSize: 13,
  lineHeight: 1.6,
  fontFamily: '-apple-system, sans-serif',
  pointerEvents: 'none',
}
