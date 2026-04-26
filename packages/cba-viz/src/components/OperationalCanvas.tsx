import { useEffect, useRef } from 'react'
import { observer } from 'mobx-react-lite'
import type { GraphModel } from '../models/GraphModel.ts'
import type { OperationalDNA } from '../loaders/operational-loader.ts'
import { operationalToGraphCells } from '../mappers/operational-to-graph.ts'
import { mountJointPaper } from '../features/joint-paper.ts'

// Register operational shapes so JointJS can deserialize them by type.
// Each shape file self-registers on import; we just need to reach the
// side effect.
import '../shapes/operational/NounShape.ts'
import '../shapes/operational/OperationShape.ts'
import '../shapes/operational/RuleShape.ts'
import '../shapes/operational/TriggerShape.ts'
import '../shapes/operational/ProcessShape.ts'
import '../shapes/ZoneContainer.ts'

interface OperationalCanvasProps {
  model: GraphModel
  dna: OperationalDNA
}

/**
 * Canvas for the Operational DNA layer — renders Nouns, Capabilities,
 * Rules, Outcomes, and Signals grouped by domain.
 *
 * Paper setup lives in `mountJointPaper` — this component is just the
 * React-side mount point, the DNA → cells transformation, and the
 * effect lifecycle.
 */
export const OperationalCanvas = observer(function OperationalCanvas({ model, dna }: OperationalCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    return mountJointPaper(containerRef.current, {
      model,
      cells: operationalToGraphCells(dna),
    })
  }, [dna, model])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
    />
  )
})
