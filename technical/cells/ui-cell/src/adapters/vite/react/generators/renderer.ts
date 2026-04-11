// ── Fixed renderer component templates ───────────────────────────────────────
// These are emitted once per generated app. They contain no DNA-derived values —
// all DNA is fetched at runtime from the source dna/ directory.

export function rendererGlobalsCss(layout: any): string {
  const theme = layout.theme ?? {}
  const colors: Record<string, string> = theme.colors ?? {
    'background': '#ffffff',
    'foreground': '#0a0a0a',
    'primary': '#171717',
    'primary-foreground': '#fafafa',
    'secondary': '#f5f5f5',
    'secondary-foreground': '#171717',
    'muted': '#f5f5f5',
    'muted-foreground': '#737373',
    'accent': '#f5f5f5',
    'accent-foreground': '#171717',
    'destructive': '#ef4444',
    'destructive-foreground': '#fafafa',
    'border': '#e5e5e5',
    'input': '#e5e5e5',
    'ring': '#171717',
    'card': '#ffffff',
    'card-foreground': '#0a0a0a',
    'popover': '#ffffff',
    'popover-foreground': '#0a0a0a',
    'sidebar-background': '#fafafa',
    'sidebar-foreground': '#0a0a0a',
    'sidebar-border': '#e5e5e5',
    'sidebar-accent': '#f5f5f5',
    'sidebar-accent-foreground': '#171717',
  }
  const dark: Record<string, string> = theme.dark ?? {
    'background': '#0a0a0a',
    'foreground': '#fafafa',
    'primary': '#fafafa',
    'primary-foreground': '#171717',
    'secondary': '#262626',
    'secondary-foreground': '#fafafa',
    'muted': '#262626',
    'muted-foreground': '#a3a3a3',
    'accent': '#262626',
    'accent-foreground': '#fafafa',
    'destructive': '#7f1d1d',
    'destructive-foreground': '#fafafa',
    'border': '#262626',
    'input': '#262626',
    'ring': '#d4d4d4',
    'card': '#0a0a0a',
    'card-foreground': '#fafafa',
    'popover': '#0a0a0a',
    'popover-foreground': '#fafafa',
    'sidebar-background': '#171717',
    'sidebar-foreground': '#fafafa',
    'sidebar-border': '#262626',
    'sidebar-accent': '#262626',
    'sidebar-accent-foreground': '#fafafa',
  }
  const radius = theme.radius ?? '0.5rem'
  const font = theme.font ?? 'system-ui, sans-serif'

  const lightVars = Object.entries(colors).map(([k, v]) => `  --${k}: ${v};`).join('\n')
  const darkVars = Object.entries(dark).map(([k, v]) => `  --${k}: ${v};`).join('\n')

  return `@import "tailwindcss";

@theme {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-sidebar-background: var(--sidebar-background);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

:root {
  --radius: ${radius};
${lightVars}

  /* ── SurveyJS theme tokens ─────────────────────────────────────────── */
  /* Map SurveyJS v1.12+ tokens onto the layout theme so survey blocks    */
  /* inherit the brand automatically.                                      */
  --sjs-primary-backcolor: var(--primary);
  --sjs-primary-backcolor-light: var(--accent);
  --sjs-primary-backcolor-dark: var(--primary);
  --sjs-primary-forecolor: var(--primary-foreground);
  --sjs-primary-forecolor-light: var(--primary-foreground);
  --sjs-general-backcolor: var(--background);
  --sjs-general-backcolor-dim: var(--muted);
  --sjs-general-backcolor-dim-light: var(--muted);
  --sjs-general-forecolor: var(--foreground);
  --sjs-general-forecolor-light: var(--muted-foreground);
  --sjs-editor-background: var(--muted);
  --sjs-questionpanel-backcolor: var(--background);
  --sjs-questionpanel-hovercolor: var(--accent);
  --sjs-font-editorfont-color: var(--foreground);
  --sjs-font-editorfont-placeholdercolor: var(--muted-foreground);
  --sjs-border-default: var(--border);
  --sjs-border-light: var(--border);
  --sjs-border-inside: var(--border);
  --sjs-corner-radius: var(--radius);
  --sjs-base-unit: 8px;
  --sjs-font-family: ${font};
}

/* SurveyJS inputs use border: none + an inset box-shadow for their outline.
   Override .sd-input directly with a subtle 1px white inset ring so every
   input reads as a distinct chip against the muted fill without needing
   hover. Using a direct selector rather than --sjs-shadow-inner because the
   token-based approach didn't land consistently across Tailwind v4's
   cascade layers. */
.sd-input,
.sd-input.sd-dropdown,
.sd-input.sd-tagbox,
.sd-input.sd-comment {
  box-shadow: inset 0 0 0 1px #ffffff;
}

.sd-input:focus,
.sd-input:focus-within {
  box-shadow: inset 0 0 0 1px #ffffff, 0 0 0 2px var(--primary);
}

.dark {
${darkVars}
}

body {
  font-family: ${font};
  background-color: var(--background);
  color: var(--foreground);
}
`
}

export function rendererContext(): string {
  return `import { createContext, useContext } from 'react'
import type { ProductUiDNA, ProductApiDNA } from './types'

export interface DnaContextValue {
  dna: ProductUiDNA
  api: ProductApiDNA | null
  apiBase: string
  stubs: Record<string, Record<string, unknown>[]>
}

export const DnaContext = createContext<DnaContextValue | null>(null)

export function useDna(): DnaContextValue {
  const ctx = useContext(DnaContext)
  if (!ctx) throw new Error('useDna must be used within a DnaContext.Provider')
  return ctx
}

// ── Legacy theme tokens (CSS variable bridge for blocks — Phase 5 will remove) ──

const cssVarTokens = {
  bg: 'var(--background)',
  bgAlt: 'var(--sidebar-background)',
  bgHover: 'var(--accent)',
  text: 'var(--foreground)',
  textSecondary: 'var(--muted-foreground)',
  textMuted: 'var(--muted-foreground)',
  border: 'var(--border)',
  borderStrong: 'var(--border)',
  primary: 'var(--primary)',
  primaryBg: 'var(--accent)',
  success: '#16a34a',
  successBg: '#f0fdf4',
  danger: 'var(--destructive)',
  dangerBg: '#fef2f2',
  inputBg: 'var(--background)',
  rowStripe: 'var(--muted)',
}

export function useThemeTokens() {
  return cssVarTokens
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
  features?: {
    sidebar?: boolean
    profileDropdown?: boolean
    tenantPicker?: boolean
    themeToggle?: boolean
  }
  tenants?: { id: string; name: string }[]
  navigation?: NavGroup[]
  brand?: {
    name?: string
    tagline?: string
    logo?: string
    href?: string
  }
  hero?: {
    eyebrow?: string
    title?: string
    subtitle?: string
    cta?: { label: string; route: string }
    secondaryCta?: { label: string; route: string }
  }
  footer?: {
    text?: string
    links?: { label: string; href: string }[]
  }
  theme?: {
    colors?: Record<string, string>
    dark?: Record<string, string>
    radius?: string
    font?: string
  }
}

export interface NavChild {
  route: string
  label: string
  icon?: string
}

export interface NavGroup {
  label: string
  icon?: string
  route?: string
  children?: NavChild[]
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
  loadCore(): Promise<unknown | null>
}

// ── StaticFetchLoader — loads DNA from static URLs (current implementation) ──

export class StaticFetchLoader implements DnaLoader {
  constructor(
    private uiUrl: string,
    private apiUrl: string | null,
    private coreUrl: string | null,
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

  async loadCore(): Promise<unknown | null> {
    if (!this.coreUrl) return null
    const res = await fetch(this.coreUrl)
    if (!res.ok) throw new Error(\`Failed to load Product Core DNA: \${res.status}\`)
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
  core?: string | null
  apiBase?: string
}

function collectStubs(core: unknown): Record<string, Record<string, unknown>[]> {
  const stubs: Record<string, Record<string, unknown>[]> = {}
  const typed = core as { nouns?: { name: string; examples?: Record<string, unknown>[] }[] } | null
  for (const noun of typed?.nouns ?? []) {
    if (noun.examples?.length) stubs[noun.name] = noun.examples
  }
  return stubs
}

export default function App() {
  const [dna, setDna] = useState<ProductUiDNA | null>(null)
  const [api, setApi] = useState<ProductApiDNA | null>(null)
  const [apiBase, setApiBase] = useState('')
  const [stubs, setStubs] = useState<Record<string, Record<string, unknown>[]>>({})
  const [error, setError] = useState<string | null>(null)

  // Initialize dark mode class on document
  useEffect(() => {
    const stored = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = stored === 'dark' || (!stored && prefersDark)
    document.documentElement.classList.toggle('dark', isDark)
  }, [])

  useEffect(() => {
    fetch('/config.json')
      .then(r => r.json() as Promise<Config>)
      .then(async config => {
        setApiBase(config.apiBase ?? '')
        const loader = new StaticFetchLoader(
          config.ui,
          config.api ?? null,
          config.core ?? null,
        )
        const [uiDna, apiDna, coreDna] = await Promise.all([
          loader.loadUi(),
          loader.loadApi(),
          loader.loadCore(),
        ])
        setDna(uiDna)
        setApi(apiDna)
        setStubs(collectStubs(coreDna))
      })
      .catch(err => setError(String(err)))
  }, [])

  if (error) {
    return (
      <div style={{ padding: '2rem', color: '#dc2626', fontFamily: 'system-ui', minHeight: '100vh' }}>
        Failed to load DNA: {error}
      </div>
    )
  }

  if (!dna) {
    return (
      <div style={{ padding: '2rem', color: '#6b7280', fontFamily: 'system-ui', minHeight: '100vh' }}>
        Loading...
      </div>
    )
  }

  return (
    <DnaContext.Provider value={{ dna, api, apiBase, stubs }}>
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
import UniversalLayout from './UniversalLayout'
import MarketingLayout from './MarketingLayout'

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

export default function Layout({ layout, routes }: Props) {
  if (layout.type === 'universal') return <UniversalLayout routes={routes} />
  if (layout.type === 'marketing') return <MarketingLayout layout={layout} routes={routes} />
  if (layout.type === 'sidebar') return <SidebarLayout routes={routes} />
  return <FullWidthLayout routes={routes} />
}

function SidebarLayout({ routes }: { routes: Route[] }) {
  const isMobile = useIsMobile()
  const [menuOpen, setMenuOpen] = useState(false)

  const navLinkStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
    display: 'block',
    padding: '0.5rem 0.75rem',
    borderRadius: '0.375rem',
    textDecoration: 'none',
    fontSize: '0.875rem',
    color: isActive ? 'var(--primary)' : 'var(--foreground)',
    background: isActive ? 'var(--accent)' : 'transparent',
    fontWeight: isActive ? 600 : 400,
  })

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', background: 'var(--background)', color: 'var(--foreground)' }}>
      {/* Mobile header */}
      {isMobile && (
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', background: 'var(--sidebar-background)',
          position: 'sticky', top: 0, zIndex: 20,
        }}>
          <span style={{ fontWeight: 600, fontSize: '1rem' }}>Menu</span>
          <button
            onClick={() => setMenuOpen(o => !o)}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '0.375rem', padding: '0.375rem 0.625rem', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1, color: 'var(--foreground)' }}
            aria-label="Toggle navigation"
          >
            {menuOpen ? '\\u2715' : '\\u2630'}
          </button>
        </header>
      )}

      {/* Sidebar / mobile dropdown */}
      {(!isMobile || menuOpen) && (
        <nav style={{
          width: isMobile ? '100%' : 240,
          borderRight: isMobile ? 'none' : '1px solid var(--border)',
          borderBottom: isMobile ? '1px solid var(--border)' : 'none',
          padding: isMobile ? '0.5rem 1rem' : '1.5rem 1rem',
          background: 'var(--sidebar-background)',
          flexShrink: 0,
          ...(isMobile ? {} : { position: 'sticky' as const, top: 0, height: '100vh', overflowY: 'auto' as const }),
        }}>
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

  const navLinkStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
    display: 'block',
    padding: '0.5rem 0.75rem',
    borderRadius: '0.375rem',
    textDecoration: 'none',
    fontSize: '0.875rem',
    color: isActive ? 'var(--primary)' : 'var(--foreground)',
    background: isActive ? 'var(--accent)' : 'transparent',
    fontWeight: isActive ? 600 : 400,
  })

  return (
    <div style={{ minHeight: '100vh', fontFamily: 'system-ui, sans-serif', background: 'var(--background)', color: 'var(--foreground)' }}>
      <header style={{ borderBottom: '1px solid var(--border)', background: 'var(--sidebar-background)', padding: isMobile ? '0 1rem' : '0 2rem' }}>
        <nav style={{ display: 'flex', gap: '0.25rem', height: 56, alignItems: 'center', overflowX: 'auto' }}>
          {routes.map(route => (
            <NavLink key={route.path} to={route.path} style={navLinkStyle}>
              {toLabel(route.page)}
            </NavLink>
          ))}
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

export function rendererMarketingLayout(): string {
  return `import { useState, useEffect } from 'react'
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom'
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

function useIsMobile(breakpoint = 768) {
  const [mobile, setMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false,
  )
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < breakpoint)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [breakpoint])
  return mobile
}

/**
 * MarketingLayout — a full-width public marketing shell.
 *
 * Structure:
 *   - Sticky top header: brand on the left, nav links on the right,
 *     optional primary CTA button next to the nav. Collapses to a
 *     hamburger menu on mobile.
 *   - Hero section (only on the home route '/') with eyebrow, title,
 *     subtitle, and up to two CTA buttons. Configured via layout.hero.
 *   - <Outlet /> — the routed page content, full-width with a centered
 *     1200px max-width container.
 *   - Footer with plain text + optional link list. Configured via
 *     layout.footer.
 *
 * All colors come from CSS variables set by globals.css so the
 * white-label theme system still applies.
 */
export default function MarketingLayout({ layout, routes }: Props) {
  const isMobile = useIsMobile()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  const brand = layout.brand ?? {}
  const hero = layout.hero
  const footer = layout.footer
  const brandHref = brand.href ?? routes[0]?.path ?? '/'
  const brandName = brand.name ?? layout.name

  // The primary CTA in the top header also appears as the hero CTA below.
  const headerCta = hero?.cta

  // Hero only renders on the root route so inner pages aren't cluttered.
  const showHero = hero && (location.pathname === '/' || location.pathname === brandHref)

  const navLinkStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
    display: 'inline-block',
    padding: '0.5rem 0.875rem',
    borderRadius: '0.375rem',
    textDecoration: 'none',
    fontSize: '0.9375rem',
    color: isActive ? 'var(--primary)' : 'var(--foreground)',
    fontWeight: isActive ? 600 : 500,
  })

  const ctaPrimaryStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '0.75rem 1.25rem',
    borderRadius: '0.5rem',
    background: 'var(--primary)',
    color: 'var(--primary-foreground)',
    fontWeight: 600,
    fontSize: '0.9375rem',
    textDecoration: 'none',
    border: 'none',
    cursor: 'pointer',
  }

  const ctaSecondaryStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '0.75rem 1.25rem',
    borderRadius: '0.5rem',
    background: 'transparent',
    color: 'var(--foreground)',
    fontWeight: 600,
    fontSize: '0.9375rem',
    textDecoration: 'none',
    border: '1px solid var(--border)',
  }

  return (
    <div style={{
      minHeight: '100vh',
      fontFamily: 'var(--font-family, system-ui, sans-serif)',
      background: 'var(--background)',
      color: 'var(--foreground)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        borderBottom: '1px solid var(--border)',
        background: 'var(--background)',
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: isMobile ? '0.75rem 1rem' : '1rem 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}>
          <Link to={brandHref} style={{
            textDecoration: 'none',
            color: 'var(--foreground)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            {brand.logo && (
              <img src={brand.logo} alt="" style={{ height: 32, width: 'auto' }} />
            )}
            <span>
              <span style={{ display: 'block', fontWeight: 700, fontSize: '1.0625rem', lineHeight: 1.2 }}>
                {brandName}
              </span>
              {brand.tagline && !isMobile && (
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--muted-foreground)', lineHeight: 1.2 }}>
                  {brand.tagline}
                </span>
              )}
            </span>
          </Link>

          {isMobile ? (
            <button
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Toggle menu"
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: '0.375rem',
                padding: '0.375rem 0.625rem',
                cursor: 'pointer',
                fontSize: '1.25rem',
                lineHeight: 1,
                color: 'var(--foreground)',
              }}
            >
              {menuOpen ? '\u2715' : '\u2630'}
            </button>
          ) : (
            <nav style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
              {routes.map(route => (
                <NavLink key={route.path} to={route.path} end={route.path === '/'} style={navLinkStyle}>
                  {toLabel(route.page)}
                </NavLink>
              ))}
              {headerCta && (
                <Link to={headerCta.route} style={{ ...ctaPrimaryStyle, marginLeft: '0.75rem', padding: '0.5rem 1rem' }}>
                  {headerCta.label}
                </Link>
              )}
            </nav>
          )}
        </div>

        {/* Mobile nav drawer */}
        {isMobile && menuOpen && (
          <nav style={{
            borderTop: '1px solid var(--border)',
            background: 'var(--background)',
            padding: '0.5rem 1rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
          }}>
            {routes.map(route => (
              <NavLink
                key={route.path}
                to={route.path}
                end={route.path === '/'}
                style={navLinkStyle}
                onClick={() => setMenuOpen(false)}
              >
                {toLabel(route.page)}
              </NavLink>
            ))}
            {headerCta && (
              <Link
                to={headerCta.route}
                style={{ ...ctaPrimaryStyle, marginTop: '0.5rem', textAlign: 'center' }}
                onClick={() => setMenuOpen(false)}
              >
                {headerCta.label}
              </Link>
            )}
          </nav>
        )}
      </header>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      {showHero && hero && (
        <section style={{
          background: 'var(--muted, transparent)',
          borderBottom: '1px solid var(--border)',
          padding: isMobile ? '3rem 1rem' : '5rem 2rem',
        }}>
          <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
            {hero.eyebrow && (
              <div style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: 'var(--primary)',
                marginBottom: '1rem',
              }}>
                {hero.eyebrow}
              </div>
            )}
            {hero.title && (
              <h1 style={{
                fontSize: isMobile ? '2rem' : '3rem',
                fontWeight: 800,
                lineHeight: 1.15,
                margin: '0 0 1.25rem',
                color: 'var(--foreground)',
              }}>
                {hero.title}
              </h1>
            )}
            {hero.subtitle && (
              <p style={{
                fontSize: isMobile ? '1rem' : '1.125rem',
                lineHeight: 1.6,
                color: 'var(--muted-foreground)',
                margin: '0 auto 2rem',
                maxWidth: 640,
              }}>
                {hero.subtitle}
              </p>
            )}
            {(hero.cta || hero.secondaryCta) && (
              <div style={{
                display: 'flex',
                gap: '0.75rem',
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}>
                {hero.cta && (
                  <Link to={hero.cta.route} style={ctaPrimaryStyle}>
                    {hero.cta.label}
                  </Link>
                )}
                {hero.secondaryCta && (
                  <Link to={hero.secondaryCta.route} style={ctaSecondaryStyle}>
                    {hero.secondaryCta.label}
                  </Link>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Main content ────────────────────────────────────────────── */}
      <main style={{
        flex: 1,
        maxWidth: 1200,
        width: '100%',
        margin: '0 auto',
        padding: isMobile ? '2rem 1rem' : '3rem 2rem',
      }}>
        <Outlet />
      </main>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      {footer && (
        <footer style={{
          borderTop: '1px solid var(--border)',
          background: 'var(--muted, transparent)',
          padding: isMobile ? '1.5rem 1rem' : '2rem',
        }}>
          <div style={{
            maxWidth: 1200,
            margin: '0 auto',
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'flex-start' : 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            fontSize: '0.875rem',
            color: 'var(--muted-foreground)',
          }}>
            {footer.text && <span>{footer.text}</span>}
            {footer.links && footer.links.length > 0 && (
              <nav style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                {footer.links.map(link => (
                  <a
                    key={link.href}
                    href={link.href}
                    style={{ color: 'var(--muted-foreground)', textDecoration: 'none' }}
                  >
                    {link.label}
                  </a>
                ))}
              </nav>
            )}
          </div>
        </footer>
      )}
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
import SurveyBlock from './blocks/SurveyBlock'
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
    case 'survey':      return <SurveyBlock block={block} />
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
  const showHeader = block.type !== 'actions' && block.type !== 'empty-state' && block.type !== 'survey'
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

/**
 * SurveyBlock — renders a form via SurveyJS so the marketing site can ship
 * a branded intake with validation, progress, and a thank-you state without
 * hand-authoring inputs.
 *
 * The survey model is built directly from block.fields (the product.ui.json
 * entry) and wired to the endpoint resolved from block.operation. Theme is
 * applied via SurveyJS v1.12+ CSS variables so brand colors flow through from
 * globals.css (which maps them to the layout DNA theme config).
 */
export function rendererSurveyBlock(): string {
  return `import { useEffect, useMemo, useState } from 'react'
import { Model } from 'survey-core'
import { Survey } from 'survey-react-ui'
import 'survey-core/survey-core.css'
import { useDna, useThemeTokens } from '../context'
import { useApi } from '../useApi'
import type { Block, Field } from '../types'

// Note: SurveyJS brand tokens (--sjs-primary-backcolor, --sjs-editor-background,
// --sjs-shadow-inner, etc.) are declared at :root in globals.css so every
// survey block inherits the layout theme without ref-based runtime theming.

type SurveyQuestion = Record<string, unknown>

/**
 * Map a Product API Field to a SurveyJS question definition.
 * SurveyJS question type reference:
 *   text       — single-line input (use inputType for number/date/email/phone)
 *   comment    — multi-line textarea
 *   dropdown   — select menu
 *   radiogroup — radio buttons
 */
function fieldToQuestion(field: Field): SurveyQuestion {
  const base: SurveyQuestion = {
    name: field.name,
    title: field.label ?? field.name,
    isRequired: !!field.required,
  }

  if (field.type === 'enum' && field.values && field.values.length > 0) {
    const niceChoices = field.values.map((v: string) => ({
      value: v,
      text: v.replace(/_/g, ' ').replace(/\\b\\w/g, (c) => c.toUpperCase()),
    }))
    // Radio for small sets, dropdown for larger ones
    const questionType = field.values.length <= 5 ? 'radiogroup' : 'dropdown'
    return { ...base, type: questionType, choices: niceChoices }
  }

  if (field.type === 'text') {
    return { ...base, type: 'comment', rows: 4 }
  }

  const typeMap: Record<string, string> = {
    number: 'number',
    date: 'date',
    datetime: 'datetime-local',
    email: 'email',
    phone: 'tel',
    password: 'password',
  }
  const inputType = typeMap[field.type]
  if (inputType) {
    return { ...base, type: 'text', inputType }
  }

  return { ...base, type: 'text' }
}

export default function SurveyBlock({ block }: { block: Block }) {
  const fields = block.fields ?? []
  const t = useThemeTokens()
  const { apiBase } = useDna()
  const { endpoint, submit } = useApi(block.operation)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Mock-submit mode: when no apiBase is configured (e.g. marketing-only
  // preview with no api-cell running), we log the payload and show the
  // success state instead of attempting a network call.
  const isMock = !apiBase || !endpoint

  const survey = useMemo(() => {
    const actionLabel = block.operation?.split('.').pop() ?? 'Submit'
    const model = new Model({
      showQuestionNumbers: 'off',
      completeText: actionLabel,
      showCompletedPage: false,
      questionErrorLocation: 'bottom',
      elements: fields.map(fieldToQuestion),
    })
    return model
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(fields), block.operation])

  useEffect(() => {
    const handler = async (sender: Model) => {
      setError(null)
      const payload = sender.data as Record<string, unknown>
      if (isMock) {
        // eslint-disable-next-line no-console
        console.info('[SurveyBlock] mock-submit', { operation: block.operation, payload })
        setSuccess(true)
        return
      }
      try {
        await submit(payload)
        setSuccess(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    }
    survey.onComplete.add(handler)
    return () => {
      survey.onComplete.remove(handler)
    }
  }, [survey, submit, isMock, block.operation])

  if (success) {
    return (
      <div
        style={{
          padding: '2rem',
          background: 'var(--accent, #fef2f2)',
          color: 'var(--accent-foreground, #b91c1c)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          textAlign: 'center',
        }}
      >
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: 700 }}>
          Thank you — your intake has been received.
        </h3>
        <p style={{ margin: 0, color: t.textMuted, fontSize: '0.9375rem' }}>
          An attorney will review your submission and follow up within two business days.
        </p>
        {isMock && (
          <p
            style={{
              margin: '1rem 0 0',
              padding: '0.375rem 0.75rem',
              display: 'inline-block',
              background: 'var(--muted)',
              color: 'var(--muted-foreground)',
              border: '1px dashed var(--border)',
              borderRadius: 6,
              fontSize: '0.75rem',
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            }}
          >
            preview mode — submission was logged to console, not sent
          </p>
        )}
      </div>
    )
  }

  if (fields.length === 0) {
    return (
      <div style={{ color: t.textMuted, fontSize: '0.875rem' }}>
        No fields configured for this survey block.
      </div>
    )
  }

  return (
    <div>
      <Survey model={survey} />
      {error && (
        <div
          role="alert"
          style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            background: 'var(--accent, #fef2f2)',
            color: 'var(--destructive, #dc2626)',
            border: '1px solid var(--destructive, #dc2626)',
            borderRadius: 8,
            fontSize: '0.875rem',
          }}
        >
          {error}
        </div>
      )}
    </div>
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

export function rendererLayoutMachine(): string {
  return `import { setup, assign } from 'xstate'
import { useMachine } from '@xstate/react'
import { useEffect } from 'react'

// ── Layout chrome state machine (XState v5) ──────────────────────────────────

export interface LayoutFeatures {
  sidebar?: boolean
  profileDropdown?: boolean
  tenantPicker?: boolean
  themeToggle?: boolean
}

export interface LayoutContext {
  sidebarCollapsed: boolean
  sidebarOpen: boolean
  profileOpen: boolean
  tenantPickerOpen: boolean
  currentTenantId: string | null
  expandedGroups: string[]
  theme: 'light' | 'dark'
  viewport: 'mobile' | 'desktop'
  features: LayoutFeatures
}

type LayoutEvent =
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'TOGGLE_MOBILE_MENU' }
  | { type: 'CLOSE_MOBILE_MENU' }
  | { type: 'TOGGLE_PROFILE' }
  | { type: 'CLOSE_PROFILE' }
  | { type: 'TOGGLE_TENANT_PICKER' }
  | { type: 'CLOSE_TENANT_PICKER' }
  | { type: 'SELECT_TENANT'; tenantId: string }
  | { type: 'CLOSE_ALL_DROPDOWNS' }
  | { type: 'TOGGLE_NAV_GROUP'; label: string }
  | { type: 'TOGGLE_THEME' }
  | { type: 'SET_VIEWPORT'; viewport: 'mobile' | 'desktop' }

function loadPersistedSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem('sidebarCollapsed') === 'true'
  } catch {
    return false
  }
}

function loadPersistedTenantId(): string | null {
  try {
    return localStorage.getItem('currentTenantId')
  } catch {
    return null
  }
}

function loadPersistedExpandedGroups(): string[] {
  try {
    const stored = localStorage.getItem('expandedGroups')
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function loadPersistedTheme(): 'light' | 'dark' {
  try {
    const stored = localStorage.getItem('theme')
    if (stored === 'light' || stored === 'dark') return stored
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function getInitialViewport(breakpoint = 768): 'mobile' | 'desktop' {
  return typeof window !== 'undefined' && window.innerWidth < breakpoint ? 'mobile' : 'desktop'
}

export const layoutMachine = setup({
  types: {
    context: {} as LayoutContext,
    events: {} as LayoutEvent,
  },
  actions: {
    persistSidebar: assign({
      sidebarCollapsed: ({ context }) => {
        const next = !context.sidebarCollapsed
        try { localStorage.setItem('sidebarCollapsed', String(next)) } catch {}
        return next
      },
    }),
    toggleMobileMenu: assign({
      sidebarOpen: ({ context }) => !context.sidebarOpen,
    }),
    closeMobileMenu: assign({
      sidebarOpen: () => false,
    }),
    toggleProfile: assign({
      profileOpen: ({ context }) => !context.profileOpen,
      tenantPickerOpen: () => false,
    }),
    closeProfile: assign({
      profileOpen: () => false,
    }),
    toggleTenantPicker: assign({
      tenantPickerOpen: ({ context }) => !context.tenantPickerOpen,
      profileOpen: () => false,
    }),
    closeTenantPicker: assign({
      tenantPickerOpen: () => false,
    }),
    selectTenant: assign({
      currentTenantId: ({ event }) => {
        const id = (event as { type: 'SELECT_TENANT'; tenantId: string }).tenantId
        try { localStorage.setItem('currentTenantId', id) } catch {}
        return id
      },
      tenantPickerOpen: () => false,
    }),
    closeAllDropdowns: assign({
      profileOpen: () => false,
      tenantPickerOpen: () => false,
    }),
    toggleNavGroup: assign({
      expandedGroups: ({ context, event }) => {
        const label = (event as { type: 'TOGGLE_NAV_GROUP'; label: string }).label
        const next = context.expandedGroups.includes(label)
          ? context.expandedGroups.filter(g => g !== label)
          : [...context.expandedGroups, label]
        try { localStorage.setItem('expandedGroups', JSON.stringify(next)) } catch {}
        return next
      },
    }),
    toggleTheme: assign({
      theme: ({ context }) => {
        const next = context.theme === 'light' ? 'dark' : 'light'
        try {
          localStorage.setItem('theme', next)
          document.documentElement.classList.toggle('dark', next === 'dark')
        } catch {}
        return next
      },
    }),
    setViewport: assign({
      viewport: ({ event }) => (event as { type: 'SET_VIEWPORT'; viewport: 'mobile' | 'desktop' }).viewport,
    }),
  },
}).createMachine({
  id: 'layout',
  initial: 'active',
  context: {
    sidebarCollapsed: loadPersistedSidebarCollapsed(),
    sidebarOpen: false,
    profileOpen: false,
    tenantPickerOpen: false,
    currentTenantId: loadPersistedTenantId(),
    expandedGroups: loadPersistedExpandedGroups(),
    theme: loadPersistedTheme(),
    viewport: getInitialViewport(),
    features: {},
  },
  states: {
    active: {
      on: {
        TOGGLE_SIDEBAR: { actions: 'persistSidebar' },
        TOGGLE_MOBILE_MENU: { actions: 'toggleMobileMenu' },
        CLOSE_MOBILE_MENU: { actions: 'closeMobileMenu' },
        TOGGLE_PROFILE: { actions: 'toggleProfile' },
        CLOSE_PROFILE: { actions: 'closeProfile' },
        TOGGLE_TENANT_PICKER: { actions: 'toggleTenantPicker' },
        CLOSE_TENANT_PICKER: { actions: 'closeTenantPicker' },
        SELECT_TENANT: { actions: 'selectTenant' },
        CLOSE_ALL_DROPDOWNS: { actions: 'closeAllDropdowns' },
        TOGGLE_NAV_GROUP: { actions: 'toggleNavGroup' },
        TOGGLE_THEME: { actions: 'toggleTheme' },
        SET_VIEWPORT: { actions: 'setViewport' },
      },
    },
  },
})

export function useLayoutMachine(initialTenantId?: string, initialFeatures?: LayoutFeatures) {
  const [state, send] = useMachine(layoutMachine)

  // Set initial tenant from DNA if nothing persisted
  useEffect(() => {
    if (initialTenantId && !state.context.currentTenantId) {
      send({ type: 'SELECT_TENANT', tenantId: initialTenantId })
    }
  }, [initialTenantId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Resize listener for viewport
  useEffect(() => {
    const breakpoint = 768
    const handler = () => {
      const next = window.innerWidth < breakpoint ? 'mobile' : 'desktop'
      send({ type: 'SET_VIEWPORT', viewport: next })
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [send])

  return {
    state,
    send,
    sidebarCollapsed: state.context.sidebarCollapsed,
    sidebarOpen: state.context.sidebarOpen,
    profileOpen: state.context.profileOpen,
    tenantPickerOpen: state.context.tenantPickerOpen,
    currentTenantId: state.context.currentTenantId,
    expandedGroups: state.context.expandedGroups,
    theme: state.context.theme,
    viewport: state.context.viewport,
    features: initialFeatures ?? state.context.features,
  }
}
`
}

export function rendererUniversalLayout(primitivesPath: string): string {
  return `import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import type { Route, Layout } from './types'
import { useDna } from './context'
import { useLayoutMachine } from './layout-machine'
import { cn } from '${primitivesPath}/utils'
import { Button } from '${primitivesPath}/button'
import { Avatar, AvatarFallback } from '${primitivesPath}/avatar'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '${primitivesPath}/dropdown-menu'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '${primitivesPath}/collapsible'
import { Sheet, SheetTrigger, SheetContent } from '${primitivesPath}/sheet'
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '${primitivesPath}/tooltip'

// ── Icons ─────────────────────────────────────────────────────────────────────

const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
  </svg>
)

const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
)

const ChevronIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m9 18 6-6-6-6"/>
  </svg>
)

const HamburgerIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" x2="20" y1="12" y2="12"/>
    <line x1="4" x2="20" y1="6" y2="6"/>
    <line x1="4" x2="20" y1="18" y2="18"/>
  </svg>
)

// ── Shared nav content (used in both desktop sidebar and mobile sheet) ────────

function NavContent({
  navigation,
  routes,
  expandedGroups,
  sidebarCollapsed,
  send,
  onNavigate,
}: {
  navigation: Layout['navigation']
  routes: Route[]
  expandedGroups: string[]
  sidebarCollapsed: boolean
  send: (event: any) => void
  onNavigate?: () => void
}) {
  if (navigation && !sidebarCollapsed) {
    return (
      <ul className="list-none p-0 m-0 flex flex-col gap-0.5">
        {navigation.map(group => group.route ? (
          <li key={group.label}>
            <NavLink
              to={group.route}
              end
              onClick={onNavigate}
              className={({ isActive }) => cn(
                'block px-3 py-2 text-sm rounded-md transition-colors no-underline',
                isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
              )}
            >
              {group.label}
            </NavLink>
          </li>
        ) : (
          <li key={group.label}>
            <Collapsible
              open={expandedGroups.includes(group.label)}
              onOpenChange={() => send({ type: 'TOGGLE_NAV_GROUP', label: group.label })}
            >
              <CollapsibleTrigger className="flex items-center w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground rounded-md hover:text-foreground transition-colors">
                <span className="flex-1 text-left">{group.label}</span>
                <ChevronIcon className={cn('transition-transform duration-150', expandedGroups.includes(group.label) && 'rotate-90')} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul className="space-y-0.5">
                  {group.children?.map(child => (
                    <li key={child.route}>
                      <NavLink
                        to={child.route}
                        end
                        onClick={onNavigate}
                        className={({ isActive }) => cn(
                          'block pl-6 pr-3 py-1.5 text-sm rounded-md transition-colors no-underline',
                          isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                        )}
                      >
                        {child.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          </li>
        ))}
      </ul>
    )
  }

  if (navigation && sidebarCollapsed) {
    return (
      <TooltipProvider delayDuration={0}>
        <ul className="list-none p-0 m-0 flex flex-col gap-0.5">
          {navigation.map(group => (
            <li key={group.label}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-center p-2 rounded-md text-sidebar-foreground/60 cursor-default">
                    <span className="text-xs font-bold uppercase">{group.label.charAt(0)}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">{group.label}</TooltipContent>
              </Tooltip>
            </li>
          ))}
        </ul>
      </TooltipProvider>
    )
  }

  if (!navigation) {
    return (
      <ul className="list-none p-0 m-0 flex flex-col gap-0.5">
        {routes.map(route => (
          <li key={route.path}>
            <NavLink
              to={route.path}
              onClick={onNavigate}
              className={({ isActive }) => cn(
                'block px-3 py-2 text-sm rounded-md transition-colors no-underline',
                isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
              )}
            >
              {route.page.replace(/([A-Z])/g, (c: string, _m: string, offset: number) => (offset === 0 ? '' : ' ') + c)}
            </NavLink>
          </li>
        ))}
      </ul>
    )
  }

  return null
}

// ── Profile dropdown ──────────────────────────────────────────────────────────

function ProfileDropdown({
  showTenantPicker,
  currentTenant,
}: {
  showTenantPicker: boolean
  currentTenant?: { id: string; name: string }
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full h-7 w-7">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-xs">U</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-48">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          {showTenantPicker && currentTenant ? currentTenant.name : 'User'}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => console.log('Settings')}>Settings</DropdownMenuItem>
        <DropdownMenuItem className="text-destructive" onClick={() => console.log('Sign out')}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Tenant picker dropdown ────────────────────────────────────────────────────

function TenantPicker({
  tenants,
  currentTenantId,
  currentTenant,
  send,
}: {
  tenants: { id: string; name: string }[]
  currentTenantId: string | null
  currentTenant?: { id: string; name: string }
  send: (event: any) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex-1 text-left text-xs truncate px-1 py-0.5 rounded hover:bg-sidebar-accent/50 transition-colors">
          {currentTenant?.name ?? 'Select tenant'}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-48">
        {tenants.map(tn => (
          <DropdownMenuItem
            key={tn.id}
            onClick={() => send({ type: 'SELECT_TENANT', tenantId: tn.id })}
            className={cn(tn.id === currentTenantId && 'bg-accent font-medium')}
          >
            {tn.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Mobile layout ─────────────────────────────────────────────────────────────

function MobileLayout({
  routes, navigation, expandedGroups, send,
  sidebarOpen, showProfile, showTenantPicker, showThemeToggle,
  tenants, currentTenantId, currentTenant, appName, theme,
}: {
  routes: Route[]
  navigation: Layout['navigation']
  expandedGroups: string[]
  send: (event: any) => void
  sidebarOpen: boolean
  showProfile: boolean
  showTenantPicker: boolean
  showThemeToggle: boolean
  tenants: { id: string; name: string }[]
  currentTenantId: string | null
  currentTenant?: { id: string; name: string }
  appName: string
  theme: 'light' | 'dark'
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Mobile header */}
      <header className="flex items-center justify-between px-4 h-14 border-b border-border bg-sidebar-background sticky top-0 z-30">
        <Sheet open={sidebarOpen} onOpenChange={(open: boolean) => send(open ? { type: 'TOGGLE_MOBILE_MENU' } : { type: 'CLOSE_MOBILE_MENU' })}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Toggle menu">
              <HamburgerIcon />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <nav className="flex-1 overflow-y-auto p-3 pt-10">
              <NavContent
                navigation={navigation}
                routes={routes}
                expandedGroups={expandedGroups}
                sidebarCollapsed={false}
                send={send}
                onNavigate={() => send({ type: 'CLOSE_MOBILE_MENU' })}
              />
            </nav>
            <div className="border-t border-sidebar-border p-2 space-y-1">
              <div className="flex items-center gap-1.5">
                {showProfile && (
                  <ProfileDropdown showTenantPicker={showTenantPicker} currentTenant={currentTenant} />
                )}
                {showTenantPicker && (
                  <TenantPicker tenants={tenants} currentTenantId={currentTenantId} currentTenant={currentTenant} send={send} />
                )}
              </div>
              <div className="flex items-center gap-1 justify-end">
                {showThemeToggle && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => send({ type: 'TOGGLE_THEME' })} title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
                    {theme === 'light' ? <MoonIcon /> : <SunIcon />}
                  </Button>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
        <span className="font-bold text-base">{appName}</span>
        {showProfile ? (
          <ProfileDropdown showTenantPicker={showTenantPicker} currentTenant={currentTenant} />
        ) : <div className="w-8" />}
      </header>

      <main className="p-4 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

// ── Desktop layout ────────────────────────────────────────────────────────────

function DesktopLayout({
  routes, navigation, expandedGroups, send,
  sidebarCollapsed, showSidebar, showProfile, showTenantPicker, showThemeToggle,
  tenants, currentTenantId, currentTenant, appName, theme,
}: {
  routes: Route[]
  navigation: Layout['navigation']
  expandedGroups: string[]
  send: (event: any) => void
  sidebarCollapsed: boolean
  showSidebar: boolean
  showProfile: boolean
  showTenantPicker: boolean
  showThemeToggle: boolean
  tenants: { id: string; name: string }[]
  currentTenantId: string | null
  currentTenant?: { id: string; name: string }
  appName: string
  theme: 'light' | 'dark'
}) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {showSidebar && (
        <aside className={cn(
          'flex-shrink-0 transition-[width] duration-200 ease-in-out border-r border-sidebar-border bg-sidebar-background flex flex-col sticky top-0 h-screen',
          sidebarCollapsed ? 'w-16' : 'w-60',
          'overflow-x-visible overflow-y-hidden'
        )}>
          {/* App name */}
          <div className={cn('border-b border-sidebar-border font-bold text-sm truncate', sidebarCollapsed ? 'text-center py-4 px-0' : 'p-4')}>
            {sidebarCollapsed ? appName.charAt(0).toUpperCase() : appName}
          </div>

          {/* Nav links */}
          <nav className={cn('flex-1 overflow-y-auto', sidebarCollapsed ? 'p-1' : 'p-2')}>
            <NavContent
              navigation={navigation}
              routes={routes}
              expandedGroups={expandedGroups}
              sidebarCollapsed={sidebarCollapsed}
              send={send}
            />
          </nav>

          {/* Bottom section */}
          <div className="border-t border-sidebar-border p-2 space-y-1">
            {/* Profile + tenant row */}
            {(showProfile || showTenantPicker) && (
              <div className="flex items-center gap-1.5">
                {showProfile && (
                  <ProfileDropdown showTenantPicker={showTenantPicker} currentTenant={currentTenant} />
                )}
                {!sidebarCollapsed && showTenantPicker && (
                  <TenantPicker tenants={tenants} currentTenantId={currentTenantId} currentTenant={currentTenant} send={send} />
                )}
              </div>
            )}
            {/* Theme + collapse row */}
            <div className={cn('flex items-center gap-1', sidebarCollapsed ? 'justify-center' : 'justify-end')}>
              {showThemeToggle && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => send({ type: 'TOGGLE_THEME' })} title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
                  {theme === 'light' ? <MoonIcon /> : <SunIcon />}
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => send({ type: 'TOGGLE_SIDEBAR' })} title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
                <ChevronIcon className={cn('transition-transform', sidebarCollapsed ? '' : 'rotate-180')} />
              </Button>
            </div>
          </div>
        </aside>
      )}

      {/* Main content */}
      <main className="flex-1 p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function UniversalLayout({ routes }: { routes: Route[] }) {
  const { dna } = useDna()
  const layout = dna.layout as Layout
  const features = layout.features ?? {}
  const tenants = layout.tenants ?? []
  const navigation = layout.navigation
  const initialTenantId = tenants.length > 0 ? tenants[0].id : undefined

  const {
    send,
    sidebarCollapsed,
    sidebarOpen,
    currentTenantId,
    expandedGroups,
    theme,
    viewport,
  } = useLayoutMachine(initialTenantId, features)

  const location = useLocation()
  const currentTenant = tenants.find(tn => tn.id === currentTenantId)
  const appName = dna.layout.name
  const isMobile = viewport === 'mobile'
  const showSidebar = features.sidebar !== false
  const showProfile = features.profileDropdown !== false
  const showTenantPicker = features.tenantPicker !== false && tenants.length > 0
  const showThemeToggle = features.themeToggle !== false

  // Auto-expand nav groups containing the active route
  useEffect(() => {
    if (!navigation) return
    for (const group of navigation) {
      if (group.children?.some(child => location.pathname === child.route || location.pathname.startsWith(child.route + '/'))) {
        if (!expandedGroups.includes(group.label)) {
          send({ type: 'TOGGLE_NAV_GROUP', label: group.label })
        }
      }
    }
  }, [location.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  const shared = {
    routes, navigation, expandedGroups, send,
    showProfile, showTenantPicker, showThemeToggle,
    tenants, currentTenantId, currentTenant, appName, theme,
  }

  if (isMobile) {
    return <MobileLayout {...shared} sidebarOpen={sidebarOpen} />
  }

  return <DesktopLayout {...shared} sidebarCollapsed={sidebarCollapsed} showSidebar={showSidebar} />
}
`
}
