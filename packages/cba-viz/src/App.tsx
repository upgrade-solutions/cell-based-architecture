import { useMemo, useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react'
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
// Canvas components are lazy-loaded so the heavy JointJS dep only ships
// when the user actually opens a graph surface — the initial bundle stays
// lean and each canvas comes in on demand.
const TechnicalCanvas = lazy(() =>
  import('./components/TechnicalCanvas.tsx').then((m) => ({ default: m.TechnicalCanvas })),
)
const OperationalCanvas = lazy(() =>
  import('./components/OperationalCanvas.tsx').then((m) => ({ default: m.OperationalCanvas })),
)
const ProductCoreCanvas = lazy(() =>
  import('./components/ProductCoreCanvas.tsx').then((m) => ({ default: m.ProductCoreCanvas })),
)
const ProductApiCanvas = lazy(() =>
  import('./components/ProductApiCanvas.tsx').then((m) => ({ default: m.ProductApiCanvas })),
)
const ProductUiCanvas = lazy(() =>
  import('./components/ProductUiCanvas.tsx').then((m) => ({ default: m.ProductUiCanvas })),
)
const CrossLayerCanvas = lazy(() =>
  import('./components/CrossLayerCanvas.tsx').then((m) => ({ default: m.CrossLayerCanvas })),
)
import { RunPhaseStub } from './components/RunPhaseStub.tsx'
import { LogsPanel } from './components/LogsPanel.tsx'
import {
  Toolbar,
  type Phase,
  type Sub,
  type BuildSub,
  type RunSub,
  type ProductVariant,
  BUILD_SUBS,
  RUN_SUBS,
  DEFAULT_BUILD_SUB,
  DEFAULT_RUN_SUB,
  DEFAULT_PRODUCT_VARIANT,
} from './components/Toolbar.tsx'
import { Sidebar } from './components/Sidebar.tsx'
import { Layout } from './components/Layout.tsx'
// Phase 5c.4 Chunk 1 — operational CRUD dialogs + mutations
import { CreatePrimitiveDialog } from './components/CreatePrimitiveDialog.tsx'
import { DeleteConfirmDialog } from './components/DeleteConfirmDialog.tsx'
import {
  renameNoun,
  renameCapability,
  deleteOperationalPrimitive,
  previewCascade,
  type OperationalPrimitiveKind,
  type RemovedPrimitive,
} from './features/operational-mutations.ts'

// ── URL param getters ──────────────────────────────────────────────────

function getDomain(): string {
  const params = new URLSearchParams(window.location.search)
  return params.get('domain') ?? 'lending'
}

function getEnv(): string {
  const params = new URLSearchParams(window.location.search)
  return params.get('env') ?? 'dev'
}

/**
 * Adapter derives from env via the coupling rule (prod↔terraform/aws,
 * dev↔docker-compose) unless ?adapter= is explicit. Lets debug URLs
 * force a mismatch like `?env=prod&adapter=docker-compose`.
 */
function getAdapter(envValue: string): string {
  const params = new URLSearchParams(window.location.search)
  const fromUrl = params.get('adapter')
  if (fromUrl) return fromUrl
  return envValue === 'prod' ? 'terraform/aws' : 'docker-compose'
}

/**
 * Read the lifecycle phase from ?phase=. Defaults to 'build' so a
 * first-time visitor lands on authoring surfaces — more meaningful
 * than dropping into the deployment view.
 */
function getPhase(): Phase {
  const params = new URLSearchParams(window.location.search)
  const fromUrl = params.get('phase')
  if (fromUrl === 'build' || fromUrl === 'run') return fromUrl

  // Legacy URL migration — pasted `?layer=X` links from Phase 5c.2/5c.3
  // get interpreted as build + matching sub. Technical as `run` so old
  // status-watching links still work.
  const legacy = params.get('layer')
  if (legacy === 'technical') return 'run'
  if (legacy) return 'build'

  return 'build'
}

/**
 * Read the sub-tab from ?sub=. Falls back to the phase default when
 * missing or invalid. Also migrates legacy values:
 *   - `?layer=X` from Phase 5c.2/5c.3
 *   - `?sub=product-core|product-api|product-ui` from the flat-tab IA
 *     that predated the consolidated Product dropdown
 */
function getSub(phase: Phase): Sub {
  const params = new URLSearchParams(window.location.search)
  const fromUrl = params.get('sub')

  // Consolidated-product migration: old URLs used ?sub=product-core
  // etc. Collapse those to ?sub=product; the variant is read by
  // getProductVariant() which looks at the same legacy values.
  if (fromUrl === 'product-core' || fromUrl === 'product-api' || fromUrl === 'product-ui') {
    return 'product'
  }

  const valid = phase === 'build' ? BUILD_SUBS : RUN_SUBS
  if (fromUrl && (valid as readonly string[]).includes(fromUrl)) return fromUrl as Sub

  // Legacy migration from ?layer=X
  const legacy = params.get('layer')
  if (legacy === 'technical' && phase === 'run') return 'deployment'
  if (legacy === 'technical' && phase === 'build') return 'technical'
  if (legacy === 'operational')  return 'operational'
  if (legacy === 'product-core' || legacy === 'product-api' || legacy === 'product-ui') {
    return 'product'
  }

  return phase === 'build' ? DEFAULT_BUILD_SUB : DEFAULT_RUN_SUB
}

/**
 * Read the product variant from ?product=. Defaults to `core`.
 * Also migrates from the legacy ?sub=product-X and ?layer=product-X
 * forms so pasted links from earlier releases land on the right
 * variant inside the consolidated Product tab.
 */
function getProductVariant(): ProductVariant {
  const params = new URLSearchParams(window.location.search)
  const fromUrl = params.get('product')
  if (fromUrl === 'core' || fromUrl === 'api' || fromUrl === 'ui') return fromUrl

  // Legacy: ?sub=product-api → variant = api
  const legacySub = params.get('sub')
  if (legacySub === 'product-core') return 'core'
  if (legacySub === 'product-api')  return 'api'
  if (legacySub === 'product-ui')   return 'ui'

  // Older legacy: ?layer=product-api → variant = api
  const legacyLayer = params.get('layer')
  if (legacyLayer === 'product-core') return 'core'
  if (legacyLayer === 'product-api')  return 'api'
  if (legacyLayer === 'product-ui')   return 'ui'

  return DEFAULT_PRODUCT_VARIANT
}

/** Read selected capability (cross-layer view only) from ?cap=. */
function getCap(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('cap')
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

  // Product Core — materialized operational subset
  const [productCoreDna, setProductCoreDna] = useState<ProductCoreDNA | null>(null)

  // Product API — hand-authored
  const [productApiDna, setProductApiDna] = useState<ProductApiDNA | null>(null)

  // Product UI — hand-authored
  const [productUiDna, setProductUiDna] = useState<ProductUiDNA | null>(null)

  // Load error state per layer — surfaced in the canvas area rather
  // than silently hanging on "Loading…" forever.
  const [technicalError, setTechnicalError] = useState<string | null>(null)
  const [operationalError, setOperationalError] = useState<string | null>(null)
  const [productCoreError, setProductCoreError] = useState<string | null>(null)
  const [productApiError, setProductApiError] = useState<string | null>(null)
  const [productUiError, setProductUiError] = useState<string | null>(null)

  // Phase 5c.4 Chunk 1 — operational CRUD dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{
    kind: OperationalPrimitiveKind
    key: string
    label: string
    removed: RemovedPrimitive[]
  } | null>(null)

  const [domain] = useState(getDomain)
  const [env, setEnvState] = useState(getEnv)
  const [adapter, setAdapterState] = useState(() => getAdapter(getEnv()))
  const [phase, setPhaseState] = useState<Phase>(getPhase)
  const [sub, setSubState] = useState<Sub>(() => getSub(getPhase()))
  const [productVariant, setProductVariantState] = useState<ProductVariant>(getProductVariant)
  const [capabilityName, setCapabilityName] = useState<string | null>(getCap)

  // Env drives adapter via the coupling rule (prod↔terraform/aws,
  // dev↔docker-compose). technical.json has env-scoped construct
  // variants that only make sense against the matching delivery
  // adapter, so we rewrite both together.
  const setEnv = useCallback((next: string) => {
    setEnvState(next)
    setAdapterState(next === 'prod' ? 'terraform/aws' : 'docker-compose')
  }, [])

  /**
   * Switching phase resets the sub-tab to the phase's default and
   * clears selection/dirty so the sidebar doesn't show stale data
   * from the previous context. Preserves the selected capability
   * across phase changes (cross-layer view might persist state).
   */
  const handlePhaseChange = useCallback((next: Phase) => {
    graphModel.setSelectedCellView(null)
    graphModel.setDirty(false)
    setPhaseState(next)
    setSubState(next === 'build' ? DEFAULT_BUILD_SUB : DEFAULT_RUN_SUB)
  }, [graphModel])

  const handleSubChange = useCallback((next: Sub) => {
    graphModel.setSelectedCellView(null)
    graphModel.setDirty(false)
    setSubState(next)
  }, [graphModel])

  /**
   * Product variant change — clears selection/dirty like sub changes
   * since the different variant canvases render different primitive
   * types.
   */
  const handleProductVariantChange = useCallback((next: ProductVariant) => {
    graphModel.setSelectedCellView(null)
    graphModel.setDirty(false)
    setProductVariantState(next)
  }, [graphModel])

  // Reflect the full routing state in the URL so reloads preserve
  // everything and pasted links land on the exact same view.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    params.set('domain', domain)
    params.set('env', env)
    params.set('adapter', adapter)
    params.set('phase', phase)
    params.set('sub', sub)
    // Product variant is only meaningful when sub=product; when we're
    // anywhere else, drop it from the URL so pasted links stay clean.
    if (sub === 'product') {
      params.set('product', productVariant)
    } else {
      params.delete('product')
    }
    // Drop the legacy `?layer=X` param once we've migrated. New URLs
    // should use phase+sub going forward.
    params.delete('layer')
    if (capabilityName) {
      params.set('cap', capabilityName)
    } else {
      params.delete('cap')
    }
    const nextUrl = `${window.location.pathname}?${params.toString()}`
    if (nextUrl !== window.location.pathname + window.location.search) {
      window.history.replaceState(null, '', nextUrl)
    }
  }, [domain, env, adapter, phase, sub, productVariant, capabilityName])

  // ── Technical DNA loader ──
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
  useEffect(() => {
    setProductUiError(null)
    loadProductUiDNA(domain)
      .then(setProductUiDna)
      .catch(err => {
        console.error('Failed to load product UI DNA:', err)
        setProductUiError(String(err.message ?? err))
      })
  }, [domain])

  // ── Live status polling ──
  //
  // Gated on (phase, sub) — only runs when the user is actively on
  // Run > Deployment. Build > Technical shows the same canvas but
  // without polling, so topology editing isn't distracted by 5s status
  // flips. Deps include phase + sub so leaving Deployment cleanly
  // tears down the interval.
  useEffect(() => {
    if (!(phase === 'run' && sub === 'deployment')) {
      // Reset cache when leaving so the next visit re-applies fresh
      liveStatus.current = {}
      return
    }
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
    liveStatus.current = {}
    poll()
    const interval = setInterval(poll, STATUS_POLL_MS)
    return () => { active = false; clearInterval(interval) }
  }, [domain, adapter, env, phase, sub])

  const viewNames = dna?.views.map(v => v.name) ?? []
  const currentView = dna?.views.find(v => v.name === currentViewName) ?? dna?.views[0]

  /**
   * Save routing dispatches on the sub-tab. Cross-layer and product-core
   * are read-only (different reasons: cross-layer mixes three layers in
   * one canvas, product-core is materialized from operational). Run
   * sub-tabs have nothing to save — Deployment only observes, and the
   * stub tabs have no graph. Build sub-tabs route to their layer's
   * persistence helper.
   */
  const handleSave = useCallback(async () => {
    if (!graphModel.graph) return

    // Read-only views — graceful refusal with explanation
    if (sub === 'product' && productVariant === 'core') {
      alert(
        'Product Core is derived from Operational DNA by the materializer. ' +
        'Edit operational.json (Build > Operational) instead — running `cba product core materialize <domain>` ' +
        'or `cba develop <domain>` regenerates product.core.json from your changes.',
      )
      graphModel.setDirty(false)
      return
    }
    if (sub === 'cross-layer') {
      alert(
        'Cross-layer is a read-only exploration view. To edit the selected capability or its product surfaces, ' +
        'switch to the specific sub-tab (Operational, Product API, or Product UI) and save there.',
      )
      graphModel.setDirty(false)
      return
    }
    if (phase === 'run') {
      // Deployment polls status but doesn't mutate DNA; stubs have nothing to save.
      graphModel.setDirty(false)
      return
    }

    setSaving(true)
    try {
      if (sub === 'technical') {
        if (!currentView || !dna) return
        const updatedView = graphToArchView(graphModel.graph, currentViewName, currentView)
        const updatedDna = {
          ...dna,
          views: dna.views.map(v => v.name === currentViewName ? updatedView : v),
        }
        await saveViews(domain, updatedDna)
      } else if (sub === 'operational') {
        if (!operationalDna) return
        // Detect pending renames on commit. The Sidebar form stores
        // in-progress name edits directly on each cell's `dna.source`
        // without firing the reference-integrity walk on every
        // keystroke (that caused a canvas-remount loop that killed
        // typing after one character). Here, we diff each graph
        // element's pre-edit name (encoded in its stable id) against
        // the current `dna.source.name` and apply `renameNoun` /
        // `renameCapability` to the DNA before the mutate-by-id step.
        //
        // Applying rename walks before `graphToOperationalDNA` means
        // the downstream references get rewritten first, then the
        // mutate-by-id pass just confirms the primary entries. Clean
        // separation between "walk the whole doc" (rename) and "update
        // one entry in place" (form edit).
        let baseDna = operationalDna
        for (const el of graphModel.graph.getElements()) {
          const cellDna = el.get('dna') as { layer?: string; kind?: string; source?: Record<string, unknown> } | undefined
          if (cellDna?.layer !== 'operational') continue
          const id = el.id as string
          if (cellDna.kind === 'noun') {
            const oldName = id.replace(/^noun:/, '')
            const newName = cellDna.source?.name as string | undefined
            if (newName && oldName !== newName) {
              baseDna = renameNoun(baseDna, oldName, newName)
            }
          } else if (cellDna.kind === 'capability') {
            const oldName = id.replace(/^capability:/, '')
            const source = cellDna.source ?? {}
            const newName = (source.name as string | undefined)
              ?? `${source.noun as string | undefined ?? ''}.${source.verb as string | undefined ?? ''}`
            if (newName && oldName !== newName && !newName.startsWith('.') && !newName.endsWith('.')) {
              baseDna = renameCapability(baseDna, oldName, newName)
            }
          }
        }
        const updatedDna = graphToOperationalDNA(graphModel.graph, baseDna)
        await saveOperational(domain, updatedDna)
        setOperationalDna(updatedDna)
      } else if (sub === 'product' && productVariant === 'api') {
        if (!productApiDna) return
        const updatedDna = graphToProductApiDNA(graphModel.graph, productApiDna)
        await saveProductApi(domain, updatedDna)
        setProductApiDna(updatedDna)
      } else if (sub === 'product' && productVariant === 'ui') {
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
  }, [graphModel, phase, sub, productVariant, currentView, currentViewName, dna, operationalDna, productApiDna, productUiDna, domain])

  // Ctrl/Cmd+S shortcut
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

  // ── Phase 5c.4 Chunk 1 — operational CRUD handlers ──

  /**
   * Rename with referential integrity. The Sidebar form calls this when
   * the user edits a Noun.name or Capability verb/noun. We compute a new
   * DNA with all downstream references rewritten, then set it — the
   * OperationalCanvas's `dna` dep re-runs and re-mounts the graph.
   *
   * Name-based identity is the Phase 5c.4 choice; UUID identity is a
   * future chunk. See packages/cba-viz/src/features/operational-mutations.ts
   * for the detailed walk.
   */
  const handleOperationalRename = useCallback(
    (kind: 'noun' | 'capability', oldName: string, newName: string) => {
      if (!operationalDna) return
      const nextDna =
        kind === 'noun'
          ? renameNoun(operationalDna, oldName, newName)
          : renameCapability(operationalDna, oldName, newName)
      setOperationalDna(nextDna)
      graphModel.setDirty(true)
    },
    [operationalDna, graphModel],
  )

  /** Create dialog result — swap in the new DNA and close the dialog. */
  const handleCreatePrimitive = useCallback(
    (nextDna: OperationalDNA) => {
      setOperationalDna(nextDna)
      graphModel.setDirty(true)
      setCreateDialogOpen(false)
    },
    [graphModel],
  )

  /** Delete confirmation result — commit the cached deletion. */
  const handleConfirmDelete = useCallback(() => {
    if (!deleteConfirm || !operationalDna) return
    const { dna: nextDna } = deleteOperationalPrimitive(
      operationalDna,
      deleteConfirm.kind,
      deleteConfirm.key,
    )
    setOperationalDna(nextDna)
    graphModel.setDirty(true)
    graphModel.setSelectedCellView(null)
    setDeleteConfirm(null)
  }, [deleteConfirm, operationalDna, graphModel])

  /**
   * Delete / Backspace keyboard shortcut — only active on Build >
   * Operational. Reads the selected cell's `dna.kind` + name to
   * figure out what to delete, computes the cascade preview, and
   * opens the confirmation dialog. The user has to explicitly confirm
   * before the DNA is actually mutated.
   *
   * Rules handled specially — their "key" is the graph element id
   * (`rule:<Noun.Verb>:<index>`) not a name, since rules don't have
   * unique names. Same for outcomes.
   */
  useEffect(() => {
    if (phase !== 'build' || sub !== 'operational') return
    if (!operationalDna) return

    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      // Ignore when focus is in an input/textarea/contenteditable — the
      // user is editing text, not trying to delete a graph node.
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
        if (target.isContentEditable) return
      }

      const cellView = graphModel.selectedCellView
      if (!cellView) return
      const cell = cellView.model
      const cellDna = cell.get('dna') as Record<string, unknown> | undefined
      if (!cellDna) return
      if (cellDna.layer !== 'operational') return

      const kind = cellDna.kind as string | undefined
      if (kind !== 'noun' && kind !== 'capability' && kind !== 'rule' && kind !== 'outcome' && kind !== 'signal') return

      // Key lookup by kind: nouns + capabilities + signals use their
      // display name; rules + outcomes use the stable graph id since
      // they have no unique name (they're indexed under a capability).
      let key: string
      let label: string
      if (kind === 'rule' || kind === 'outcome') {
        key = cell.id as string
        label = (cellDna.name as string | undefined) ?? key
      } else {
        key = cellDna.name as string
        label = key
      }
      if (!key) return

      e.preventDefault()
      const removed = previewCascade(operationalDna, kind, key)
      setDeleteConfirm({ kind, key, label, removed })
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [phase, sub, operationalDna, graphModel])

  // ── Readiness + error for the active (phase, sub) ──
  //
  // Only the DNA needed by the active sub-tab matters for the loading
  // gate. A broken operational file shouldn't block the Deployment view
  // and vice versa. The cross-layer view needs operational plus either
  // (or both) of product-api / product-ui — we show it as long as
  // operational is loaded; missing product layers render as empty bands.

  const { ready, error } = computeReadiness({
    phase,
    sub,
    productVariant,
    dna,
    currentView,
    operationalDna,
    productCoreDna,
    productApiDna,
    productUiDna,
    technicalError,
    operationalError,
    productCoreError,
    productApiError,
    productUiError,
  })

  if (!ready) {
    if (error) {
      return (
        <div style={{ padding: 40, color: '#fca5a5', fontFamily: '-apple-system, sans-serif' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
            Failed to load DNA for "{domain}"
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{error}</div>
        </div>
      )
    }
    return <div style={{ padding: 40, color: '#f8fafc' }}>Loading…</div>
  }

  return (
    <>
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
          phase={phase}
          sub={sub}
          onPhaseChange={handlePhaseChange}
          onSubChange={handleSubChange}
          productVariant={productVariant}
          onProductVariantChange={handleProductVariantChange}
          onCreate={() => setCreateDialogOpen(true)}
        />
      }
      canvas={
        <Suspense
          fallback={
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '100%',
                background: '#0f172a',
                color: '#94a3b8',
                fontFamily: '-apple-system, sans-serif',
                fontSize: 13,
              }}
            >
              Loading canvas…
            </div>
          }
        >
          {renderCanvas({
            phase,
            sub,
            productVariant,
            graphModel,
            dna,
            currentView,
            currentViewName,
            operationalDna,
            productCoreDna,
            productApiDna,
            productUiDna,
            domain,
            adapter,
            env,
            capabilityName,
            onCapabilityChange: setCapabilityName,
          })}
        </Suspense>
      }
      sidebar={
        <Sidebar
          model={graphModel}
          env={env}
          adapter={adapter}
          onOperationalRename={handleOperationalRename}
        />
      }
    />

    {/* Dialog overlays — rendered outside Layout so they aren't
        constrained by the toolbar/canvas/sidebar flex rows. Both
        components provide their own fixed-position backdrop. */}
    {createDialogOpen && operationalDna ? (
      <CreatePrimitiveDialog
        dna={operationalDna}
        onCreate={handleCreatePrimitive}
        onClose={() => setCreateDialogOpen(false)}
      />
    ) : null}
    {deleteConfirm ? (
      <DeleteConfirmDialog
        primaryLabel={deleteConfirm.label}
        removed={deleteConfirm.removed}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    ) : null}
    </>
  )
})

export default App

// ── Helpers ─────────────────────────────────────────────────────────────

type ReadinessInput = {
  phase: Phase
  sub: Sub
  productVariant: ProductVariant
  dna: ArchitectureDNA | null
  currentView: { name: string } | undefined
  operationalDna: OperationalDNA | null
  productCoreDna: ProductCoreDNA | null
  productApiDna: ProductApiDNA | null
  productUiDna: ProductUiDNA | null
  technicalError: string | null
  operationalError: string | null
  productCoreError: string | null
  productApiError: string | null
  productUiError: string | null
}

/**
 * Compute whether the active (phase, sub) has enough data loaded to
 * render, and what error to surface if not. Split out of App so each
 * sub-tab's requirement stays in one place — adding a new sub-tab is
 * one branch.
 */
function computeReadiness(inp: ReadinessInput): { ready: boolean; error: string | null } {
  const { phase, sub, productVariant } = inp
  if (phase === 'run') {
    if (sub === 'deployment') {
      return {
        ready: !!(inp.dna && inp.currentView),
        error: inp.technicalError,
      }
    }
    // Logs / Metrics / Access — stub components render immediately
    return { ready: true, error: null }
  }
  // Build phase
  switch (sub as BuildSub) {
    case 'operational':
      return { ready: !!inp.operationalDna, error: inp.operationalError }
    case 'product':
      // The consolidated Product tab dispatches on variant. Each
      // variant has its own DNA and load state.
      switch (productVariant) {
        case 'core': return { ready: !!inp.productCoreDna, error: inp.productCoreError }
        case 'api':  return { ready: !!inp.productApiDna,  error: inp.productApiError  }
        case 'ui':   return { ready: !!inp.productUiDna,   error: inp.productUiError   }
      }
      return { ready: false, error: null }
    case 'technical':
      return {
        ready: !!(inp.dna && inp.currentView),
        error: inp.technicalError,
      }
    case 'cross-layer':
      // Operational is the minimum — picker populates from its
      // capabilities array. Product layers are optional; missing bands
      // render as placeholders inside the cross-layer canvas.
      return { ready: !!inp.operationalDna, error: inp.operationalError }
  }
}

type CanvasInput = {
  phase: Phase
  sub: Sub
  productVariant: ProductVariant
  graphModel: GraphModel
  dna: ArchitectureDNA | null
  currentView: ArchitectureDNA['views'][number] | undefined
  currentViewName: string
  operationalDna: OperationalDNA | null
  productCoreDna: ProductCoreDNA | null
  productApiDna: ProductApiDNA | null
  productUiDna: ProductUiDNA | null
  domain: string
  adapter: string
  env: string
  capabilityName: string | null
  onCapabilityChange: (name: string | null) => void
}

/**
 * Pure routing — given (phase, sub) and the loaded DNAs, return the
 * right canvas component. Split out of App so adding a sub-tab is one
 * case in this switch rather than another arm of a nested ternary.
 */
function renderCanvas(inp: CanvasInput): React.ReactNode {
  const { phase, sub, graphModel, domain } = inp

  if (phase === 'run') {
    if (sub === 'deployment' && inp.currentView) {
      return (
        <TechnicalCanvas
          key={`run:deploy:${inp.currentViewName}`}
          model={graphModel}
          view={inp.currentView}
        />
      )
    }
    if (sub === 'logs') {
      return (
        <LogsPanel
          domain={domain}
          adapter={inp.adapter}
          env={inp.env}
          technicalDna={inp.dna}
        />
      )
    }
    if (sub === 'metrics') {
      return <RunPhaseStub title="Metrics" description="Per-cell and per-construct metrics dashboards — request rates, latency, error budgets, resource utilization. Phase 5c.7." phase="Phase 5c.7" />
    }
    if (sub === 'access') {
      return <RunPhaseStub title="Access" description="Runtime access controls — who can invoke which capabilities, which roles are active, and where credentials live. Phase 5c.8." phase="Phase 5c.8" />
    }
    return null
  }

  // Build phase
  switch (sub as BuildSub) {
    case 'operational':
      return inp.operationalDna ? (
        <OperationalCanvas key={`build:ops:${domain}`} model={graphModel} dna={inp.operationalDna} />
      ) : null
    case 'product':
      // Dispatch on variant. Each variant has its own canvas + DNA
      // prop. The `key` includes the variant so switching variants
      // remounts the underlying canvas cleanly (no stale JointJS
      // selection or paper geometry from the previous variant).
      switch (inp.productVariant) {
        case 'core':
          return inp.productCoreDna ? (
            <ProductCoreCanvas key={`build:p:core:${domain}`} model={graphModel} dna={inp.productCoreDna} />
          ) : null
        case 'api':
          return inp.productApiDna ? (
            <ProductApiCanvas key={`build:p:api:${domain}`} model={graphModel} dna={inp.productApiDna} />
          ) : null
        case 'ui':
          return inp.productUiDna ? (
            <ProductUiCanvas key={`build:p:ui:${domain}`} model={graphModel} dna={inp.productUiDna} />
          ) : null
      }
      return null
    case 'technical':
      return inp.currentView ? (
        <TechnicalCanvas key={`build:tech:${inp.currentViewName}`} model={graphModel} view={inp.currentView} />
      ) : null
    case 'cross-layer':
      return inp.operationalDna ? (
        <CrossLayerCanvas
          key={`build:xl:${domain}:${inp.capabilityName ?? 'none'}`}
          model={graphModel}
          operationalDna={inp.operationalDna}
          productApiDna={inp.productApiDna}
          productUiDna={inp.productUiDna}
          capabilityName={inp.capabilityName}
          onCapabilityChange={inp.onCapabilityChange}
        />
      ) : null
  }
}
