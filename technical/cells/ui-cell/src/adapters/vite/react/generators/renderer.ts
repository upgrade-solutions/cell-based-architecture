// ── Fixed renderer component templates ───────────────────────────────────────
// These are emitted once per generated app. They contain no DNA-derived values —
// all DNA is fetched at runtime from the source dna/ directory.

export function rendererContext(): string {
  return `import { createContext, useContext } from 'react'
import type { ProductUiDNA, ProductApiDNA } from './types'

export type Theme = 'light' | 'dark'

export interface DnaContextValue {
  dna: ProductUiDNA
  api: ProductApiDNA | null
  apiBase: string
  stubs: Record<string, Record<string, unknown>[]>
  theme: Theme
  toggleTheme: () => void
}

export const DnaContext = createContext<DnaContextValue | null>(null)

export function useDna(): DnaContextValue {
  const ctx = useContext(DnaContext)
  if (!ctx) throw new Error('useDna must be used within a DnaContext.Provider')
  return ctx
}

// ── Theme color tokens ───────────────────────────────────────────────────────

export const tokens = {
  light: {
    bg: '#ffffff',
    bgAlt: '#f9fafb',
    bgHover: '#f3f4f6',
    text: '#111827',
    textSecondary: '#6b7280',
    textMuted: '#9ca3af',
    border: '#e5e7eb',
    borderStrong: '#d1d5db',
    primary: '#1d4ed8',
    primaryBg: '#eff6ff',
    success: '#16a34a',
    successBg: '#f0fdf4',
    danger: '#dc2626',
    dangerBg: '#fef2f2',
    inputBg: '#ffffff',
    rowStripe: '#f9fafb',
  },
  dark: {
    bg: '#111827',
    bgAlt: '#1f2937',
    bgHover: '#374151',
    text: '#f9fafb',
    textSecondary: '#9ca3af',
    textMuted: '#6b7280',
    border: '#374151',
    borderStrong: '#4b5563',
    primary: '#60a5fa',
    primaryBg: '#1e3a5f',
    success: '#4ade80',
    successBg: '#14532d',
    danger: '#f87171',
    dangerBg: '#7f1d1d',
    inputBg: '#1f2937',
    rowStripe: '#1f2937',
  },
}

export function useThemeTokens() {
  const { theme } = useDna()
  return tokens[theme]
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
  rowLink?: string
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

// ── API DNA types ────────────────────────────────────────────────────────────

export interface ApiEndpoint {
  method: string
  path: string
  operation: string
  description?: string
  params?: { name: string; in: string; type: string; required?: boolean }[]
  request?: { name: string; fields: { name: string; type: string; required?: boolean }[] }
  response?: { name: string; fields: { name: string; type: string }[] }
}

export interface ApiResource {
  name: string
  noun: string
  actions: { name: string; verb?: string; description?: string }[]
}

export interface ProductApiDNA {
  namespace: { name: string; path: string }
  resources: ApiResource[]
  endpoints: ApiEndpoint[]
}
`
}

export function rendererDnaLoader(): string {
  return `import type { ProductUiDNA, ProductApiDNA } from './types'

// ── DnaLoader interface — the seam for future API/SSE loaders ────────────────

export interface DnaLoader {
  loadUi(): Promise<ProductUiDNA>
  loadApi(): Promise<ProductApiDNA | null>
  loadOperational(): Promise<unknown | null>
}

// ── StaticFetchLoader — loads DNA from static URLs (current implementation) ──

export class StaticFetchLoader implements DnaLoader {
  constructor(
    private uiUrl: string,
    private apiUrl: string | null,
    private operationalUrl: string | null,
  ) {}

  async loadUi(): Promise<ProductUiDNA> {
    const res = await fetch(this.uiUrl)
    if (!res.ok) throw new Error(\`Failed to load UI DNA: \${res.status}\`)
    return res.json()
  }

  async loadApi(): Promise<ProductApiDNA | null> {
    if (!this.apiUrl) return null
    const res = await fetch(this.apiUrl)
    if (!res.ok) throw new Error(\`Failed to load API DNA: \${res.status}\`)
    return res.json()
  }

  async loadOperational(): Promise<unknown | null> {
    if (!this.operationalUrl) return null
    const res = await fetch(this.operationalUrl)
    if (!res.ok) throw new Error(\`Failed to load Operational DNA: \${res.status}\`)
    return res.json()
  }
}
`
}

export function rendererApiHook(): string {
  return `import { useState, useEffect, useCallback } from 'react'
import { useDna } from './context'
import type { ApiEndpoint } from './types'

function resolvePath(template: string, params: Record<string, string>): string {
  return template.replace(/:([a-zA-Z_]+)/g, (_, key) => params[key] ?? \`:\${key}\`)
}

export function useApi(operation: string | undefined) {
  const { api, apiBase } = useDna()

  const endpoint: ApiEndpoint | undefined = operation
    ? api?.endpoints.find(e => e.operation === operation)
    : undefined

  const fetchList = useCallback(
    async (queryParams?: Record<string, string>) => {
      if (!endpoint) return null
      let url = apiBase + endpoint.path
      if (queryParams) {
        const params = new URLSearchParams()
        for (const [k, v] of Object.entries(queryParams)) {
          if (v) params.set(k, v)
        }
        const qs = params.toString()
        if (qs) url += '?' + qs
      }
      const res = await fetch(url)
      if (!res.ok) throw new Error(\`\${res.status} \${res.statusText}\`)
      return res.json()
    },
    [endpoint, apiBase],
  )

  const fetchOne = useCallback(
    async (pathParams: Record<string, string>) => {
      if (!endpoint) return null
      const resolved = resolvePath(endpoint.path, pathParams)
      const res = await fetch(apiBase + resolved)
      if (!res.ok) throw new Error(\`\${res.status} \${res.statusText}\`)
      return res.json()
    },
    [endpoint, apiBase],
  )

  const submit = useCallback(
    async (body: Record<string, unknown>, pathParams?: Record<string, string>) => {
      if (!endpoint) return null
      const resolved = pathParams ? resolvePath(endpoint.path, pathParams) : endpoint.path
      const res = await fetch(apiBase + resolved, {
        method: endpoint.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => null)
        const msg = errBody?.message ?? \`\${res.status} \${res.statusText}\`
        throw new Error(msg)
      }
      return res.json()
    },
    [endpoint, apiBase],
  )

  return { endpoint, fetchList, fetchOne, submit }
}

export function useApiFetch(
  operation: string | undefined,
  params?: Record<string, string>,
  pathParams?: Record<string, string>,
) {
  const { endpoint, fetchList, fetchOne } = useApi(operation)
  const [data, setData] = useState<unknown>(null)
  const [loading, setLoading] = useState(!!endpoint)
  const [error, setError] = useState<string | null>(null)

  const paramsKey = params ? JSON.stringify(params) : ''
  const pathKey = pathParams ? JSON.stringify(pathParams) : ''

  useEffect(() => {
    if (!endpoint) return
    setLoading(true)
    setError(null)
    const isDetail = endpoint.params?.some(p => p.in === 'path' && p.name === 'id')
    const promise = isDetail && pathParams
      ? fetchOne(pathParams)
      : fetchList(params)
    promise
      .then(result => setData(result))
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false))
  }, [endpoint, paramsKey, pathKey]) // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error, refetch: () => {
    if (!endpoint) return
    setLoading(true)
    const isDetail = endpoint.params?.some(p => p.in === 'path' && p.name === 'id')
    const promise = isDetail && pathParams
      ? fetchOne(pathParams)
      : fetchList(params)
    promise
      .then(result => setData(result))
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false))
  }}
}
`
}

export function rendererApp(): string {
  return `import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import type { ProductUiDNA, ProductApiDNA } from './types'
import { DnaContext } from './context'
import { StaticFetchLoader } from './dna-loader'
import Layout from './Layout'
import Page from './Page'

interface Config {
  ui: string
  api?: string | null
  operational?: string | null
  apiBase?: string
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

function getInitialTheme(): 'light' | 'dark' {
  const stored = localStorage.getItem('theme')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function App() {
  const [dna, setDna] = useState<ProductUiDNA | null>(null)
  const [api, setApi] = useState<ProductApiDNA | null>(null)
  const [apiBase, setApiBase] = useState('')
  const [stubs, setStubs] = useState<Record<string, Record<string, unknown>[]>>({})
  const [error, setError] = useState<string | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme)
  const toggleTheme = () => setTheme(t => {
    const next = t === 'light' ? 'dark' : 'light'
    localStorage.setItem('theme', next)
    return next
  })

  useEffect(() => {
    fetch('/config.json')
      .then(r => r.json() as Promise<Config>)
      .then(async config => {
        setApiBase(config.apiBase ?? '')
        const loader = new StaticFetchLoader(
          config.ui,
          config.api ?? null,
          config.operational ?? null,
        )
        const [uiDna, apiDna, operationalDna] = await Promise.all([
          loader.loadUi(),
          loader.loadApi(),
          loader.loadOperational(),
        ])
        setDna(uiDna)
        setApi(apiDna)
        setStubs(collectStubs(operationalDna))
      })
      .catch(err => setError(String(err)))
  }, [])

  const bg = theme === 'dark' ? '#111827' : '#ffffff'
  const fg = theme === 'dark' ? '#f9fafb' : '#111827'

  if (error) {
    return (
      <div style={{ padding: '2rem', color: '#dc2626', fontFamily: 'system-ui', background: bg, minHeight: '100vh' }}>
        Failed to load DNA: {error}
      </div>
    )
  }

  if (!dna) {
    return (
      <div style={{ padding: '2rem', color: '#6b7280', fontFamily: 'system-ui', background: bg, minHeight: '100vh' }}>
        Loading...
      </div>
    )
  }

  return (
    <DnaContext.Provider value={{ dna, api, apiBase, stubs, theme, toggleTheme }}>
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
  return `import { useState, useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import type { Layout as LayoutDNA, Route } from './types'
import { useDna, useThemeTokens } from './context'

interface Props {
  layout: LayoutDNA
  routes: Route[]
}

function toLabel(pageName: string): string {
  return pageName.replace(/([A-Z])/g, (c, _match, offset: number) =>
    (offset === 0 ? '' : ' ') + c
  )
}

function useIsMobile(breakpoint = 768) {
  const [mobile, setMobile] = useState(window.innerWidth < breakpoint)
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < breakpoint)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [breakpoint])
  return mobile
}

function ThemeToggle() {
  const { theme, toggleTheme } = useDna()
  const t = useThemeTokens()
  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle theme"
      style={{
        background: 'none', border: \`1px solid \${t.borderStrong}\`, borderRadius: '0.375rem',
        padding: '0.375rem 0.625rem', cursor: 'pointer', fontSize: '1rem', lineHeight: 1,
        color: t.text,
      }}
    >
      {theme === 'light' ? '\\u263E' : '\\u2600'}
    </button>
  )
}

export default function Layout({ layout, routes }: Props) {
  if (layout.type === 'sidebar') return <SidebarLayout routes={routes} />
  return <FullWidthLayout routes={routes} />
}

function SidebarLayout({ routes }: { routes: Route[] }) {
  const isMobile = useIsMobile()
  const [menuOpen, setMenuOpen] = useState(false)
  const t = useThemeTokens()

  const navLinkStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
    display: 'block',
    padding: '0.5rem 0.75rem',
    borderRadius: '0.375rem',
    textDecoration: 'none',
    fontSize: '0.875rem',
    color: isActive ? t.primary : t.text,
    background: isActive ? t.primaryBg : 'transparent',
    fontWeight: isActive ? 600 : 400,
  })

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', background: t.bg, color: t.text }}>
      {/* Mobile header */}
      {isMobile && (
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.75rem 1rem', borderBottom: \`1px solid \${t.border}\`, background: t.bgAlt,
          position: 'sticky', top: 0, zIndex: 20,
        }}>
          <span style={{ fontWeight: 600, fontSize: '1rem' }}>Menu</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <ThemeToggle />
            <button
              onClick={() => setMenuOpen(o => !o)}
              style={{ background: 'none', border: \`1px solid \${t.borderStrong}\`, borderRadius: '0.375rem', padding: '0.375rem 0.625rem', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1, color: t.text }}
              aria-label="Toggle navigation"
            >
              {menuOpen ? '\\u2715' : '\\u2630'}
            </button>
          </div>
        </header>
      )}

      {/* Sidebar / mobile dropdown */}
      {(!isMobile || menuOpen) && (
        <nav style={{
          width: isMobile ? '100%' : 240,
          borderRight: isMobile ? 'none' : \`1px solid \${t.border}\`,
          borderBottom: isMobile ? \`1px solid \${t.border}\` : 'none',
          padding: isMobile ? '0.5rem 1rem' : '1.5rem 1rem',
          background: t.bgAlt,
          flexShrink: 0,
          ...(isMobile ? {} : { position: 'sticky' as const, top: 0, height: '100vh', overflowY: 'auto' as const }),
        }}>
          {!isMobile && (
            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <ThemeToggle />
            </div>
          )}
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {routes.map(route => (
              <li key={route.path}>
                <NavLink to={route.path} style={navLinkStyle} onClick={() => setMenuOpen(false)}>
                  {toLabel(route.page)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <main style={{ flex: 1, padding: isMobile ? '1rem' : '2rem', overflow: 'auto' }}>
        <Outlet />
      </main>
    </div>
  )
}

function FullWidthLayout({ routes }: { routes: Route[] }) {
  const isMobile = useIsMobile()
  const t = useThemeTokens()

  const navLinkStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
    display: 'block',
    padding: '0.5rem 0.75rem',
    borderRadius: '0.375rem',
    textDecoration: 'none',
    fontSize: '0.875rem',
    color: isActive ? t.primary : t.text,
    background: isActive ? t.primaryBg : 'transparent',
    fontWeight: isActive ? 600 : 400,
  })

  return (
    <div style={{ minHeight: '100vh', fontFamily: 'system-ui, sans-serif', background: t.bg, color: t.text }}>
      <header style={{ borderBottom: \`1px solid \${t.border}\`, background: t.bgAlt, padding: isMobile ? '0 1rem' : '0 2rem' }}>
        <nav style={{ display: 'flex', gap: '0.25rem', height: 56, alignItems: 'center', overflowX: 'auto' }}>
          {routes.map(route => (
            <NavLink key={route.path} to={route.path} style={navLinkStyle}>
              {toLabel(route.page)}
            </NavLink>
          ))}
          <div style={{ marginLeft: 'auto' }}><ThemeToggle /></div>
        </nav>
      </header>
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '1rem' : '2rem' }}>
        <Outlet />
      </main>
    </div>
  )
}
`
}

export function rendererPage(): string {
  return `import type { Page as PageDNA } from './types'
import { useThemeTokens } from './context'
import Block from './Block'

function toTitle(name: string): string {
  return name.replace(/([A-Z])/g, (c, _match, offset: number) =>
    (offset === 0 ? '' : ' ') + c
  )
}

export default function Page({ page }: { page: PageDNA }) {
  const t = useThemeTokens()
  return (
    <div style={{ maxWidth: '100%', overflowX: 'hidden' }}>
      <h1 style={{ marginBottom: '0.25rem', fontSize: 'clamp(1.125rem, 4vw, 1.5rem)', fontWeight: 700, color: t.text }}>
        {toTitle(page.name)}
      </h1>
      {page.description && (
        <p style={{ marginTop: 0, marginBottom: '1.5rem', color: t.textSecondary, fontSize: '0.875rem' }}>
          {page.description}
        </p>
      )}
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
import { useThemeTokens } from './context'
import FormBlock from './blocks/FormBlock'
import TableBlock from './blocks/TableBlock'
import DetailBlock from './blocks/DetailBlock'
import ActionsBlock from './blocks/ActionsBlock'
import EmptyStateBlock from './blocks/EmptyStateBlock'

interface Props {
  block: BlockDNA
  resource: string
}

function toLabel(name: string): string {
  return name.replace(/([A-Z])/g, (c, _match, offset: number) =>
    (offset === 0 ? '' : ' ') + c
  )
}

function BlockContent({ block, resource }: Props) {
  switch (block.type) {
    case 'form':        return <FormBlock block={block} />
    case 'table':       return <TableBlock block={block} resource={resource} />
    case 'detail':      return <DetailBlock block={block} resource={resource} />
    case 'actions':     return <ActionsBlock block={block} resource={resource} />
    case 'empty-state': return <EmptyStateBlock block={block} />
    default:
      return (
        <div style={{ color: '#9ca3af', fontSize: '0.875rem', marginBottom: '1rem' }}>
          Unknown block type: {block.type}
        </div>
      )
  }
}

export default function Block({ block, resource }: Props) {
  const t = useThemeTokens()
  const showHeader = block.type !== 'actions' && block.type !== 'empty-state'
  return (
    <section style={{ marginBottom: '1.5rem' }}>
      {showHeader && (
        <div style={{ marginBottom: '0.75rem' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: t.text }}>
            {toLabel(block.name)}
          </h2>
          {block.description && (
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: t.textMuted }}>
              {block.description}
            </p>
          )}
        </div>
      )}
      <BlockContent block={block} resource={resource} />
    </section>
  )
}
`
}

export function rendererFormBlock(): string {
  return `import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useThemeTokens } from '../context'
import { useApi } from '../useApi'
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

function coerceValue(value: string, type: string): unknown {
  if (value === '') return undefined
  if (type === 'number') return Number(value)
  return value
}

export default function FormBlock({ block }: { block: Block }) {
  const fields = block.fields ?? []
  const t = useThemeTokens()
  const { endpoint, submit } = useApi(block.operation)
  const routeParams = useParams<Record<string, string>>()
  const navigate = useNavigate()

  const [state, setState] = useState<Record<string, string>>(
    () => Object.fromEntries(fields.map(f => [f.name, '']))
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const isFilterForm = endpoint?.method === 'GET'
  const actionLabel = block.operation?.split('.').pop() ?? 'Submit'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!endpoint) return

    if (isFilterForm) return

    setSubmitting(true)
    setError(null)
    setSuccess(false)
    try {
      const body: Record<string, unknown> = {}
      for (const f of fields) {
        const val = coerceValue(state[f.name], f.type)
        if (val !== undefined) body[f.name] = val
      }
      const pathParams = routeParams.id ? { id: routeParams.id } : undefined
      await submit(body, pathParams)
      setSuccess(true)
      setState(Object.fromEntries(fields.map(f => [f.name, ''])))
      setTimeout(() => navigate(-1), 800)
    } catch (err) {
      setError(String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: '1.5rem' }}>
      {error && (
        <div style={{ padding: '0.75rem 1rem', color: t.danger, background: t.dangerBg, borderRadius: '0.375rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ padding: '0.75rem 1rem', color: t.success, background: t.successBg, borderRadius: '0.375rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
          Success!
        </div>
      )}
      {fields.map(field => (
        <div key={field.name} style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500, color: t.text }}>
            {field.label}{field.required ? ' *' : ''}
          </label>
          {field.type === 'enum' && field.values ? (
            <select
              value={state[field.name] ?? ''}
              onChange={e => setState(s => ({ ...s, [field.name]: e.target.value }))}
              style={{ width: '100%', padding: '0.5rem', border: \`1px solid \${t.borderStrong}\`, borderRadius: '0.375rem', background: t.inputBg, color: t.text }}
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
              disabled={submitting}
              style={{ width: '100%', padding: '0.5rem', border: \`1px solid \${t.borderStrong}\`, borderRadius: '0.375rem', boxSizing: 'border-box', background: t.inputBg, color: t.text }}
            />
          )}
        </div>
      ))}
      {!isFilterForm && (
        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: '0.5rem 1rem',
            background: submitting ? t.textMuted : t.primary,
            color: '#fff',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? \`\${actionLabel}ing...\` : actionLabel}
        </button>
      )}
    </form>
  )
}
`
}

export function rendererTableBlock(): string {
  return `import { useNavigate } from 'react-router-dom'
import { useDna, useThemeTokens } from '../context'
import { useApiFetch } from '../useApi'
import type { Block } from '../types'

interface Props {
  block: Block
  resource: string
}

function resolveRowLink(template: string, row: Record<string, unknown>): string {
  return template.replace(/:([a-zA-Z_]+)/g, (_, key) => String(row[key] ?? ''))
}

export default function TableBlock({ block, resource }: Props) {
  const { dna, stubs } = useDna()
  const t = useThemeTokens()
  const navigate = useNavigate()
  const fields = block.fields ?? []
  const { data, loading, error } = useApiFetch(block.operation)

  const apiRows = data
    ? (Array.isArray(data) ? data : (data as Record<string, unknown>).data ?? []) as Record<string, unknown>[]
    : null
  const rows = apiRows ?? stubs[resource] ?? []

  // Resolve row link: explicit rowLink on block, or infer from routes
  const rowLink = block.rowLink
    ?? dna.routes.find(r => r.path.includes(':id') && dna.pages.find(p => p.name === r.page && p.resource === resource))?.path
    ?? null

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: t.textSecondary, marginBottom: '1.5rem' }}>
        Loading...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '1rem', color: t.danger, background: t.dangerBg, borderRadius: '0.375rem', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
        Failed to load data: {error}
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead>
          <tr>
            {fields.map(f => (
              <th
                key={f.name}
                style={{ padding: '0.75rem 1rem', textAlign: 'left', borderBottom: \`2px solid \${t.border}\`, fontWeight: 600, whiteSpace: 'nowrap', color: t.text }}
              >
                {f.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? rows.map((row, i) => (
            <tr
              key={i}
              onClick={rowLink ? () => navigate(resolveRowLink(rowLink, row)) : undefined}
              style={{
                background: i % 2 === 0 ? 'transparent' : t.rowStripe,
                cursor: rowLink ? 'pointer' : 'default',
              }}
            >
              {fields.map(f => (
                <td
                  key={f.name}
                  style={{ padding: '0.75rem 1rem', borderBottom: \`1px solid \${t.border}\`, color: t.text }}
                >
                  {String(row[f.name] ?? '—')}
                </td>
              ))}
            </tr>
          )) : (
            <tr>
              <td
                colSpan={fields.length}
                style={{ padding: '2rem', textAlign: 'center', color: t.textMuted }}
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
  return `import { useParams } from 'react-router-dom'
import { useDna, useThemeTokens } from '../context'
import { useApiFetch } from '../useApi'
import type { Block } from '../types'

interface Props {
  block: Block
  resource: string
}

export default function DetailBlock({ block, resource }: Props) {
  const { stubs } = useDna()
  const t = useThemeTokens()
  const routeParams = useParams<Record<string, string>>()
  const fields = block.fields ?? []

  const pathParams = routeParams.id ? { id: routeParams.id } : undefined
  const { data, loading, error } = useApiFetch(block.operation, undefined, pathParams)

  const record = (data as Record<string, unknown>) ?? (stubs[resource] ?? [])[0] ?? {}

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: t.textSecondary, marginBottom: '1.5rem' }}>
        Loading...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '1rem', color: t.danger, background: t.dangerBg, borderRadius: '0.375rem', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
        Failed to load record: {error}
      </div>
    )
  }

  return (
    <dl
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 200px) 1fr',
        gap: '0.5rem 1rem',
        marginBottom: '1.5rem',
        padding: '1rem',
        border: \`1px solid \${t.border}\`,
        borderRadius: '0.5rem',
        background: t.bgAlt,
      }}
    >
      {fields.map(f => (
        <div key={f.name} style={{ display: 'contents' }}>
          <dt style={{ fontWeight: 500, color: t.textSecondary, fontSize: '0.875rem', wordBreak: 'break-word' }}>{f.label}</dt>
          <dd style={{ margin: 0, wordBreak: 'break-word', color: t.text }}>{String(record[f.name] ?? '—')}</dd>
        </div>
      ))}
    </dl>
  )
}
`
}

export function rendererActionsBlock(): string {
  return `import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDna, useThemeTokens } from '../context'
import { useApi } from '../useApi'
import type { Block, ApiResource } from '../types'

interface Props {
  block: Block
  resource: string
}

function ActionButton({ resource, actionName }: { resource: string; actionName: string }) {
  const operation = \`\${resource}.\${actionName}\`
  const { submit } = useApi(operation)
  const t = useThemeTokens()
  const routeParams = useParams<Record<string, string>>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    setLoading(true)
    setError(null)
    try {
      const pathParams = routeParams.id ? { id: routeParams.id } : undefined
      await submit({}, pathParams)
      navigate(-1)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  const isDanger = /reject|delete|cancel/i.test(actionName)
  const bg = isDanger ? t.danger : t.success

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        style={{
          padding: '0.5rem 1rem',
          background: loading ? t.textMuted : bg,
          color: '#fff',
          border: 'none',
          borderRadius: '0.375rem',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? \`\${actionName}...\` : actionName}
      </button>
      {error && (
        <div style={{ color: t.danger, fontSize: '0.75rem', marginTop: '0.25rem' }}>{error}</div>
      )}
    </div>
  )
}

export default function ActionsBlock({ block: _block, resource }: Props) {
  const { api } = useDna()
  const apiResource: ApiResource | undefined = api?.resources.find(r => r.name === resource)
  const actions = apiResource?.actions.filter(a => a.verb) ?? []

  if (actions.length === 0) return null

  return (
    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
      {actions.map(action => (
        <ActionButton key={action.name} resource={resource} actionName={action.name} />
      ))}
    </div>
  )
}
`
}

export function rendererEmptyStateBlock(): string {
  return `import type { Block } from '../types'
import { useThemeTokens } from '../context'

export default function EmptyStateBlock({ block }: { block: Block }) {
  const t = useThemeTokens()
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '3rem',
        color: t.textMuted,
        border: \`2px dashed \${t.border}\`,
        borderRadius: '0.5rem',
        marginBottom: '1.5rem',
      }}
    >
      <p style={{ margin: 0 }}>{block.description ?? 'No results found.'}</p>
    </div>
  )
}
`
}
