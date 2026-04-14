import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import { observer } from 'mobx-react-lite'
import { GraphModel } from './models/GraphModel.ts'
import { parseArchitectureDNA, type ArchitectureDNA, type NodeStatus } from './loaders/dna-loader.ts'
import { loadOperationalDNA, type OperationalDNA } from './loaders/operational-loader.ts'
import {
  loadProductCoreDNA,
  loadProductApiDNA,
  loadProductUiDNA,
  type ProductCoreDNA,
  type ProductApiDNA,
  type ProductUiDNA,
} from './loaders/product-loader.ts'
import { graphToArchView, saveViews } from './features/persistence.ts'
import { graphToOperationalDNA, saveOperational } from './features/operational-persistence.ts'
import {
  graphToProductApiDNA,
  graphToProductUiDNA,
  saveProductApi,
  saveProductUi,
} from './features/product-persistence.ts'
import { TechnicalCanvas } from './components/TechnicalCanvas.tsx'
import { OperationalCanvas } from './components/OperationalCanvas.tsx'
import { ProductCoreCanvas } from './components/ProductCoreCanvas.tsx'
import { ProductApiCanvas } from './components/ProductApiCanvas.tsx'
import { ProductUiCanvas } from './components/ProductUiCanvas.tsx'
import { Toolbar, type Layer } from './components/Toolbar.tsx'
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
 * Read layer from ?layer= URL param. Default is 'technical' to preserve
 * the existing viewer behavior for users who don't yet know the editor
 * exists. Pasted links like `?layer=operational` land straight on the
 * operational canvas.
 */
function getLayer(): Layer {
  const params = new URLSearchParams(window.location.search)
  const fromUrl = params.get('layer')
  if (
    fromUrl === 'operational' ||
    fromUrl === 'product-core' ||
    fromUrl === 'product-api' ||
    fromUrl === 'product-ui'
  ) return fromUrl
  return 'technical'
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

  // Technical layer state
  const [dna, setDna] = useState<ArchitectureDNA | null>(null)
  const [currentViewName, setCurrentViewName] = useState('deployment')
  const liveStatus = useRef<Record<string, string>>({})

  // Operational layer state
  const [operationalDna, setOperationalDna] = useState<OperationalDNA | null>(null)

  // Product Core layer state — materialized subset of operational
  const [productCoreDna, setProductCoreDna] = useState<ProductCoreDNA | null>(null)

  // Product API layer state — hand-authored namespace, resources, endpoints
  const [productApiDna, setProductApiDna] = useState<ProductApiDNA | null>(null)

  // Product UI layer state — hand-authored layout, pages, blocks, routes
  const [productUiDna, setProductUiDna] = useState<ProductUiDNA | null>(null)

  // Load error state per layer. Keeps the loading gate honest — without
  // this, a 404 or parse failure silently leaves the corresponding layer
  // at `null` and the UI shows "Loading…" forever. With it, we surface a
  // readable message in the canvas area and the user can tell what broke.
  const [technicalError, setTechnicalError] = useState<string | null>(null)
  const [operationalError, setOperationalError] = useState<string | null>(null)
  const [productCoreError, setProductCoreError] = useState<string | null>(null)
  const [productApiError, setProductApiError] = useState<string | null>(null)
  const [productUiError, setProductUiError] = useState<string | null>(null)

  const [domain] = useState(getDomain)
  const [env, setEnvState] = useState(getEnv)
  const [adapter, setAdapterState] = useState(() => getAdapter(getEnv()))
  const [layer, setLayer] = useState<Layer>(getLayer)

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

  // Switching layers resets the selected graph element so the sidebar
  // doesn't display stale data from the other layer's shape.
  const handleLayerChange = useCallback((next: Layer) => {
    graphModel.setSelectedCellView(null)
    graphModel.setDirty(false)
    setLayer(next)
  }, [graphModel])

  // Reflect the current env + adapter + layer in the URL so reloads
  // preserve state and copy-pasted URLs land on the same view.
  // `replaceState` keeps this out of browser history.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    params.set('domain', domain)
    params.set('env', env)
    params.set('adapter', adapter)
    params.set('layer', layer)
    const nextUrl = `${window.location.pathname}?${params.toString()}`
    if (nextUrl !== window.location.pathname + window.location.search) {
      window.history.replaceState(null, '', nextUrl)
    }
  }, [domain, env, adapter, layer])

  // ── Technical DNA loader ──
  // Loaded regardless of current layer so switching to technical is
  // instant. Operational DNA is loaded similarly below.
  useEffect(() => {
    setTechnicalError(null)
    fetch(`/api/load-views/${encodeURIComponent(domain)}?env=${encodeURIComponent(env)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
        return r.json()
      })
      .then(json => setDna(parseArchitectureDNA(json)))
      .catch(err => {
        console.error('Failed to load technical DNA:', err)
        setTechnicalError(String(err.message ?? err))
      })
  }, [domain, env])

  // ── Operational DNA loader ──
  useEffect(() => {
    setOperationalError(null)
    loadOperationalDNA(domain)
      .then(setOperationalDna)
      .catch(err => {
        console.error('Failed to load operational DNA:', err)
        setOperationalError(String(err.message ?? err))
      })
  }, [domain])

  // ── Product Core DNA loader ──
  // Loaded alongside operational so switching between the two tabs is
  // instant. product.core.json is regenerated by the materializer, so
  // a missing file usually means `cba product core materialize <domain>`
  // hasn't been run — the error-state UI surfaces that readably.
  useEffect(() => {
    setProductCoreError(null)
    loadProductCoreDNA(domain)
      .then(setProductCoreDna)
      .catch(err => {
        console.error('Failed to load product core DNA:', err)
        setProductCoreError(String(err.message ?? err))
      })
  }, [domain])

  // ── Product API DNA loader ──
  // Hand-authored, not materialized — so unlike product-core, edits
  // here are meant to round-trip back to product.api.json.
  useEffect(() => {
    setProductApiError(null)
    loadProductApiDNA(domain)
      .then(setProductApiDna)
      .catch(err => {
        console.error('Failed to load product API DNA:', err)
        setProductApiError(String(err.message ?? err))
      })
  }, [domain])

  // ── Product UI DNA loader ──
  // Hand-authored like product-api. Layout + pages + blocks.
  useEffect(() => {
    setProductUiError(null)
    loadProductUiDNA(domain)
      .then(setProductUiDna)
      .catch(err => {
        console.error('Failed to load product UI DNA:', err)
        setProductUiError(String(err.message ?? err))
      })
  }, [domain])

  // ── Live status polling (technical only) ──
  //
  // Polling runs independently of the active layer so switching away
  // and back doesn't lose state, but only technical status is consumed.
  // Operational DNA has no "live status" concept.
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
    if (!graphModel.graph) return

    // Product Core is derived from Operational via the materializer.
    // Saving edits directly to product.core.json would be clobbered on
    // the next `cba product core materialize` run, so we refuse the
    // save and tell the user where to actually edit. Also clears dirty
    // so a bulk "can't save" error doesn't keep re-prompting.
    if (layer === 'product-core') {
      alert(
        'Product Core is derived from Operational DNA by the materializer. ' +
        'Edit operational.json (Operational tab) instead — running `cba product core materialize <domain>` ' +
        'or `cba develop <domain>` will regenerate product.core.json from your changes.',
      )
      graphModel.setDirty(false)
      return
    }

    setSaving(true)
    try {
      if (layer === 'technical') {
        if (!currentView || !dna) return
        const updatedView = graphToArchView(graphModel.graph, currentViewName, currentView)
        const updatedDna = {
          ...dna,
          views: dna.views.map(v => v.name === currentViewName ? updatedView : v),
        }
        await saveViews(domain, updatedDna)
      } else if (layer === 'operational') {
        if (!operationalDna) return
        const updatedDna = graphToOperationalDNA(graphModel.graph, operationalDna)
        await saveOperational(domain, updatedDna)
        // Refresh local state so the next save diffs against the latest
        // persisted form (otherwise RJSF edits would re-layer on top of
        // the previous save's layout).
        setOperationalDna(updatedDna)
      } else if (layer === 'product-api') {
        if (!productApiDna) return
        const updatedDna = graphToProductApiDNA(graphModel.graph, productApiDna)
        await saveProductApi(domain, updatedDna)
        setProductApiDna(updatedDna)
      } else if (layer === 'product-ui') {
        if (!productUiDna) return
        const updatedDna = graphToProductUiDNA(graphModel.graph, productUiDna)
        await saveProductUi(domain, updatedDna)
        setProductUiDna(updatedDna)
      }
      graphModel.setDirty(false)
    } catch (err) {
      console.error('Save failed:', err)
      alert(`Save failed: ${(err as Error).message}`)
    } finally {
      setSaving(false)
    }
  }, [graphModel, layer, currentView, currentViewName, dna, operationalDna, productApiDna, productUiDna, domain])

  // Keyboard shortcut: Ctrl/Cmd+S to save. useEffect, not useMemo — the
  // original version used useMemo which doesn't wire up cleanup correctly
  // and could leave dangling listeners on re-render.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (graphModel.dirty) handleSave()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [graphModel.dirty, handleSave])

  // Loading gate — wait for whichever layer we need before rendering.
  // Errors for the active layer become a readable message in place of
  // the spinner; the other layers' errors are ignored here so a broken
  // operational file doesn't block the technical canvas and vice versa.
  const technicalReady = dna && currentView
  const operationalReady = operationalDna
  const productCoreReady = productCoreDna
  const productApiReady = productApiDna
  const productUiReady = productUiDna
  const ready =
    layer === 'technical'    ? technicalReady :
    layer === 'operational'  ? operationalReady :
    layer === 'product-core' ? productCoreReady :
    layer === 'product-api'  ? productApiReady :
    layer === 'product-ui'   ? productUiReady :
    false
  const error =
    layer === 'technical'    ? technicalError :
    layer === 'operational'  ? operationalError :
    layer === 'product-core' ? productCoreError :
    layer === 'product-api'  ? productApiError :
    layer === 'product-ui'   ? productUiError :
    null
  if (!ready) {
    if (error) {
      return (
        <div style={{ padding: 40, color: '#fca5a5', fontFamily: '-apple-system, sans-serif' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
            Failed to load {layer} DNA for "{domain}"
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{error}</div>
        </div>
      )
    }
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
          layer={layer}
          onLayerChange={handleLayerChange}
        />
      }
      canvas={
        layer === 'technical' && currentView ? (
          <TechnicalCanvas
            key={`tech:${currentViewName}`}
            model={graphModel}
            view={currentView}
          />
        ) : layer === 'operational' && operationalDna ? (
          <OperationalCanvas
            key={`ops:${domain}`}
            model={graphModel}
            dna={operationalDna}
          />
        ) : layer === 'product-core' && productCoreDna ? (
          <ProductCoreCanvas
            key={`pcore:${domain}`}
            model={graphModel}
            dna={productCoreDna}
          />
        ) : layer === 'product-api' && productApiDna ? (
          <ProductApiCanvas
            key={`papi:${domain}`}
            model={graphModel}
            dna={productApiDna}
          />
        ) : layer === 'product-ui' && productUiDna ? (
          <ProductUiCanvas
            key={`pui:${domain}`}
            model={graphModel}
            dna={productUiDna}
          />
        ) : null
      }
      sidebar={
        <Sidebar model={graphModel} env={env} adapter={adapter} />
      }
    />
  )
})

export default App
