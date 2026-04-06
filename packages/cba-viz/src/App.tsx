import { useMemo, useState, useCallback, useEffect } from 'react'
import { observer } from 'mobx-react-lite'
import { GraphModel } from './models/GraphModel.ts'
import { parseArchitectureDNA, type ArchitectureDNA } from './loaders/dna-loader.ts'
import { graphToArchView, saveViews } from './features/persistence.ts'
import { Canvas } from './components/Canvas.tsx'
import { Toolbar } from './components/Toolbar.tsx'
import { Sidebar } from './components/Sidebar.tsx'
import { Layout } from './components/Layout.tsx'

const App = observer(function App() {
  const graphModel = useMemo(() => new GraphModel(), [])
  const [saving, setSaving] = useState(false)
  const [dna, setDna] = useState<ArchitectureDNA | null>(null)
  const [currentViewName, setCurrentViewName] = useState('deployment')

  // Load DNA from the dev server API at runtime
  useEffect(() => {
    fetch('/api/load-views/lending')
      .then(r => r.json())
      .then(json => setDna(parseArchitectureDNA(json)))
      .catch(err => console.error('Failed to load DNA:', err))
  }, [])

  const viewNames = dna?.views.map(v => v.name) ?? []
  const currentView = dna?.views.find(v => v.name === currentViewName) ?? dna?.views[0]

  const handleSave = useCallback(async () => {
    if (!graphModel.graph || !currentView) return
    setSaving(true)
    try {
      // Extract current graph state back to DNA format
      const updatedView = graphToArchView(graphModel.graph, currentViewName, currentView!)

      // Update the view in-place
      const updatedDna = {
        views: dna!.views.map(v => v.name === currentViewName ? updatedView : v),
      }

      await saveViews('lending', updatedDna)
      graphModel.setDirty(false)
    } catch (err) {
      console.error('Save failed:', err)
      alert(`Save failed: ${(err as Error).message}`)
    } finally {
      setSaving(false)
    }
  }, [graphModel, currentView, currentViewName, dna])

  // Keyboard shortcut: Ctrl/Cmd+S to save
  useMemo(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (graphModel.dirty) handleSave()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [graphModel.dirty, handleSave])

  if (!dna || !currentView) {
    return <div style={{ padding: 40, color: '#f8fafc' }}>Loading…</div>
  }

  return (
    <Layout
      toolbar={
        <Toolbar
          model={graphModel}
          viewNames={viewNames}
          currentView={currentViewName}
          onViewChange={setCurrentViewName}
          onSave={handleSave}
          saving={saving}
        />
      }
      canvas={
        <Canvas
          key={currentViewName}
          model={graphModel}
          view={currentView}
        />
      }
      sidebar={
        <Sidebar model={graphModel} />
      }
    />
  )
})

export default App
