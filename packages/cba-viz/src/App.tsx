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

/**
 * Read adapter from ?adapter= URL param. If missing, derive from env via the
 * coupling rule (prod↔terraform/aws, dev↔docker-compose). Explicit ?adapter=
 * wins when present so a user can paste `?env=prod&adapter=docker-compose`
 * for debugging without us rewriting it.
 */
function getAdapter(envValue: string): string {
  const params = new URLSearchParams(window.location.search)
  const fromUrl = params.get('adapter')
  if (fromUrl) return fromUrl
  return envValue === 'prod' ? 'terraform/aws' : 'docker-compose'
}

const STATUS_POLL_MS = 5000

const App = observer(function App() {
  const graphModel = useMemo(() => new GraphModel(), [])
  const [saving, setSaving] = useState(false)
  const [dna, setDna] = useState<ArchitectureDNA | null>(null)
  const [currentViewName, setCurrentViewName] = useState('deployment')
  const liveStatus = useRef<Record<string, string>>({})
  const [domain] = useState(getDomain)
  const [env, setEnvState] = useState(getEnv)
  const [adapter, setAdapterState] = useState(() => getAdapter(getEnv()))

  // Env drives adapter via the coupling rule: technical.json carries
  // env-scoped construct variants (dev → local postgres/RabbitMQ, prod →
  // RDS/EventBridge) that only make sense against the matching delivery
  // adapter. Selecting `prod` routes status polling to `terraform/aws`,
  // `dev` to `docker-compose`. The derived adapter is read-only from the
  // sidebar's ADAPTER section — no direct selector in the toolbar.
  const setEnv = useCallback((next: string) => {
    setEnvState(next)
    setAdapterState(next === 'prod' ? 'terraform/aws' : 'docker-compose')
  }, [])

  // Reflect the current env + adapter in the URL so reloads preserve state
  // and copy-pasted URLs land on the same view. `replaceState` keeps this
  // out of browser history (otherwise every selector click adds an entry).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    params.set('domain', domain)
    params.set('env', env)
    params.set('adapter', adapter)
    const nextUrl = `${window.location.pathname}?${params.toString()}`
    if (nextUrl !== window.location.pathname + window.location.search) {
      window.history.replaceState(null, '', nextUrl)
    }
  }, [domain, env, adapter])

  // Load DNA from the dev server API at runtime (derived from technical.json)
  useEffect(() => {
    fetch(`/api/load-views/${encodeURIComponent(domain)}?env=${encodeURIComponent(env)}`)
      .then(r => r.json())
      .then(json => setDna(parseArchitectureDNA(json)))
      .catch(err => console.error('Failed to load DNA:', err))
  }, [domain, env])

  // Poll live status from the selected adapter and merge into DNA.
  // The change-detection check happens INSIDE the setDna updater so that:
  //   (a) we only skip when the DNA is loaded AND statuses actually match
  //   (b) a status response that arrives before load-views resolves doesn't
  //       poison the `liveStatus` cache, causing subsequent polls to no-op
  //
  // `env` is passed alongside `adapter` because technical.json has env-scoped
  // construct variants (dev: local postgres/RabbitMQ, prod: RDS/EventBridge).
  // The probe applies the env overlay before matching tfstate/docker.
  useEffect(() => {
    let active = true
    const poll = () => {
      fetch(`/api/status/${encodeURIComponent(domain)}?adapter=${encodeURIComponent(adapter)}&env=${encodeURIComponent(env)}`)
        .then(r => r.json())
        .then((statuses: Record<string, string>) => {
          if (!active) return
          setDna(current => {
            if (!current) return current
            const prev = liveStatus.current
            const changed =
              Object.keys(statuses).some(k => statuses[k] !== prev[k]) ||
              Object.keys(prev).some(k => !(k in statuses))
            if (!changed) return current
            liveStatus.current = statuses
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
        })
        .catch(() => { /* adapter not available — keep static statuses */ })
    }
    // Reset the cache when the adapter/domain/env changes so we re-apply fresh
    liveStatus.current = {}
    poll()
    const interval = setInterval(poll, STATUS_POLL_MS)
    return () => { active = false; clearInterval(interval) }
  }, [domain, adapter, env])

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
        <Sidebar model={graphModel} env={env} adapter={adapter} />
      }
    />
  )
})

export default App
