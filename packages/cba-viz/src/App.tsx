import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import { observer } from 'mobx-react-lite'
import { GraphModel } from './models/GraphModel.ts'
import { parseArchitectureDNA, type ArchitectureDNA, type NodeStatus } from './loaders/dna-loader.ts'
import { graphToArchView, saveViews } from './features/persistence.ts'
import { Canvas } from './components/Canvas.tsx'
import { Toolbar } from './components/Toolbar.tsx'
import { Sidebar } from './components/Sidebar.tsx'
import { Layout } from './components/Layout.tsx'

/** Read domain from ?domain= URL param, default to 'lending' */
function getDomain(): string {
  const params = new URLSearchParams(window.location.search)
  return params.get('domain') ?? 'lending'
}

/** Read environment from ?env= URL param, default to 'dev' */
function getEnv(): string {
  const params = new URLSearchParams(window.location.search)
  return params.get('env') ?? 'dev'
}

/** Read adapter from ?adapter= URL param, default to 'docker-compose' */
function getAdapter(): string {
  const params = new URLSearchParams(window.location.search)
  return params.get('adapter') ?? 'docker-compose'
}

const STATUS_POLL_MS = 5000

const App = observer(function App() {
  const graphModel = useMemo(() => new GraphModel(), [])
  const [saving, setSaving] = useState(false)
  const [dna, setDna] = useState<ArchitectureDNA | null>(null)
  const [currentViewName, setCurrentViewName] = useState('deployment')
  const liveStatus = useRef<Record<string, string>>({})
  const [domain] = useState(getDomain)
  const [env, setEnv] = useState(getEnv)
  const [adapter, setAdapter] = useState(getAdapter)

  // Load DNA from the dev server API at runtime (derived from technical.json)
  useEffect(() => {
    fetch(`/api/load-views/${encodeURIComponent(domain)}?env=${encodeURIComponent(env)}`)
      .then(r => r.json())
      .then(json => setDna(parseArchitectureDNA(json)))
      .catch(err => console.error('Failed to load DNA:', err))
  }, [domain, env])

  // Poll live status from the selected adapter and merge into DNA
  useEffect(() => {
    let active = true
    const poll = () => {
      fetch(`/api/status/${encodeURIComponent(domain)}?adapter=${encodeURIComponent(adapter)}`)
        .then(r => r.json())
        .then((statuses: Record<string, string>) => {
          if (!active) return
          const prev = liveStatus.current
          // Only update if statuses actually changed
          const changed = Object.keys(statuses).some(k => statuses[k] !== prev[k])
            || Object.keys(prev).some(k => !(k in statuses))
          if (changed) {
            liveStatus.current = statuses
            // Merge into DNA — live status overrides static status
            setDna(current => {
              if (!current) return current
              return {
                ...current,
                views: current.views.map(view => ({
                  ...view,
                  nodes: view.nodes.map(node => {
                    const live = statuses[node.id] as NodeStatus | undefined
                    return live ? { ...node, status: live } : node
                  }),
                })),
              }
            })
          }
        })
        .catch(() => { /* adapter not available — keep static statuses */ })
    }
    poll()
    const interval = setInterval(poll, STATUS_POLL_MS)
    return () => { active = false; clearInterval(interval) }
  }, [domain, adapter])

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
        ...dna!,
        views: dna!.views.map(v => v.name === currentViewName ? updatedView : v),
      }

      await saveViews(domain, updatedDna)
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
          domain={domain}
          env={env}
          onEnvChange={setEnv}
          adapter={adapter}
          onAdapterChange={setAdapter}
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
