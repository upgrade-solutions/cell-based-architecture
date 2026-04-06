import { useMemo, useState, useCallback } from 'react'
import { observer } from 'mobx-react-lite'
import { GraphModel } from './models/GraphModel.ts'
import { parseArchitectureDNA } from './loaders/dna-loader.ts'
import { graphToArchView } from './features/persistence.ts'
import { saveArchitectureDNA } from './features/persistence.ts'
import { Canvas } from './components/Canvas.tsx'
import { Toolbar } from './components/Toolbar.tsx'
import { Sidebar } from './components/Sidebar.tsx'
import { Layout } from './components/Layout.tsx'

// Import the lending architecture DNA at build time
import lendingArchJson from '../../dna/lending/architecture.json'

const App = observer(function App() {
  const graphModel = useMemo(() => new GraphModel(), [])
  const [saving, setSaving] = useState(false)

  // Parse the DNA
  const dna = useMemo(() => parseArchitectureDNA(lendingArchJson), [])
  const viewNames = dna.views.map(v => v.name)
  const [currentViewName, setCurrentViewName] = useState(viewNames[0] ?? 'deployment')
  const currentView = dna.views.find(v => v.name === currentViewName) ?? dna.views[0]

  const handleSave = useCallback(async () => {
    if (!graphModel.graph || !currentView) return
    setSaving(true)
    try {
      // Extract current graph state back to DNA format
      const updatedView = graphToArchView(graphModel.graph, currentViewName, currentView)

      // Update the view in-place
      const updatedDna = {
        views: dna.views.map(v => v.name === currentViewName ? updatedView : v),
      }

      await saveArchitectureDNA('lending', updatedDna)
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

  if (!currentView) {
    return <div style={{ padding: 40, color: '#f8fafc' }}>No views found in architecture DNA.</div>
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
