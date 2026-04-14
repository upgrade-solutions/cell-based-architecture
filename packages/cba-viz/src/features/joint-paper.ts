import { dia, shapes } from '@joint/plus'
import type { GraphModel } from '../models/GraphModel.ts'
import { ZoomHandler, PanHandler } from './interaction.ts'

/**
 * Imperative JointJS paper mount — the shared plumbing that every canvas
 * variant in cba-viz needs. Extracted after the sixth canvas component
 * (CrossLayerCanvas) because the duplication had grown to ~120 lines per
 * canvas of identical boilerplate with a few varying knobs.
 *
 * Responsibilities:
 *   1. Create a child div inside the React-managed container so
 *      `paper.remove()` doesn't destroy the React node
 *   2. Start the paper at opacity 0 and fade in after fit-to-content
 *      so every re-mount eases in instead of flashing
 *   3. Create the Graph + Paper with the standard dark-theme config
 *      (dot grid, manhattan routing, embedding mode, zone-only embed
 *      validation)
 *   4. Wire model.setGraph / setPaper and dirty tracking on the five
 *      relevant graph events (change:position/size/vertices/add/remove)
 *   5. Install zoom, pan, wheel, and selection handlers
 *   6. Call the caller's `onPaperReady` for any per-canvas custom wiring,
 *      then fit-to-content + fade in
 *   7. Return a cleanup function that undoes everything in reverse
 *
 * Not a hook — an imperative function that lives inside a `useEffect`.
 * This shape avoids React's stale-closure footguns around deps lists,
 * stays type-friendly, and keeps each canvas component tiny (~15 lines
 * instead of ~120).
 */

export interface MountJointPaperOptions {
  /** The model that gets .setGraph / .setPaper / dirty tracking wired. */
  model: GraphModel
  /** Cells to seed the graph with on mount. */
  cells: dia.Cell[]
  /**
   * Override for the manhattan router args. Default suits operational +
   * product canvases: `{ step: 20, padding: 16 }`. TechnicalCanvas passes
   * `{ step: 20, padding: 20, startDirections: ['bottom'], endDirections: ['top'] }`
   * to force its top-to-bottom deployment flow.
   */
  routerArgs?: Record<string, unknown>
  /**
   * Override for the rounded connector args. Default `{ radius: 6 }`.
   * TechnicalCanvas uses `{ radius: 8 }` for its slightly softer
   * deployment-graph corners.
   */
  connectorArgs?: Record<string, unknown>
  /**
   * Per-canvas interactive overrides. All default to `true` — matches
   * the operational + product editing behavior. CrossLayerCanvas sets
   * linkMove + labelMove to `false` for its read-only exploration mode.
   */
  interactive?: {
    elementMove?: boolean
    linkMove?: boolean
    labelMove?: boolean
  }
  /**
   * Optional hook called once after the paper is fully set up — attach
   * canvas-specific event handlers and return a cleanup function that
   * runs before the shared teardown. TechnicalCanvas uses this for its
   * urlLabel click-through handler.
   */
  onPaperReady?: (paper: dia.Paper, graph: dia.Graph) => (() => void) | void
}

/**
 * Mount a JointJS paper inside `container`. Returns a cleanup fn that
 * tears down the paper, removes listeners, and resets the model.
 *
 * Typical usage inside a canvas component:
 *
 *   useEffect(() => {
 *     if (!containerRef.current) return
 *     return mountJointPaper(containerRef.current, {
 *       model,
 *       cells: operationalToGraphCells(dna),
 *     })
 *   }, [dna, model])
 */
export function mountJointPaper(
  container: HTMLDivElement,
  opts: MountJointPaperOptions,
): () => void {
  // Create a child element for JointJS so paper.remove() doesn't
  // destroy the React-managed container div. Start hidden and fade in
  // after fit-to-content so every re-mount eases in instead of flashing.
  const paperEl = document.createElement('div')
  paperEl.style.width = '100%'
  paperEl.style.height = '100%'
  paperEl.style.opacity = '0'
  paperEl.style.transition = 'opacity 220ms ease-out'
  container.appendChild(paperEl)

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
      elementMove: opts.interactive?.elementMove ?? true,
      linkMove: opts.interactive?.linkMove ?? true,
      labelMove: opts.interactive?.labelMove ?? true,
    },
    defaultRouter: {
      name: 'manhattan',
      args: opts.routerArgs ?? { step: 20, padding: 16 },
    },
    defaultConnector: {
      name: 'rounded',
      args: opts.connectorArgs ?? { radius: 6 },
    },
    embeddingMode: true,
    validateEmbedding: (_childView, parentView) => {
      // Only allow embedding into zone containers. Prevents accidental
      // drops of nouns inside capabilities, etc.
      return parentView.model.get('type') === 'cbaViz.ZoneContainer'
    },
  })

  opts.model.setGraph(graph)
  opts.model.setPaper(paper)

  // Seed the graph
  graph.resetCells(opts.cells)

  // Dirty tracking — any user-initiated mutation triggers the save button.
  graph.on('change:position', () => opts.model.setDirty(true))
  graph.on('change:size', () => opts.model.setDirty(true))
  graph.on('change:vertices', () => opts.model.setDirty(true))
  graph.on('add', () => opts.model.setDirty(true))
  graph.on('remove', () => opts.model.setDirty(true))

  // Zoom handler — wires mouse wheel to scale and reports back to the
  // model for the toolbar's zoom-percent readout.
  const zoomHandler = new ZoomHandler({
    paper,
    container,
    onScaleChange: (scale) => opts.model.setScale(scale),
  })

  // Pan handler — blank drag to move the viewport.
  const panHandler = new PanHandler({ paper })

  // Selection — click any cell to inspect; click blank to deselect.
  paper.on('cell:pointerclick', (cellView: dia.CellView) => {
    opts.model.setSelectedCellView(cellView)
  })
  paper.on('blank:pointerclick', () => {
    opts.model.setSelectedCellView(null)
  })
  paper.on('blank:pointerdown', (evt: dia.Event) => {
    const e = evt as unknown as MouseEvent
    panHandler.startPan(e.clientX, e.clientY)
  })

  // Wheel — Ctrl/Cmd+scroll zooms at the cursor, plain scroll pans.
  const handleWheel = (evt: WheelEvent) => {
    evt.preventDefault()
    if (evt.ctrlKey || evt.metaKey) {
      zoomHandler.zoomAtPoint(evt.clientX, evt.clientY, evt.deltaY < 0)
    } else {
      panHandler.pan(-evt.deltaX, -evt.deltaY)
    }
  }
  container.addEventListener('wheel', handleWheel, { passive: false })

  // Per-canvas custom wiring (e.g. TechnicalCanvas's urlLabel
  // click-through). Must return its own cleanup; runs before the
  // main teardown.
  const extraCleanup = opts.onPaperReady?.(paper, graph)

  // Fit to content then fade in. Double-rAF so the browser commits
  // the initial cell layout before the opacity transition starts —
  // otherwise Chrome sometimes skips the animation.
  requestAnimationFrame(() => {
    try { zoomHandler.fitToContent() } catch (_) { /* paper may be removed */ }
    requestAnimationFrame(() => {
      paperEl.style.opacity = '1'
    })
  })

  return () => {
    if (typeof extraCleanup === 'function') extraCleanup()
    container.removeEventListener('wheel', handleWheel)
    panHandler.cleanup()
    graph.clear()
    paper.remove()
    // paper.remove() cleans up JointJS internals but doesn't detach
    // the child div we created. Remove it explicitly so re-runs don't
    // stack papers on top of each other.
    if (paperEl.parentNode) paperEl.parentNode.removeChild(paperEl)
    //
    // Intentionally NOT calling `opts.model.cleanup()` here.
    //
    // This cleanup runs on every data-driven effect re-run (dna
    // change, view switch, etc.), not just on full component unmount.
    // `GraphModel.cleanup()` resets dirty/scale/selection — fine for
    // unmount, wrong for a re-mount. The bug it caused: deleting a
    // primitive marked the graph dirty, the DNA state update triggered
    // a canvas re-mount, this cleanup wiped `dirty` back to false, and
    // the user's delete never reached the save path. Leaving the model
    // alone here keeps dirty/scale sticky across data changes; the new
    // setup below overwrites `graph` + `paper` references cleanly and
    // the old JointJS objects are already disposed via `graph.clear()`
    // and `paper.remove()` above.
    //
    // We DO clear `selectedCellView` because the cell view it points at
    // was just destroyed — reading from it would crash the sidebar or
    // show stale data from a cell that no longer exists. Dirty + scale
    // are the only things that need to survive a re-mount.
    opts.model.setSelectedCellView(null)
  }
}
