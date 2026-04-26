import { useEffect, useRef } from 'react'
import { observer } from 'mobx-react-lite'
import type { GraphModel } from '../models/GraphModel.ts'
import type { OperationalDNA } from '../loaders/operational-loader.ts'
import type { ProductApiDNA, ProductUiDNA } from '../loaders/product-loader.ts'
import { crossLayerToGraphCells } from '../mappers/cross-layer-to-graph.ts'
import { mountJointPaper } from '../features/joint-paper.ts'
import { CapabilityPicker } from './CapabilityPicker.tsx'

// Register all shapes that the cross-layer mapper might use so JointJS
// can deserialize them by type.
import '../shapes/operational/OperationShape.ts'
import '../shapes/operational/RuleShape.ts'
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
 * Capability-centric canvas spanning Operational → Product API →
 * Product UI. Reuses shapes from all three layers so clicking any
 * element opens its normal RJSF inspector form via the sidebar's
 * `(layer, kind)` routing.
 *
 * Paper plumbing lives in `mountJointPaper`. The pieces unique to
 * cross-layer:
 *
 *   - `linkMove` and `labelMove` interactive options disabled — the
 *     view is read-only exploration, positions can still be dragged
 *     for readability but link topology and label positions are
 *     locked.
 *
 *   - A separate inner `paperContainerRef` inside the outer wrapper
 *     so the `CapabilityPicker` overlay chip and the empty-state
 *     hint can float over the paper without getting clipped by the
 *     SVG boundary.
 */
export const CrossLayerCanvas = observer(function CrossLayerCanvas({
  model,
  operationalDna,
  productApiDna,
  productUiDna,
  capabilityName,
  onCapabilityChange,
}: CrossLayerCanvasProps) {
  const paperContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!paperContainerRef.current) return
    return mountJointPaper(paperContainerRef.current, {
      model,
      cells: crossLayerToGraphCells({
        operationalDna,
        productApiDna,
        productUiDna,
        capabilityName,
      }),
      interactive: {
        // Cross-layer is read-only exploration — dragging is allowed
        // (you can rearrange for readability) but link/label topology
        // stays locked. App.tsx also blocks saves from this view.
        elementMove: true,
        linkMove: false,
        labelMove: false,
      },
    })
  }, [operationalDna, productApiDna, productUiDna, capabilityName, model])

  return (
    <div style={outerStyle}>
      <div ref={paperContainerRef} style={paperStyle} />

      <CapabilityPicker
        operations={operationalDna.operations ?? []}
        selected={capabilityName}
        onChange={onCapabilityChange}
      />

      {capabilityName === null ? (
        <div style={emptyHintStyle}>
          Pick an operation from the chip in the top-left to explore its full footprint across Operational,
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
