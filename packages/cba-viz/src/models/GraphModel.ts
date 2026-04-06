import { makeAutoObservable } from 'mobx'
import { dia } from '@joint/plus'

/**
 * MobX observable model for the graph state.
 * Central source of truth for all graph-related state.
 */
export class GraphModel {
  graph: dia.Graph | null = null
  paper: dia.Paper | null = null
  selectedCellView: dia.CellView | null = null
  scale: number = 1
  dirty: boolean = false

  constructor() {
    makeAutoObservable(this)
  }

  setGraph(graph: dia.Graph) {
    this.graph = graph
  }

  setPaper(paper: dia.Paper) {
    this.paper = paper
  }

  setSelectedCellView(cellView: dia.CellView | null) {
    this.selectedCellView = cellView
  }

  setScale(scale: number) {
    this.scale = scale
  }

  setDirty(dirty: boolean) {
    this.dirty = dirty
  }

  cleanup() {
    this.graph = null
    this.paper = null
    this.selectedCellView = null
    this.scale = 1
    this.dirty = false
  }
}
