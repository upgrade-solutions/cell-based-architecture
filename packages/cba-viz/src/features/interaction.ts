import { dia } from '@joint/plus'

/**
 * Zoom handler for the JointJS paper.
 */
export class ZoomHandler {
  private paper: dia.Paper
  private minScale: number
  private maxScale: number
  private zoomFactor: number
  private onScaleChange: (scale: number) => void

  constructor(opts: {
    paper: dia.Paper
    container: HTMLElement
    minScale?: number
    maxScale?: number
    zoomFactor?: number
    onScaleChange: (scale: number) => void
  }) {
    this.paper = opts.paper
    this.minScale = opts.minScale ?? 0.2
    this.maxScale = opts.maxScale ?? 3
    this.zoomFactor = opts.zoomFactor ?? 1.1
    this.onScaleChange = opts.onScaleChange
  }

  zoomAtPoint(clientX: number, clientY: number, zoomIn: boolean) {
    const paper = this.paper
    const currentScale = paper.scale().sx
    const newScale = zoomIn
      ? Math.min(currentScale * this.zoomFactor, this.maxScale)
      : Math.max(currentScale / this.zoomFactor, this.minScale)

    const localPoint = paper.clientToLocalPoint({ x: clientX, y: clientY })
    paper.scale(newScale, newScale)
    const newLocalPoint = paper.clientToLocalPoint({ x: clientX, y: clientY })

    const tx = paper.translate()
    paper.translate(
      tx.tx + (newLocalPoint.x - localPoint.x) * newScale,
      tx.ty + (newLocalPoint.y - localPoint.y) * newScale,
    )

    this.onScaleChange(newScale)
  }

  zoomTo(scale: number) {
    const clamped = Math.max(this.minScale, Math.min(this.maxScale, scale))
    this.paper.scale(clamped, clamped)
    this.onScaleChange(clamped)
  }

  fitToContent() {
    this.paper.scaleContentToFit({
      padding: 60,
      minScale: this.minScale,
      maxScale: 1.5,
    })
    this.onScaleChange(this.paper.scale().sx)
  }
}

/**
 * Pan handler — drag to pan the canvas.
 */
export class PanHandler {
  private paper: dia.Paper
  private panning = false
  private startX = 0
  private startY = 0

  private boundMove: (e: MouseEvent) => void
  private boundUp: () => void

  constructor(opts: { paper: dia.Paper }) {
    this.paper = opts.paper
    this.boundMove = this.onMove.bind(this)
    this.boundUp = this.stopPan.bind(this)
  }

  startPan(clientX: number, clientY: number) {
    this.panning = true
    this.startX = clientX
    this.startY = clientY
    document.addEventListener('mousemove', this.boundMove)
    document.addEventListener('mouseup', this.boundUp)
  }

  private onMove(e: MouseEvent) {
    if (!this.panning) return
    const dx = e.clientX - this.startX
    const dy = e.clientY - this.startY
    this.startX = e.clientX
    this.startY = e.clientY
    this.pan(dx, dy)
  }

  pan(dx: number, dy: number) {
    const tx = this.paper.translate()
    this.paper.translate(tx.tx + dx, tx.ty + dy)
  }

  private stopPan() {
    this.panning = false
    document.removeEventListener('mousemove', this.boundMove)
    document.removeEventListener('mouseup', this.boundUp)
  }

  cleanup() {
    this.stopPan()
  }
}
