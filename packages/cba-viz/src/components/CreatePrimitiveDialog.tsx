import { useState } from 'react'
import type { OperationalDNA } from '../loaders/operational-loader.ts'
import type { ProductApiDNA, ProductUiDNA, HttpMethod, BlockType } from '../loaders/product-loader.ts'
import {
  addNoun,
  addCapability,
  addRule,
  addOutcome,
  listNouns,
  listCapabilities,
} from '../features/operational-mutations.ts'
import {
  addResource,
  addEndpoint,
  addPage,
  addBlock,
  listResources,
  listEndpoints,
  listPages,
} from '../features/product-mutations.ts'

/**
 * Phase 5c.4 — create dialog for DNA primitives.
 *
 * Option A from Chunk 2: one dialog, `context`-switched between the
 * three editable surfaces (operational, product-api, product-ui).
 * Each context shows only the type picker options and form fields
 * that make sense there, so users on Product API don't see a "Noun"
 * option and vice versa. All three share the same shell, header, and
 * button styles — less duplication than three sibling dialogs.
 *
 * The dialog doesn't know how to save; it hands the new DNA back to
 * the parent via the `onCreate` callback. The parent sets the right
 * state atom (operationalDna / productApiDna / productUiDna) and
 * marks the graph dirty.
 */

// ── Kind enums per context ─────────────────────────────────────────────

type OperationalKind = 'noun' | 'capability' | 'rule' | 'outcome'
type ProductApiKind = 'resource' | 'endpoint'
type ProductUiKind = 'page' | 'block'

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const BLOCK_TYPES: BlockType[] = [
  'list',
  'detail',
  'form',
  'survey',
  'actions',
  'table',
  'summary',
  'empty-state',
]

// ── Props ──────────────────────────────────────────────────────────────

export type CreateDialogContext = 'operational' | 'product-api' | 'product-ui'

interface OperationalContextProps {
  context: 'operational'
  dna: OperationalDNA
  onCreate: (nextDna: OperationalDNA) => void
  onClose: () => void
}

interface ProductApiContextProps {
  context: 'product-api'
  dna: ProductApiDNA
  onCreate: (nextDna: ProductApiDNA) => void
  onClose: () => void
}

interface ProductUiContextProps {
  context: 'product-ui'
  dna: ProductUiDNA
  onCreate: (nextDna: ProductUiDNA) => void
  onClose: () => void
}

type CreatePrimitiveDialogProps =
  | OperationalContextProps
  | ProductApiContextProps
  | ProductUiContextProps

// ── Component ──────────────────────────────────────────────────────────

export function CreatePrimitiveDialog(props: CreatePrimitiveDialogProps) {
  if (props.context === 'operational') {
    return <OperationalDialog {...props} />
  }
  if (props.context === 'product-api') {
    return <ProductApiDialog {...props} />
  }
  return <ProductUiDialog {...props} />
}

// ── Operational ────────────────────────────────────────────────────────

function OperationalDialog({ dna, onCreate, onClose }: OperationalContextProps) {
  const [kind, setKind] = useState<OperationalKind>('noun')
  const [nounName, setNounName] = useState('')
  const [capNoun, setCapNoun] = useState('')
  const [capVerb, setCapVerb] = useState('')
  const [ruleCapability, setRuleCapability] = useState('')
  const [ruleType, setRuleType] = useState<'access' | 'condition'>('access')
  const [outcomeCapability, setOutcomeCapability] = useState('')
  const [error, setError] = useState<string | null>(null)

  const nouns = listNouns(dna)
  const capabilities = listCapabilities(dna)

  const handleSubmit = () => {
    setError(null)
    try {
      if (kind === 'noun') {
        if (!nounName.trim()) return setError('Name is required')
        if (nouns.some((n) => n.name === nounName.trim())) {
          return setError(`Noun "${nounName.trim()}" already exists`)
        }
        onCreate(addNoun(dna, { name: nounName.trim() }))
      } else if (kind === 'capability') {
        if (!capNoun) return setError('Pick a noun')
        if (!capVerb.trim()) return setError('Verb is required')
        const name = `${capNoun}.${capVerb.trim()}`
        if (capabilities.some((c) => (c.name ?? `${c.noun}.${c.verb}`) === name)) {
          return setError(`Capability "${name}" already exists`)
        }
        onCreate(addCapability(dna, { noun: capNoun, verb: capVerb.trim() }))
      } else if (kind === 'rule') {
        if (!ruleCapability) return setError('Pick a capability')
        onCreate(addRule(dna, { capability: ruleCapability, type: ruleType }))
      } else if (kind === 'outcome') {
        if (!outcomeCapability) return setError('Pick a capability')
        onCreate(addOutcome(dna, { capability: outcomeCapability }))
      }
      onClose()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <DialogShell title="New Operational Primitive" onClose={onClose} onSubmit={handleSubmit}>
      <label style={labelStyle}>Type</label>
      <select
        value={kind}
        onChange={(e) => {
          setKind(e.target.value as OperationalKind)
          setError(null)
        }}
        style={selectStyle}
      >
        <option value="noun">Noun</option>
        <option value="capability">Capability</option>
        <option value="rule">Rule</option>
        <option value="outcome">Outcome</option>
      </select>

      {kind === 'noun' ? (
        <>
          <label style={labelStyle}>Name</label>
          <input
            value={nounName}
            onChange={(e) => setNounName(e.target.value)}
            placeholder="e.g. Loan"
            style={inputStyle}
            autoFocus
          />
        </>
      ) : null}

      {kind === 'capability' ? (
        <>
          <label style={labelStyle}>Noun</label>
          <select value={capNoun} onChange={(e) => setCapNoun(e.target.value)} style={selectStyle}>
            <option value="">-- pick a noun --</option>
            {nouns.map((n) => (
              <option key={n.name} value={n.name}>{n.name}</option>
            ))}
          </select>
          <label style={labelStyle}>Verb</label>
          <input
            value={capVerb}
            onChange={(e) => setCapVerb(e.target.value)}
            placeholder="e.g. Approve"
            style={inputStyle}
          />
        </>
      ) : null}

      {kind === 'rule' ? (
        <>
          <label style={labelStyle}>Capability</label>
          <select
            value={ruleCapability}
            onChange={(e) => setRuleCapability(e.target.value)}
            style={selectStyle}
          >
            <option value="">-- pick a capability --</option>
            {capabilities.map((c) => {
              const name = c.name ?? `${c.noun}.${c.verb}`
              return <option key={name} value={name}>{name}</option>
            })}
          </select>
          <label style={labelStyle}>Type</label>
          <select
            value={ruleType}
            onChange={(e) => setRuleType(e.target.value as 'access' | 'condition')}
            style={selectStyle}
          >
            <option value="access">access</option>
            <option value="condition">condition</option>
          </select>
        </>
      ) : null}

      {kind === 'outcome' ? (
        <>
          <label style={labelStyle}>Capability</label>
          <select
            value={outcomeCapability}
            onChange={(e) => setOutcomeCapability(e.target.value)}
            style={selectStyle}
          >
            <option value="">-- pick a capability --</option>
            {capabilities.map((c) => {
              const name = c.name ?? `${c.noun}.${c.verb}`
              return <option key={name} value={name}>{name}</option>
            })}
          </select>
          <div style={hintStyle}>
            Adds a default change: <code>status = "new"</code>. Edit in the inspector after creation.
          </div>
        </>
      ) : null}

      {error ? <div style={errorStyle}>{error}</div> : null}
    </DialogShell>
  )
}

// ── Product API ────────────────────────────────────────────────────────

function ProductApiDialog({ dna, onCreate, onClose }: ProductApiContextProps) {
  const [kind, setKind] = useState<ProductApiKind>('resource')
  const [resourceName, setResourceName] = useState('')
  const [endpointMethod, setEndpointMethod] = useState<HttpMethod>('GET')
  const [endpointPath, setEndpointPath] = useState('')
  const [endpointResource, setEndpointResource] = useState('')
  const [endpointAction, setEndpointAction] = useState('')
  const [error, setError] = useState<string | null>(null)

  const resources = listResources(dna)
  const endpoints = listEndpoints(dna)

  const handleSubmit = () => {
    setError(null)
    try {
      if (kind === 'resource') {
        if (!resourceName.trim()) return setError('Name is required')
        if (resources.some((r) => r.name === resourceName.trim())) {
          return setError(`Resource "${resourceName.trim()}" already exists`)
        }
        onCreate(addResource(dna, { name: resourceName.trim() }))
      } else if (kind === 'endpoint') {
        if (!endpointPath.trim()) return setError('Path is required')
        if (!endpointResource) return setError('Pick a resource')
        if (!endpointAction.trim()) return setError('Action is required')
        const operation = `${endpointResource}.${endpointAction.trim()}`
        const collision = endpoints.some(
          (e) => e.method === endpointMethod && e.path === endpointPath.trim(),
        )
        if (collision) {
          return setError(`Endpoint ${endpointMethod} ${endpointPath.trim()} already exists`)
        }
        onCreate(
          addEndpoint(dna, {
            method: endpointMethod,
            path: endpointPath.trim(),
            operation,
          }),
        )
      }
      onClose()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <DialogShell title="New Product API Primitive" onClose={onClose} onSubmit={handleSubmit}>
      <label style={labelStyle}>Type</label>
      <select
        value={kind}
        onChange={(e) => {
          setKind(e.target.value as ProductApiKind)
          setError(null)
        }}
        style={selectStyle}
      >
        <option value="resource">Resource</option>
        <option value="endpoint">Endpoint</option>
      </select>

      {kind === 'resource' ? (
        <>
          <label style={labelStyle}>Name</label>
          <input
            value={resourceName}
            onChange={(e) => setResourceName(e.target.value)}
            placeholder="e.g. Widget"
            style={inputStyle}
            autoFocus
          />
        </>
      ) : null}

      {kind === 'endpoint' ? (
        <>
          <label style={labelStyle}>Method</label>
          <select
            value={endpointMethod}
            onChange={(e) => setEndpointMethod(e.target.value as HttpMethod)}
            style={selectStyle}
          >
            {HTTP_METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <label style={labelStyle}>Path</label>
          <input
            value={endpointPath}
            onChange={(e) => setEndpointPath(e.target.value)}
            placeholder="e.g. /widgets/{id}"
            style={inputStyle}
          />
          <label style={labelStyle}>Resource</label>
          <select
            value={endpointResource}
            onChange={(e) => setEndpointResource(e.target.value)}
            style={selectStyle}
          >
            <option value="">-- pick a resource --</option>
            {resources.map((r) => (
              <option key={r.name} value={r.name}>{r.name}</option>
            ))}
          </select>
          <label style={labelStyle}>Action</label>
          <input
            value={endpointAction}
            onChange={(e) => setEndpointAction(e.target.value)}
            placeholder="e.g. Get"
            style={inputStyle}
          />
          <div style={hintStyle}>
            Operation will be <code>{endpointResource || 'Resource'}.{endpointAction || 'Action'}</code>
          </div>
        </>
      ) : null}

      {error ? <div style={errorStyle}>{error}</div> : null}
    </DialogShell>
  )
}

// ── Product UI ─────────────────────────────────────────────────────────

function ProductUiDialog({ dna, onCreate, onClose }: ProductUiContextProps) {
  const [kind, setKind] = useState<ProductUiKind>('page')
  const [pageName, setPageName] = useState('')
  const [pageResource, setPageResource] = useState('')
  const [blockPage, setBlockPage] = useState('')
  const [blockName, setBlockName] = useState('')
  const [blockType, setBlockType] = useState<BlockType>('list')
  const [error, setError] = useState<string | null>(null)

  const pages = listPages(dna)

  const handleSubmit = () => {
    setError(null)
    try {
      if (kind === 'page') {
        if (!pageName.trim()) return setError('Name is required')
        if (!pageResource.trim()) return setError('Resource is required')
        if (pages.some((p) => p.name === pageName.trim())) {
          return setError(`Page "${pageName.trim()}" already exists`)
        }
        onCreate(addPage(dna, { name: pageName.trim(), resource: pageResource.trim() }))
      } else if (kind === 'block') {
        if (!blockPage) return setError('Pick a page')
        if (!blockName.trim()) return setError('Name is required')
        const page = pages.find((p) => p.name === blockPage)
        if (!page) return setError(`Page "${blockPage}" not found`)
        if ((page.blocks ?? []).some((b) => b.name === blockName.trim())) {
          return setError(`Block "${blockName.trim()}" already exists on ${blockPage}`)
        }
        onCreate(
          addBlock(dna, {
            page: blockPage,
            name: blockName.trim(),
            type: blockType,
          }),
        )
      }
      onClose()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <DialogShell title="New Product UI Primitive" onClose={onClose} onSubmit={handleSubmit}>
      <label style={labelStyle}>Type</label>
      <select
        value={kind}
        onChange={(e) => {
          setKind(e.target.value as ProductUiKind)
          setError(null)
        }}
        style={selectStyle}
      >
        <option value="page">Page</option>
        <option value="block">Block</option>
      </select>

      {kind === 'page' ? (
        <>
          <label style={labelStyle}>Name</label>
          <input
            value={pageName}
            onChange={(e) => setPageName(e.target.value)}
            placeholder="e.g. WidgetDetail"
            style={inputStyle}
            autoFocus
          />
          <label style={labelStyle}>Resource</label>
          <input
            value={pageResource}
            onChange={(e) => setPageResource(e.target.value)}
            placeholder="e.g. Widget"
            style={inputStyle}
          />
          <div style={hintStyle}>
            Resource name references a Product API Resource. Cross-layer rename will keep this in sync.
          </div>
        </>
      ) : null}

      {kind === 'block' ? (
        <>
          <label style={labelStyle}>Page</label>
          <select
            value={blockPage}
            onChange={(e) => setBlockPage(e.target.value)}
            style={selectStyle}
          >
            <option value="">-- pick a page --</option>
            {pages.map((p) => (
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
          </select>
          <label style={labelStyle}>Name</label>
          <input
            value={blockName}
            onChange={(e) => setBlockName(e.target.value)}
            placeholder="e.g. SummaryCard"
            style={inputStyle}
          />
          <label style={labelStyle}>Type</label>
          <select
            value={blockType}
            onChange={(e) => setBlockType(e.target.value as BlockType)}
            style={selectStyle}
          >
            {BLOCK_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </>
      ) : null}

      {error ? <div style={errorStyle}>{error}</div> : null}
    </DialogShell>
  )
}

// ── Shared shell ───────────────────────────────────────────────────────

function DialogShell({
  title,
  onClose,
  onSubmit,
  children,
}: {
  title: string
  onClose: () => void
  onSubmit: () => void
  children: React.ReactNode
}) {
  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <span>{title}</span>
          <button onClick={onClose} style={closeButtonStyle} aria-label="Close">×</button>
        </div>
        <div style={bodyStyle}>{children}</div>
        <div style={footerStyle}>
          <button onClick={onClose} style={cancelButtonStyle}>Cancel</button>
          <button onClick={onSubmit} style={primaryButtonStyle}>Add</button>
        </div>
      </div>
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
}

const dialogStyle: React.CSSProperties = {
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 6,
  width: 380,
  maxWidth: '90vw',
  color: '#f8fafc',
  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
  display: 'flex',
  flexDirection: 'column',
}

const headerStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderBottom: '1px solid #334155',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: 13,
  fontWeight: 700,
}

const closeButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#94a3b8',
  fontSize: 20,
  cursor: 'pointer',
  lineHeight: 1,
  padding: 0,
  width: 24,
  height: 24,
}

const bodyStyle: React.CSSProperties = {
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#94a3b8',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginTop: 4,
}

const inputStyle: React.CSSProperties = {
  background: '#334155',
  color: '#f8fafc',
  border: '1px solid #475569',
  borderRadius: 4,
  padding: '6px 10px',
  fontSize: 13,
  fontFamily: 'inherit',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
}

const hintStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#64748b',
  marginTop: 4,
  lineHeight: 1.5,
}

const errorStyle: React.CSSProperties = {
  color: '#fca5a5',
  fontSize: 12,
  marginTop: 8,
  padding: '6px 10px',
  background: 'rgba(220, 38, 38, 0.1)',
  border: '1px solid rgba(220, 38, 38, 0.3)',
  borderRadius: 4,
}

const footerStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderTop: '1px solid #334155',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
}

const cancelButtonStyle: React.CSSProperties = {
  background: 'transparent',
  color: '#94a3b8',
  border: '1px solid #475569',
  borderRadius: 4,
  padding: '6px 14px',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const primaryButtonStyle: React.CSSProperties = {
  background: '#3b82f6',
  color: '#fff',
  border: '1px solid #2563eb',
  borderRadius: 4,
  padding: '6px 16px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
}
