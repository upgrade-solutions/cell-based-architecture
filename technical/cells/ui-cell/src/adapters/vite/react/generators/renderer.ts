// ── Fixed renderer component templates ───────────────────────────────────────
// These are emitted once per generated app. They contain no DNA-derived values —
// all DNA interpretation happens at runtime by reading src/dna.json.

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
  return `import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import type { ProductUiDNA } from './types'
import Layout from './Layout'
import Page from './Page'
import dnaRaw from '../dna.json'

const dna = dnaRaw as unknown as ProductUiDNA

export default function App() {
  const firstPath = dna.routes[0]?.path ?? '/'
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout layout={dna.layout} routes={dna.routes} />}>
          <Route index element={<Navigate to={firstPath} replace />} />
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
        <Block key={block.name} block={block} />
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

export default function Block({ block }: { block: BlockDNA }) {
  switch (block.type) {
    case 'form':        return <FormBlock block={block} />
    case 'table':       return <TableBlock block={block} />
    case 'detail':      return <DetailBlock block={block} />
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
  return `import type { Block } from '../types'

export default function TableBlock({ block }: { block: Block }) {
  const fields = block.fields ?? []
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
          {/* TODO: replace with real data fetched from the API */}
        </tbody>
      </table>
    </div>
  )
}
`
}

export function rendererDetailBlock(): string {
  return `import type { Block } from '../types'

export default function DetailBlock({ block }: { block: Block }) {
  const fields = block.fields ?? []
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
          <dd style={{ margin: 0 }}>—</dd>
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
