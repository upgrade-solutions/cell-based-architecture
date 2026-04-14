// ── Fixed renderer component templates ───────────────────────────────────────
// These are emitted once per generated app. They contain no DNA-derived values —
// all DNA is fetched at runtime from the source dna/ directory.
// Vue 3 Composition API + SFC equivalents of the React renderer.

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

// ── Operational DNA (subset: rules only — enough for render/click guards) ────

export interface AllowEntry {
  role?: string
  ownership?: boolean
  flags?: string[]
}

export interface Rule {
  capability: string
  type?: 'access' | 'condition'
  description?: string
  allow?: AllowEntry[]
  conditions?: unknown[]
}

export interface OperationalDNA {
  rules?: Rule[]
}

export interface CurrentUser {
  email: string | null
  roles: string[]
}
`
}

export function rendererDnaContext(): string {
  return `import { inject, provide, computed, type Ref, type InjectionKey } from 'vue'
import type { ProductUiDNA, ProductApiDNA, OperationalDNA, CurrentUser } from './types'

export type Theme = 'light' | 'dark'

export interface DnaContextValue {
  dna: ProductUiDNA
  api: ProductApiDNA | null
  operational: OperationalDNA | null
  user: CurrentUser
  apiBase: string
  stubs: Record<string, Record<string, unknown>[]>
  theme: Ref<Theme>
  toggleTheme: () => void
}

export const DnaKey: InjectionKey<DnaContextValue> = Symbol('DnaContext')

export function provideDna(value: DnaContextValue) {
  provide(DnaKey, value)
}

export function useDna(): DnaContextValue {
  const ctx = inject(DnaKey)
  if (!ctx) throw new Error('useDna must be used within a component that calls provideDna')
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
  return computed(() => tokens[theme.value])
}
`
}

export function rendererDnaLoader(): string {
  return `import type { ProductUiDNA, ProductApiDNA, OperationalDNA } from './types'

// ── DnaLoader interface — the seam for future API/SSE loaders ────────────────

export interface DnaLoader {
  loadUi(): Promise<ProductUiDNA>
  loadApi(): Promise<ProductApiDNA | null>
  loadCore(): Promise<unknown | null>
  loadOperational(): Promise<OperationalDNA | null>
}

// ── StaticFetchLoader — loads DNA from static URLs (current implementation) ──

export class StaticFetchLoader implements DnaLoader {
  constructor(
    private uiUrl: string,
    private apiUrl: string | null,
    private coreUrl: string | null,
    private operationalUrl: string | null = null,
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

  // Operational DNA failures are non-fatal — a missing / broken file leaves
  // rules unknown, which the render-time guards treat as fail-closed.
  async loadOperational(): Promise<OperationalDNA | null> {
    if (!this.operationalUrl) return null
    try {
      const res = await fetch(this.operationalUrl)
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  }
}
`
}

export function rendererUseApi(): string {
  return `import { ref } from 'vue'
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

  async function fetchList(queryParams?: Record<string, string>) {
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
  }

  async function fetchOne(pathParams: Record<string, string>) {
    if (!endpoint) return null
    const resolved = resolvePath(endpoint.path, pathParams)
    const res = await fetch(apiBase + resolved)
    if (!res.ok) throw new Error(\`\${res.status} \${res.statusText}\`)
    return res.json()
  }

  async function submit(body: Record<string, unknown>, pathParams?: Record<string, string>) {
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
  }

  return { endpoint, fetchList, fetchOne, submit }
}

export function useApiFetch(
  operation: string | undefined,
  params?: Record<string, string>,
  pathParams?: Record<string, string>,
) {
  const { endpoint, fetchList, fetchOne } = useApi(operation)
  const data = ref<unknown>(null)
  const loading = ref(!!endpoint)
  const error = ref<string | null>(null)

  function doFetch() {
    if (!endpoint) return
    loading.value = true
    error.value = null
    const isDetail = endpoint.params?.some(p => p.in === 'path' && p.name === 'id')
    const promise = isDetail && pathParams
      ? fetchOne(pathParams)
      : fetchList(params)
    promise
      .then(result => { data.value = result })
      .catch(err => { error.value = String(err) })
      .finally(() => { loading.value = false })
  }

  // Initial fetch
  doFetch()

  return { data, loading, error, refetch: doFetch }
}
`
}

export function rendererApp(): string {
  return `<template>
  <div v-if="error" :style="{ padding: '2rem', color: '#dc2626', fontFamily: 'system-ui', background: bg, minHeight: '100vh' }">
    Failed to load DNA: {{ error }}
  </div>
  <div v-else-if="!dna" :style="{ padding: '2rem', color: '#6b7280', fontFamily: 'system-ui', background: bg, minHeight: '100vh' }">
    Loading...
  </div>
  <router-view v-else />
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import type { ProductUiDNA, ProductApiDNA, OperationalDNA, CurrentUser } from './types'
import { provideDna, type Theme } from './context'
import { provideFlags, startFlagFetch } from './flags-context'
import { StaticFetchLoader } from './dna-loader'
import LayoutShell from './LayoutShell.vue'
import PageView from './PageView.vue'

interface Config {
  ui: string
  api?: string | null
  core?: string | null
  operational?: string | null
  apiBase?: string
}

// Decode a JWT payload without verification — used to surface the current
// user's roles for render-time guards. The API is the authoritative gate.
function decodeJwt(token: string | null): CurrentUser {
  const empty: CurrentUser = { email: null, roles: [] }
  if (!token) return empty
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return empty
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const payload = JSON.parse(atob(padded))
    return {
      email: typeof payload.email === 'string' ? payload.email : null,
      roles: Array.isArray(payload.roles) ? payload.roles : [],
    }
  } catch {
    return empty
  }
}

function collectStubs(core: unknown): Record<string, Record<string, unknown>[]> {
  const stubs: Record<string, Record<string, unknown>[]> = {}
  const typed = core as { nouns?: { name: string; examples?: Record<string, unknown>[] }[] } | null
  for (const noun of typed?.nouns ?? []) {
    if (noun.examples?.length) stubs[noun.name] = noun.examples
  }
  return stubs
}

function getInitialTheme(): Theme {
  const stored = localStorage.getItem('theme')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const router = useRouter()
const dna = ref<ProductUiDNA | null>(null)
const api = ref<ProductApiDNA | null>(null)
const operational = ref<OperationalDNA | null>(null)
const apiBase = ref('')
const stubs = ref<Record<string, Record<string, unknown>[]>>({})
const error = ref<string | null>(null)
const theme = ref<Theme>(getInitialTheme())
const user = ref<CurrentUser>(decodeJwt(typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null))

// Install the flag injection seam so descendant blocks can read flags.
// The actual fetch kicks off inside onMounted once we know the apiBase.
provideFlags()

const bg = computed(() => theme.value === 'dark' ? '#111827' : '#ffffff')

function toggleTheme() {
  theme.value = theme.value === 'light' ? 'dark' : 'light'
  localStorage.setItem('theme', theme.value)
}

// Provide DNA context to all descendants
provideDna({
  get dna() { return dna.value! },
  get api() { return api.value },
  get operational() { return operational.value },
  get user() { return user.value },
  get apiBase() { return apiBase.value },
  get stubs() { return stubs.value },
  theme,
  toggleTheme,
})

onMounted(async () => {
  try {
    const res = await fetch('/config.json')
    const config: Config = await res.json()
    apiBase.value = config.apiBase ?? ''
    const loader = new StaticFetchLoader(
      config.ui,
      config.api ?? null,
      config.core ?? null,
      config.operational ?? null,
    )
    const [uiDna, apiDna, coreDna, operationalDna] = await Promise.all([
      loader.loadUi(),
      loader.loadApi(),
      loader.loadCore(),
      loader.loadOperational(),
    ])
    dna.value = uiDna
    api.value = apiDna
    operational.value = operationalDna
    stubs.value = collectStubs(coreDna)

    // Kick off the flag fetch once we know apiBase. Fail-closed on any error.
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null
    startFlagFetch(apiBase.value, token)

    // Dynamically add routes from DNA
    router.addRoute({
      path: '/',
      component: LayoutShell,
      children: [
        { path: '', redirect: uiDna.routes[0]?.path ?? '/' },
        ...uiDna.routes.map(route => {
          const page = uiDna.pages.find(p => p.name === route.page)
          return {
            path: route.path.replace(/^\\//, ''),
            name: route.page,
            component: PageView,
            props: { page },
          }
        }),
      ],
    })

    // Navigate to the current URL to pick up new routes
    router.replace(router.currentRoute.value.fullPath)
  } catch (err) {
    error.value = String(err)
  }
})
</script>
`
}

export function rendererAppSetup(): string {
  return `import { createApp } from 'vue'
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import App from './App.vue'
import type { ProductUiDNA } from './types'
import LayoutShell from './LayoutShell.vue'
import PageView from './PageView.vue'

// We build routes after DNA loads — this bootstraps an empty router,
// then App.vue populates it after DNA fetch.
export function createAppRouter(dna: ProductUiDNA) {
  const children: RouteRecordRaw[] = dna.routes.map(route => {
    const page = dna.pages.find(p => p.name === route.page)
    return {
      path: route.path,
      name: route.page,
      component: PageView,
      props: { page },
    }
  })

  // Default redirect to first route
  if (children.length > 0) {
    children.unshift({
      path: '/',
      redirect: dna.routes[0].path,
    })
  }

  return createRouter({
    history: createWebHistory(),
    routes: [
      {
        path: '/',
        component: LayoutShell,
        children,
      },
    ],
  })
}
`
}

export function rendererLayoutShell(): string {
  return `<template>
  <SidebarLayout v-if="dna.layout.type === 'sidebar'" :routes="dna.routes" />
  <FullWidthLayout v-else :routes="dna.routes" />
</template>

<script setup lang="ts">
import { useDna } from './context'
import SidebarLayout from './layouts/SidebarLayout.vue'
import FullWidthLayout from './layouts/FullWidthLayout.vue'

const { dna } = useDna()
</script>
`
}

export function rendererSidebarLayout(): string {
  return `<template>
  <div :style="{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', background: t.bg, color: t.text }">
    <!-- Mobile header -->
    <header v-if="isMobile" :style="{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0.75rem 1rem', borderBottom: '1px solid ' + t.border, background: t.bgAlt,
      position: 'sticky', top: 0, zIndex: 20,
    }">
      <span :style="{ fontWeight: 600, fontSize: '1rem' }">Menu</span>
      <div :style="{ display: 'flex', gap: '0.5rem' }">
        <ThemeToggle />
        <button
          @click="menuOpen = !menuOpen"
          :style="{ background: 'none', border: '1px solid ' + t.borderStrong, borderRadius: '0.375rem', padding: '0.375rem 0.625rem', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1, color: t.text }"
          aria-label="Toggle navigation"
        >
          {{ menuOpen ? '\\u2715' : '\\u2630' }}
        </button>
      </div>
    </header>

    <!-- Sidebar / mobile dropdown -->
    <nav v-if="!isMobile || menuOpen" :style="{
      width: isMobile ? '100%' : '240px',
      borderRight: isMobile ? 'none' : '1px solid ' + t.border,
      borderBottom: isMobile ? '1px solid ' + t.border : 'none',
      padding: isMobile ? '0.5rem 1rem' : '1.5rem 1rem',
      background: t.bgAlt,
      flexShrink: 0,
      ...(!isMobile ? { position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' } : {}),
    }">
      <div v-if="!isMobile" :style="{ marginBottom: '1rem', display: 'flex', justifyContent: 'flex-end' }">
        <ThemeToggle />
      </div>
      <ul :style="{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' }">
        <li v-for="route in routes" :key="route.path">
          <router-link
            :to="route.path"
            @click="menuOpen = false"
            :style="linkStyle"
            active-class="active-link"
            v-slot="{ isActive }"
          >
            <span :style="{
              display: 'block', padding: '0.5rem 0.75rem', borderRadius: '0.375rem',
              textDecoration: 'none', fontSize: '0.875rem',
              color: isActive ? t.primary : t.text,
              background: isActive ? t.primaryBg : 'transparent',
              fontWeight: isActive ? 600 : 400,
            }">{{ toLabel(route.page) }}</span>
          </router-link>
        </li>
      </ul>
    </nav>

    <main :style="{ flex: 1, padding: isMobile ? '1rem' : '2rem', overflow: 'auto' }">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { Route } from '../types'
import { useThemeTokens } from '../context'
import ThemeToggle from '../ThemeToggle.vue'

defineProps<{ routes: Route[] }>()

const t = useThemeTokens()
const menuOpen = ref(false)
const isMobile = ref(window.innerWidth < 768)

function handleResize() { isMobile.value = window.innerWidth < 768 }
onMounted(() => window.addEventListener('resize', handleResize))
onUnmounted(() => window.removeEventListener('resize', handleResize))

const linkStyle = { textDecoration: 'none' }

function toLabel(pageName: string): string {
  return pageName.replace(/([A-Z])/g, (c, _match, offset: number) =>
    (offset === 0 ? '' : ' ') + c
  )
}
</script>
`
}

export function rendererFullWidthLayout(): string {
  return `<template>
  <div :style="{ minHeight: '100vh', fontFamily: 'system-ui, sans-serif', background: t.bg, color: t.text }">
    <header :style="{ borderBottom: '1px solid ' + t.border, background: t.bgAlt, padding: isMobile ? '0 1rem' : '0 2rem' }">
      <nav :style="{ display: 'flex', gap: '0.25rem', height: '56px', alignItems: 'center', overflowX: 'auto' }">
        <router-link
          v-for="route in routes"
          :key="route.path"
          :to="route.path"
          v-slot="{ isActive }"
          :style="{ textDecoration: 'none' }"
        >
          <span :style="{
            display: 'block', padding: '0.5rem 0.75rem', borderRadius: '0.375rem',
            fontSize: '0.875rem',
            color: isActive ? t.primary : t.text,
            background: isActive ? t.primaryBg : 'transparent',
            fontWeight: isActive ? 600 : 400,
          }">{{ toLabel(route.page) }}</span>
        </router-link>
        <div :style="{ marginLeft: 'auto' }"><ThemeToggle /></div>
      </nav>
    </header>
    <main :style="{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '1rem' : '2rem' }">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { Route } from '../types'
import { useThemeTokens } from '../context'
import ThemeToggle from '../ThemeToggle.vue'

defineProps<{ routes: Route[] }>()

const t = useThemeTokens()
const isMobile = ref(window.innerWidth < 768)

function handleResize() { isMobile.value = window.innerWidth < 768 }
onMounted(() => window.addEventListener('resize', handleResize))
onUnmounted(() => window.removeEventListener('resize', handleResize))

function toLabel(pageName: string): string {
  return pageName.replace(/([A-Z])/g, (c, _match, offset: number) =>
    (offset === 0 ? '' : ' ') + c
  )
}
</script>
`
}

export function rendererThemeToggle(): string {
  return `<template>
  <button
    @click="toggleTheme"
    aria-label="Toggle theme"
    :style="{
      background: 'none', border: '1px solid ' + t.borderStrong, borderRadius: '0.375rem',
      padding: '0.375rem 0.625rem', cursor: 'pointer', fontSize: '1rem', lineHeight: 1,
      color: t.text,
    }"
  >
    {{ theme === 'light' ? '\\u263E' : '\\u2600' }}
  </button>
</template>

<script setup lang="ts">
import { useDna, useThemeTokens } from './context'

const { theme, toggleTheme } = useDna()
const t = useThemeTokens()
</script>
`
}

export function rendererPageView(): string {
  return `<template>
  <div :style="{ maxWidth: '100%', overflowX: 'hidden' }">
    <h1 :style="{ marginBottom: '0.25rem', fontSize: 'clamp(1.125rem, 4vw, 1.5rem)', fontWeight: 700, color: t.text }">
      {{ toTitle(page.name) }}
    </h1>
    <p v-if="page.description" :style="{ marginTop: 0, marginBottom: '1.5rem', color: t.textSecondary, fontSize: '0.875rem' }">
      {{ page.description }}
    </p>
    <BlockRenderer
      v-for="block in page.blocks"
      :key="block.name"
      :block="block"
      :resource="page.resource"
    />
  </div>
</template>

<script setup lang="ts">
import type { Page } from './types'
import { useThemeTokens } from './context'
import BlockRenderer from './BlockRenderer.vue'

defineProps<{ page: Page }>()

const t = useThemeTokens()

function toTitle(name: string): string {
  return name.replace(/([A-Z])/g, (c, _match, offset: number) =>
    (offset === 0 ? '' : ' ') + c
  )
}
</script>
`
}

export function rendererBlockRenderer(): string {
  return `<template>
  <section :style="{ marginBottom: '1.5rem' }">
    <div v-if="showHeader" :style="{ marginBottom: '0.75rem' }">
      <h2 :style="{ margin: 0, fontSize: '1rem', fontWeight: 600, color: t.text }">
        {{ toLabel(block.name) }}
      </h2>
      <p v-if="block.description" :style="{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: t.textMuted }">
        {{ block.description }}
      </p>
    </div>
    <FormBlock v-if="block.type === 'form'" :block="block" />
    <TableBlock v-else-if="block.type === 'table'" :block="block" :resource="resource" />
    <DetailBlock v-else-if="block.type === 'detail'" :block="block" :resource="resource" />
    <ActionsBlock v-else-if="block.type === 'actions'" :block="block" :resource="resource" />
    <EmptyStateBlock v-else-if="block.type === 'empty-state'" :block="block" />
    <div v-else :style="{ color: '#9ca3af', fontSize: '0.875rem', marginBottom: '1rem' }">
      Unknown block type: {{ block.type }}
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Block } from './types'
import { useThemeTokens } from './context'
import FormBlock from './blocks/FormBlock.vue'
import TableBlock from './blocks/TableBlock.vue'
import DetailBlock from './blocks/DetailBlock.vue'
import ActionsBlock from './blocks/ActionsBlock.vue'
import EmptyStateBlock from './blocks/EmptyStateBlock.vue'

const props = defineProps<{ block: Block; resource: string }>()

const t = useThemeTokens()
const showHeader = computed(() => props.block.type !== 'actions' && props.block.type !== 'empty-state')

function toLabel(name: string): string {
  return name.replace(/([A-Z])/g, (c, _match, offset: number) =>
    (offset === 0 ? '' : ' ') + c
  )
}
</script>
`
}

export function rendererFormBlock(): string {
  return `<template>
  <form @submit.prevent="handleSubmit" :style="{ marginBottom: '1.5rem' }">
    <div v-if="error" :style="{ padding: '0.75rem 1rem', color: t.danger, background: t.dangerBg, borderRadius: '0.375rem', marginBottom: '1rem', fontSize: '0.875rem' }">
      {{ error }}
    </div>
    <div v-if="success" :style="{ padding: '0.75rem 1rem', color: t.success, background: t.successBg, borderRadius: '0.375rem', marginBottom: '1rem', fontSize: '0.875rem' }">
      Success!
    </div>
    <div v-for="field in fields" :key="field.name" :style="{ marginBottom: '1rem' }">
      <label :style="{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500, color: t.text }">
        {{ field.label }}{{ field.required ? ' *' : '' }}
      </label>
      <select
        v-if="field.type === 'enum' && field.values"
        v-model="state[field.name]"
        :style="{ width: '100%', padding: '0.5rem', border: '1px solid ' + t.borderStrong, borderRadius: '0.375rem', background: t.inputBg, color: t.text }"
      >
        <option value="">All</option>
        <option v-for="v in field.values" :key="v" :value="v">{{ v }}</option>
      </select>
      <input
        v-else
        :type="fieldTypeToHtml(field.type)"
        v-model="state[field.name]"
        :required="field.required"
        :disabled="submitting"
        :style="{ width: '100%', padding: '0.5rem', border: '1px solid ' + t.borderStrong, borderRadius: '0.375rem', boxSizing: 'border-box', background: t.inputBg, color: t.text }"
      />
    </div>
    <button
      v-if="!isFilterForm"
      type="submit"
      :disabled="submitting"
      :style="{
        padding: '0.5rem 1rem',
        background: submitting ? t.textMuted : t.primary,
        color: '#fff',
        border: 'none',
        borderRadius: '0.375rem',
        cursor: submitting ? 'not-allowed' : 'pointer',
      }"
    >
      {{ submitting ? actionLabel + 'ing...' : actionLabel }}
    </button>
  </form>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useThemeTokens } from '../context'
import { useApi } from '../useApi'
import type { Block } from '../types'

const props = defineProps<{ block: Block }>()
const t = useThemeTokens()
const route = useRoute()
const router = useRouter()

const fields = computed(() => props.block.fields ?? [])
const { endpoint, submit } = useApi(props.block.operation)
const state = reactive<Record<string, string>>(
  Object.fromEntries(fields.value.map(f => [f.name, '']))
)
const submitting = ref(false)
const error = ref<string | null>(null)
const success = ref(false)

const isFilterForm = computed(() => endpoint?.method === 'GET')
const actionLabel = computed(() => props.block.operation?.split('.').pop() ?? 'Submit')

function fieldTypeToHtml(type: string): string {
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

async function handleSubmit() {
  if (!endpoint || isFilterForm.value) return
  submitting.value = true
  error.value = null
  success.value = false
  try {
    const body: Record<string, unknown> = {}
    for (const f of fields.value) {
      const val = coerceValue(state[f.name], f.type)
      if (val !== undefined) body[f.name] = val
    }
    const pathParams = route.params.id ? { id: String(route.params.id) } : undefined
    await submit(body, pathParams)
    success.value = true
    for (const f of fields.value) state[f.name] = ''
    setTimeout(() => router.back(), 800)
  } catch (err) {
    error.value = String(err)
  } finally {
    submitting.value = false
  }
}
</script>
`
}

export function rendererTableBlock(): string {
  return `<template>
  <div v-if="loading" :style="{ padding: '2rem', textAlign: 'center', color: t.textSecondary, marginBottom: '1.5rem' }">
    Loading...
  </div>
  <div v-else-if="error" :style="{ padding: '1rem', color: t.danger, background: t.dangerBg, borderRadius: '0.375rem', marginBottom: '1.5rem', fontSize: '0.875rem' }">
    Failed to load data: {{ error }}
  </div>
  <div v-else :style="{ overflowX: 'auto', marginBottom: '1.5rem' }">
    <table :style="{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }">
      <thead>
        <tr>
          <th
            v-for="f in fields"
            :key="f.name"
            :style="{ padding: '0.75rem 1rem', textAlign: 'left', borderBottom: '2px solid ' + t.border, fontWeight: 600, whiteSpace: 'nowrap', color: t.text }"
          >
            {{ f.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-if="rows.length > 0"
          v-for="(row, i) in rows"
          :key="i"
          @click="rowLink ? router.push(resolveRowLink(rowLink, row)) : undefined"
          :style="{
            background: i % 2 === 0 ? 'transparent' : t.rowStripe,
            cursor: rowLink ? 'pointer' : 'default',
          }"
        >
          <td
            v-for="f in fields"
            :key="f.name"
            :style="{ padding: '0.75rem 1rem', borderBottom: '1px solid ' + t.border, color: t.text }"
          >
            {{ String(row[f.name] ?? '—') }}
          </td>
        </tr>
        <tr v-else>
          <td :colspan="fields.length" :style="{ padding: '2rem', textAlign: 'center', color: t.textMuted }">
            No data
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useDna, useThemeTokens } from '../context'
import { useApiFetch } from '../useApi'
import type { Block } from '../types'

const props = defineProps<{ block: Block; resource: string }>()
const { dna, stubs } = useDna()
const t = useThemeTokens()
const router = useRouter()

const fields = computed(() => props.block.fields ?? [])
const { data, loading, error } = useApiFetch(props.block.operation)

const rows = computed(() => {
  if (data.value) {
    const d = data.value as any
    return Array.isArray(d) ? d : d.data ?? []
  }
  return stubs[props.resource] ?? []
})

const rowLink = computed(() => {
  return props.block.rowLink
    ?? dna.routes.find(r => r.path.includes(':id') && dna.pages.find(p => p.name === r.page && p.resource === props.resource))?.path
    ?? null
})

function resolveRowLink(template: string, row: Record<string, unknown>): string {
  return template.replace(/:([a-zA-Z_]+)/g, (_, key) => String(row[key] ?? ''))
}
</script>
`
}

export function rendererDetailBlock(): string {
  return `<template>
  <div v-if="loading" :style="{ padding: '2rem', textAlign: 'center', color: t.textSecondary, marginBottom: '1.5rem' }">
    Loading...
  </div>
  <div v-else-if="error" :style="{ padding: '1rem', color: t.danger, background: t.dangerBg, borderRadius: '0.375rem', marginBottom: '1.5rem', fontSize: '0.875rem' }">
    Failed to load record: {{ error }}
  </div>
  <dl v-else :style="{
    display: 'grid', gridTemplateColumns: 'minmax(0, 200px) 1fr',
    gap: '0.5rem 1rem', marginBottom: '1.5rem', padding: '1rem',
    border: '1px solid ' + t.border, borderRadius: '0.5rem', background: t.bgAlt,
  }">
    <template v-for="f in fields" :key="f.name">
      <dt :style="{ fontWeight: 500, color: t.textSecondary, fontSize: '0.875rem', wordBreak: 'break-word' }">{{ f.label }}</dt>
      <dd :style="{ margin: 0, wordBreak: 'break-word', color: t.text }">{{ String(record[f.name] ?? '—') }}</dd>
    </template>
  </dl>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useDna, useThemeTokens } from '../context'
import { useApiFetch } from '../useApi'
import type { Block } from '../types'

const props = defineProps<{ block: Block; resource: string }>()
const { stubs } = useDna()
const t = useThemeTokens()
const route = useRoute()

const fields = computed(() => props.block.fields ?? [])
const pathParams = computed(() => route.params.id ? { id: String(route.params.id) } : undefined)
const { data, loading, error } = useApiFetch(props.block.operation, undefined, pathParams.value)

const record = computed(() => {
  return (data.value as Record<string, unknown>) ?? (stubs[props.resource] ?? [])[0] ?? {}
})
</script>
`
}

export function rendererActionsBlock(): string {
  return `<template>
  <div v-if="actions.length > 0" :style="{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }">
    <ActionButton
      v-for="action in actions"
      :key="action.name"
      :resource="resource"
      :action-name="action.name"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useDna } from '../context'
import type { Block } from '../types'
import ActionButton from './ActionButton.vue'

const props = defineProps<{ block: Block; resource: string }>()
const { api } = useDna()

const actions = computed(() => {
  const apiResource = api?.resources.find(r => r.name === props.resource)
  return apiResource?.actions.filter(a => a.verb) ?? []
})
</script>
`
}

export function rendererActionButton(): string {
  return `<template>
  <div v-if="visible">
    <button
      type="button"
      @click="handleClick"
      :disabled="disabled"
      :title="buttonTitle"
      :style="{
        padding: '0.5rem 1rem',
        background: disabled ? t.textMuted : bg,
        color: '#fff',
        border: 'none',
        borderRadius: '0.375rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: blockedByFlagOnly ? 0.6 : 1,
      }"
    >
      {{ loading ? actionName + '...' : actionName }}
    </button>
    <div v-if="error" :style="{ color: t.danger, fontSize: '0.75rem', marginTop: '0.25rem' }">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDna, useThemeTokens } from '../context'
import { useApi } from '../useApi'
import { useFlags, readFlagSnapshotSync } from '../flags-context'
import { evaluateRule, findAccessRule, missingFlagsForEntry } from '../rules'

const props = defineProps<{ resource: string; actionName: string }>()
const t = useThemeTokens()
const route = useRoute()
const router = useRouter()
const { operational, user } = useDna()
const flags = useFlags()

const operation = computed(() => \`\${props.resource}.\${props.actionName}\`)
const { submit } = useApi(operation.value)
const loading = ref(false)
const error = ref<string | null>(null)

// ── Render-time guard — pure function of (user, flags) ───────────────────
// Undefined rule (no rules loaded / capability has no access rule) leaves
// the button visible — the API is the authoritative gate. A rule that exists
// but fails to match any allow entry hides the button, unless the *only*
// reason it fails is a missing flag, in which case we disable-with-tooltip.
const rule = computed(() => findAccessRule(operational, operation.value))
const allowed = computed(() => evaluateRule(rule.value, user.roles, flags.value))
const missingFlags = computed(() => {
  if (allowed.value || !rule.value) return [] as string[]
  return (rule.value.allow ?? []).flatMap(entry => missingFlagsForEntry(entry, user.roles, flags.value))
})
const blockedByFlagOnly = computed(() => !allowed.value && missingFlags.value.length > 0)
const visible = computed(() => allowed.value || blockedByFlagOnly.value)

const isDanger = computed(() => /reject|delete|cancel/i.test(props.actionName))
const bg = computed(() => isDanger.value ? t.value.danger : t.value.success)
const disabled = computed(() => loading.value || blockedByFlagOnly.value)
const buttonTitle = computed(() => blockedByFlagOnly.value
  ? \`Requires feature: \${missingFlags.value.join(', ')}\`
  : undefined)

async function handleClick() {
  // Click-time guard — fast-path re-read of the flag snapshot before firing.
  const liveFlags = readFlagSnapshotSync()
  if (!evaluateRule(rule.value, user.roles, liveFlags)) {
    error.value = 'This action is not currently available.'
    return
  }
  loading.value = true
  error.value = null
  try {
    const pathParams = route.params.id ? { id: String(route.params.id) } : undefined
    await submit({}, pathParams)
    router.back()
  } catch (err) {
    error.value = String(err)
  } finally {
    loading.value = false
  }
}
</script>
`
}

export function rendererEmptyStateBlock(): string {
  return `<template>
  <div :style="{
    textAlign: 'center', padding: '3rem', color: t.textMuted,
    border: '2px dashed ' + t.border, borderRadius: '0.5rem', marginBottom: '1.5rem',
  }">
    <p :style="{ margin: 0 }">{{ block.description ?? 'No results found.' }}</p>
  </div>
</template>

<script setup lang="ts">
import type { Block } from '../types'
import { useThemeTokens } from '../context'

defineProps<{ block: Block }>()
const t = useThemeTokens()
</script>
`
}

// ── Flag provide/inject — fetches /api/flags on app mount, provides Ref ──────
// Fail-closed: missing / unfetched / 404 → all flags off. Also exposed via a
// module-level snapshot for click-time guards that fire outside reactive
// contexts.

export function rendererFlagsContext(): string {
  return `import { ref, inject, provide, type Ref, type InjectionKey } from 'vue'

export type FlagSnapshot = Record<string, boolean>

const EMPTY: FlagSnapshot = Object.freeze({}) as FlagSnapshot

// Single shared ref + module-level mirror. The App sets up the provide once
// and calls startFlagFetch(apiBase, token) once it knows those values.
const flagsRef = ref<FlagSnapshot>(EMPTY)
const loadedRef = ref<boolean>(false)
let liveSnapshot: FlagSnapshot = EMPTY

export function readFlagSnapshotSync(): FlagSnapshot {
  return liveSnapshot
}

interface FlagContextValue {
  flags: Ref<FlagSnapshot>
  loaded: Ref<boolean>
}

export const FlagKey: InjectionKey<FlagContextValue> = Symbol('FlagContext')

export function provideFlags(initial?: FlagSnapshot) {
  if (initial) {
    flagsRef.value = initial
    loadedRef.value = true
    liveSnapshot = initial
  }
  provide(FlagKey, { flags: flagsRef, loaded: loadedRef })
}

export function useFlags(): Ref<FlagSnapshot> {
  const ctx = inject(FlagKey)
  return ctx?.flags ?? ref(EMPTY)
}

export function useFlag(name: string): Ref<boolean> {
  const flags = useFlags()
  return ref(flags.value[name] === true)
}

function normalize(raw: unknown): FlagSnapshot {
  if (!raw || typeof raw !== 'object') return EMPTY
  const out: FlagSnapshot = {}
  const src = (raw as { flags?: unknown }).flags ?? raw
  if (src && typeof src === 'object') {
    for (const [k, v] of Object.entries(src as Record<string, unknown>)) {
      out[k] = v === true
    }
  }
  return out
}

/** Kick off the fetch. Safe to call more than once — later calls replace the
 *  snapshot. Any failure leaves the snapshot empty (fail-closed). */
export function startFlagFetch(apiBase: string, token: string | null, endpoint?: string) {
  const url = endpoint ?? \`\${apiBase}/api/flags\`
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = \`Bearer \${token}\`
  fetch(url, { headers })
    .then(res => (res.ok ? res.json() : null))
    .then(body => {
      const snap = normalize(body)
      flagsRef.value = snap
      liveSnapshot = snap
      loadedRef.value = true
    })
    .catch(() => {
      flagsRef.value = EMPTY
      liveSnapshot = EMPTY
      loadedRef.value = true
    })
}
`
}

// ── Rules module — pure allow-entry evaluator used by render + click guards ──

export function rendererRules(): string {
  return `import type { OperationalDNA, Rule, AllowEntry } from './types'
import type { FlagSnapshot } from './flags-context'

export function findAccessRule(
  operational: OperationalDNA | null,
  capability: string,
): Rule | undefined {
  if (!operational?.rules) return undefined
  return operational.rules.find(r => r.capability === capability && r.type !== 'condition')
}

export function missingFlagsForEntry(
  entry: AllowEntry,
  userRoles: string[],
  flags: FlagSnapshot,
): string[] {
  if (entry.role && !userRoles.includes(entry.role)) return []
  const required = entry.flags ?? []
  return required.filter(name => flags[name] !== true)
}

function entryMatches(entry: AllowEntry, userRoles: string[], flags: FlagSnapshot): boolean {
  if (entry.role && !userRoles.includes(entry.role)) return false
  const required = entry.flags ?? []
  for (const name of required) {
    if (flags[name] !== true) return false
  }
  return true
}

/**
 * Evaluate an access rule against the current user + flag snapshot.
 * - Undefined rule  → allowed (no constraint loaded — API is authoritative).
 * - Empty allow[]   → blocked (explicit kill-switch).
 * - Non-empty allow → allowed iff any entry matches.
 */
export function evaluateRule(
  rule: Rule | undefined,
  userRoles: string[],
  flags: FlagSnapshot,
): boolean {
  if (!rule) return true
  const allow = rule.allow ?? []
  if (allow.length === 0) return false
  return allow.some(entry => entryMatches(entry, userRoles, flags))
}
`
}

