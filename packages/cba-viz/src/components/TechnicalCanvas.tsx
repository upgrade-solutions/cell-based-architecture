import { useEffect, useRef } from 'react'
import type { dia } from '@joint/plus'
import { observer } from 'mobx-react-lite'
import type { GraphModel } from '../models/GraphModel.ts'
import type { ArchView } from '../loaders/dna-loader.ts'
import { viewToGraphCells } from '../mappers/dna-to-graph.ts'
import { mountJointPaper } from '../features/joint-paper.ts'

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
 * graph (cells, constructs, providers) with zone containers. This is
 * the status-polling, URL-ribbon-enabled canvas used under both
 * Build > Technical (authoring, no polling) and Run > Deployment
 * (polling + env selector). Status polling gating lives in App.tsx.
 *
 * Paper plumbing lives in `mountJointPaper`. The pieces unique to
 * Technical:
 *
 *   - Manhattan router with forced start/end directions so the
 *     deployment graph always flows top-to-bottom (frontend →
 *     backend → storage). Also a slightly softer connector corner
 *     radius (8 vs the 6 used by other canvases).
 *
 *   - An `element:pointerclick` handler that detects clicks on a
 *     cell's `urlLabel` child text node and opens the deployed URL
 *     in a new tab. Wired through the `onPaperReady` hook so the
 *     shared mount stays canvas-agnostic.
 */
export const TechnicalCanvas = observer(function TechnicalCanvas({ model, view }: TechnicalCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    return mountJointPaper(containerRef.current, {
      model,
      cells: viewToGraphCells(view),
      routerArgs: {
        step: 20,
        padding: 20,
        // Force top-to-bottom flow for deployment graphs: edges exit
        // the source's bottom and enter the target's top. Without
        // these the router picks L-shapes that run along the side
        // edges of target cells and makes the graph hard to read.
        startDirections: ['bottom'],
        endDirections: ['top'],
      },
      connectorArgs: { radius: 8 },
      onPaperReady: (paper) => {
        // URL ribbon click-through. The event name pattern in JointJS
        // is `element:<selector>:pointerclick`, but we check the click
        // target's selector manually to stay portable across JointJS
        // attribute naming conventions.
        const handleElementClick = (elementView: dia.ElementView, evt: dia.Event) => {
          const target = (evt as unknown as { target: Element }).target
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
        }
        paper.on('element:pointerclick', handleElementClick)
        return () => {
          paper.off('element:pointerclick', handleElementClick)
        }
      },
    })
  }, [view, model])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
    />
  )
})
