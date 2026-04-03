// ── Fixed renderer component templates ───────────────────────────────────────
// These are emitted once per generated app. They contain no DNA-derived values —
// all DNA is fetched at runtime from the source dna/ directory.

export function rendererContext(): string {
  return `import { createContext, useContext } from 'react'
import type { ProductUiDNA } from './types'

export interface DnaContextValue {
  dna: ProductUiDNA
  stubs: Record<string, Record<string, unknown>[]>
}

export const DnaContext = createContext<DnaContextValue | null>(null)

export function useDna(): DnaContextValue {
  const ctx = useContext(DnaContext)
  if (!ctx) throw new Error('useDna must be used within a DnaContext.Provider')
  return ctx
}
`
}

export function rendererTypes(): string {
  return `export interface Field {
  name: string
  label: string
  type: string
  required?: boolean
  values?: string[]
}

export interface Block {
  name: string
  type: string
  description?: string
  operation?: string
  fields?: Field[]
}

export interface Page {
  name: string
  resource: string
  description?: string
  blocks: Block[]
}

export interface Layout {
  name: string
  type: string
  description?: string
}

export interface Route {
  path: string
  page: string
  description?: string
}

export interface ProductUiDNA {
  layout: Layout
  pages: Page[]
  routes: Route[]
}
`
}

export function rendererApp(): string {
  return `import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import type { ProductUiDNA } from './types'
import { DnaContext } from './context'
import Layout from './Layout'
import Page from './Page'

interface Config {
  ui: string
  operational?: string | null
}

function collectStubs(op: unknown): Record<string, Record<string, unknown>[]> {
  const stubs: Record<string, Record<string, unknown>[]> = {}
  function walk(domain: { nouns?: { name: string; examples?: Record<string, unknown>[] }[]; domains?: unknown[] }) {
    for (const noun of domain.nouns ?? []) {
      if (noun.examples?.length) stubs[noun.name] = noun.examples
    }
    for (const sub of domain.domains ?? []) walk(sub as typeof domain)
  }
  const typed = op as { domain: Parameters<typeof walk>[0] } | null
  if (typed?.domain) walk(typed.domain)
  return stubs
}

export default function App() {
  const [dna, setDna] = useState<ProductUiDNA | null>(null)
  const [stubs, setStubs] = useState<Record<string, Record<string, unknown>[]>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/config.json')
      .then(r => r.json() as Promise<Config>)
      .then(config =>
        Promise.all([
          fetch(config.ui).then(r => r.json()),
          config.operational
            ? fetch(config.operational).then(r => r.json())
            : Promise.resolve(null),
        ])
      )
      .then(([uiDna, operationalDna]) => {
        setDna(uiDna as ProductUiDNA)
        setStubs(collectStubs(operationalDna))
      })
      .catch(err => setError(String(err)))
  }, [])

  if (error) {
    return (
      <div style={{ padding: '2rem', color: '#dc2626', fontFamily: 'system-ui' }}>
        Failed to load DNA: {error}
      </div>
    )
  }

  if (!dna) {
    return (
      <div style={{ padding: '2rem', color: '#6b7280', fontFamily: 'system-ui' }}>
        Loading...
      </div>
    )
  }

  return (
    <DnaContext.Provider value={{ dna, stubs }}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout layout={dna.layout} routes={dna.routes} />}>
            <Route index element={<Navigate to={dna.routes[0]?.path ?? '/'} replace />} />
            {dna.routes.map(route => {
              const page = dna.pages.find(p => p.name === route.page)
              if (!page) return null
              return (
                <Route
                  key={route.path}
                  path={route.path}
                  element={<Page page={page} />}
                />
              )
            })}
          </Route>
        </Routes>
      </BrowserRouter>
    </DnaContext.Provider>
  )
}
`
}

export function rendererLayout(): string {
  return `import { NavLink, Outlet } from 'react-router-dom'
import type { Layout as LayoutDNA, Route } from './types'

interface Props {
  layout: LayoutDNA
  routes: Route[]
}

function toLabel(pageName: string): string {
  return pageName.replace(/([A-Z])/g, (c, _match, offset: number) =>
    (offset === 0 ? '' : ' ') + c
  )
}

export default function Layout({ layout, routes }: Props) {
  if (layout.type === 'sidebar') return <SidebarLayout routes={routes} />
  return <FullWidthLayout routes={routes} />
}

function navLinkStyle({ isActive }: { isActive: boolean }): React.CSSProperties {
  return {
    display: 'block',
    padding: '0.5rem 0.75rem',
    borderRadius: '0.375rem',
    textDecoration: 'none',
    fontSize: '0.875rem',
    color: isActive ? '#1d4ed8' : '#374151',
    background: isActive ? '#eff6ff' : 'transparent',
    fontWeight: isActive ? 600 : 400,
  }
}

function SidebarLayout({ routes }: { routes: Route[] }) {
  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <nav style={{ width: 240, borderRight: '1px solid #e5e7eb', padding: '1.5rem 1rem', background: '#f9fafb', flexShrink: 0 }}>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {routes.map(route => (
            <li key={route.path}>
              <NavLink to={route.path} style={navLinkStyle}>
                {toLabel(route.page)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <main style={{ flex: 1, padding: '2rem', overflow: 'auto' }}>
        <Outlet />
      </main>
    </div>
  )
}

function FullWidthLayout({ routes }: { routes: Route[] }) {
  return (
    <div style={{ minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ borderBottom: '1px solid #e5e7eb', background: '#fff', padding: '0 2rem' }}>
        <nav style={{ display: 'flex', gap: '0.25rem', height: 56, alignItems: 'center' }}>
          {routes.map(route => (
            <NavLink key={route.path} to={route.path} style={navLinkStyle}>
              {toLabel(route.page)}
            </NavLink>
          ))}
        </nav>
      </header>
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem' }}>
        <Outlet />
      </main>
    </div>
  )
}
`
}

export function rendererPage(): string {
  return `import type { Page as PageDNA } from './types'
import Block from './Block'

function toTitle(name: string): string {
  return name.replace(/([A-Z])/g, (c, _match, offset: number) =>
    (offset === 0 ? '' : ' ') + c
  )
}

export default function Page({ page }: { page: PageDNA }) {
  return (
    <div>
      <h1 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 700 }}>
        {toTitle(page.name)}
      </h1>
      {page.blocks.map(block => (
        <Block key={block.name} block={block} resource={page.resource} />
      ))}
    </div>
  )
}
`
}

export function rendererBlock(): string {
  return `import type { Block as BlockDNA } from './types'
import FormBlock from './blocks/FormBlock'
import TableBlock from './blocks/TableBlock'
import DetailBlock from './blocks/DetailBlock'
import ActionsBlock from './blocks/ActionsBlock'
import EmptyStateBlock from './blocks/EmptyStateBlock'

interface Props {
  block: BlockDNA
  resource: string
}

export default function Block({ block, resource }: Props) {
  switch (block.type) {
    case 'form':        return <FormBlock block={block} />
    case 'table':       return <TableBlock block={block} resource={resource} />
    case 'detail':      return <DetailBlock block={block} resource={resource} />
    case 'actions':     return <ActionsBlock block={block} />
    case 'empty-state': return <EmptyStateBlock block={block} />
    default:
      return (
        <div style={{ color: '#9ca3af', fontSize: '0.875rem', marginBottom: '1rem' }}>
          Unknown block type: {block.type}
        </div>
      )
  }
}
`
}

export function rendererFormBlock(): string {
  return `import { useState } from 'react'
import type { Block } from '../types'

function fieldTypeToHtml(type: string): React.HTMLInputTypeAttribute {
  switch (type) {
    case 'number':   return 'number'
    case 'date':     return 'date'
    case 'datetime': return 'datetime-local'
    case 'email':    return 'email'
    case 'password': return 'password'
    default:         return 'text'
  }
}

export default function FormBlock({ block }: { block: Block }) {
  const fields = block.fields ?? []
  const [state, setState] = useState<Record<string, string>>(
    () => Object.fromEntries(fields.map(f => [f.name, '']))
  )

  return (
    <form
      onSubmit={e => { e.preventDefault() /* TODO: wire to API */ }}
      style={{ marginBottom: '1.5rem' }}
    >
      {fields.map(field => (
        <div key={field.name} style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>
            {field.label}{field.required ? ' *' : ''}
          </label>
          {field.type === 'enum' && field.values ? (
            <select
              value={state[field.name] ?? ''}
              onChange={e => setState(s => ({ ...s, [field.name]: e.target.value }))}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
            >
              <option value="">All</option>
              {field.values.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          ) : (
            <input
              type={fieldTypeToHtml(field.type)}
              value={state[field.name] ?? ''}
              onChange={e => setState(s => ({ ...s, [field.name]: e.target.value }))}
              required={field.required}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', boxSizing: 'border-box' }}
            />
          )}
        </div>
      ))}
      <button
        type="submit"
        style={{ padding: '0.5rem 1rem', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}
      >
        Submit
      </button>
    </form>
  )
}
`
}

export function rendererTableBlock(): string {
  return `import { useDna } from '../context'
import type { Block } from '../types'

interface Props {
  block: Block
  resource: string
}

export default function TableBlock({ block, resource }: Props) {
  const { stubs } = useDna()
  const fields = block.fields ?? []
  const rows = stubs[resource] ?? []
  return (
    <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead>
          <tr>
            {fields.map(f => (
              <th
                key={f.name}
                style={{ padding: '0.75rem 1rem', textAlign: 'left', borderBottom: '2px solid #e5e7eb', fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                {f.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? rows.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
              {fields.map(f => (
                <td
                  key={f.name}
                  style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e5e7eb' }}
                >
                  {String(row[f.name] ?? '—')}
                </td>
              ))}
            </tr>
          )) : (
            <tr>
              <td
                colSpan={fields.length}
                style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}
              >
                No data
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
`
}

export function rendererDetailBlock(): string {
  return `import { useDna } from '../context'
import type { Block } from '../types'

interface Props {
  block: Block
  resource: string
}

export default function DetailBlock({ block, resource }: Props) {
  const { stubs } = useDna()
  const fields = block.fields ?? []
  const record = (stubs[resource] ?? [])[0] ?? {}
  return (
    <dl
      style={{
        display: 'grid',
        gridTemplateColumns: '200px 1fr',
        gap: '0.75rem 1.5rem',
        marginBottom: '1.5rem',
        padding: '1.5rem',
        border: '1px solid #e5e7eb',
        borderRadius: '0.5rem',
      }}
    >
      {fields.map(f => (
        <div key={f.name} style={{ display: 'contents' }}>
          <dt style={{ fontWeight: 500, color: '#6b7280', fontSize: '0.875rem' }}>{f.label}</dt>
          <dd style={{ margin: 0 }}>{String(record[f.name] ?? '—')}</dd>
        </div>
      ))}
    </dl>
  )
}
`
}

export function rendererActionsBlock(): string {
  return `import type { Block } from '../types'

export default function ActionsBlock({ block: _block }: { block: Block }) {
  return (
    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
      {/* TODO: render contextual actions based on resource state and actor role */}
      <button
        type="button"
        onClick={() => { /* TODO */ }}
        style={{ padding: '0.5rem 1rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}
      >
        Approve
      </button>
      <button
        type="button"
        onClick={() => { /* TODO */ }}
        style={{ padding: '0.5rem 1rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}
      >
        Reject
      </button>
    </div>
  )
}
`
}

export function rendererEmptyStateBlock(): string {
  return `import type { Block } from '../types'

export default function EmptyStateBlock({ block: _block }: { block: Block }) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '3rem',
        color: '#9ca3af',
        border: '2px dashed #e5e7eb',
        borderRadius: '0.5rem',
        marginBottom: '1.5rem',
      }}
    >
      <p style={{ margin: 0 }}>No results found.</p>
    </div>
  )
}
`
}
