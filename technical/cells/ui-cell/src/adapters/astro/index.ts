import * as fs from 'fs'
import * as path from 'path'
import { ProductUiDNA, ProductCoreDNA, UiCellContext, UiCellAdapter } from '../../types'
import {
  generatePackageJson,
  generateAstroConfig,
  generateTsConfig,
  generateLayout,
  generatePage,
  generateBlockComponent,
  generateGitignore,
  generateStarlightSidebar,
  generateStarlightContentEntry,
  generateStarlightContentConfig,
} from './generators/scaffold'

function write(outputDir: string, relPath: string, content: string): void {
  const fullPath = path.join(outputDir, relPath)
  fs.mkdirSync(path.dirname(fullPath), { recursive: true })
  fs.writeFileSync(fullPath, content, 'utf-8')
}

export type AstroFlavor = 'marketing' | 'starlight'

export interface AstroAdapterConfig {
  flavor?: AstroFlavor
  /**
   * Path to an OpenAPI document emitted by `@dna-codes/output-openapi`.
   * Resolved relative to the cell's outputDir. Only the `starlight` flavor
   * consumes this — the `starlight-openapi` plugin renders an API reference
   * section from it.
   */
  openapiPath?: string
  /**
   * Marketing flavor only — site title shown in the header. Defaults to the
   * Layout's name from product.ui.json.
   */
  siteTitle?: string
}

/**
 * Astro ui-cell adapter. Two flavors share one adapter:
 *
 *   - `marketing` (default): plain Astro SSG. Each DNA `Page` becomes a
 *     `src/pages/*.astro` file; the `Layout` becomes a single `src/layouts/`
 *     component that wraps every page; `Block` definitions become inert
 *     `src/components/Block*.astro` partials. Output is static HTML;
 *     terraform-aws delivers via S3 + CloudFront (same path the vite
 *     adapters use — no new delivery work).
 *
 *   - `starlight`: Astro + Starlight (docs UI). Each DNA `Page` becomes a
 *     Markdown content entry under `src/content/docs/`; sidebar order is
 *     derived from the Page list. When `openapiPath` is provided in cell
 *     config, the `starlight-openapi` plugin is wired to render an API
 *     reference section sourced from that file (the output of
 *     `@dna-codes/output-openapi`).
 *
 * Both flavors emit static-buildable projects (`npm run build` produces
 * `dist/`); both reuse the existing static-site delivery path.
 */
export const generate: UiCellAdapter['generate'] = (
  ui: ProductUiDNA,
  outputDir: string,
  _core?: ProductCoreDNA,
  ctx?: UiCellContext,
): void => {
  // Pull adapter config off the context (the technical-DNA cell config flows
  // through ctx; for the astro adapter we expect `flavor` + optional
  // `openapiPath`).
  const config: AstroAdapterConfig = ((ctx as any)?.adapterConfig ?? {}) as AstroAdapterConfig
  const flavor: AstroFlavor = config.flavor ?? 'marketing'
  const appName =
    ui.layout.name.toLowerCase().replace(/[^a-z0-9-]/g, '-') +
    (flavor === 'starlight' ? '-docs' : '-ui')

  // ── Shared scaffold ─────────────────────────────────────────────────────────
  write(outputDir, 'package.json', generatePackageJson(appName, flavor))
  write(outputDir, 'tsconfig.json', generateTsConfig())
  write(outputDir, 'astro.config.mjs', generateAstroConfig(flavor, config))
  write(outputDir, '.gitignore', generateGitignore())

  if (flavor === 'starlight') {
    // Starlight emits Markdown content entries; the docs site itself comes
    // pre-built by Starlight, so we don't ship layout / page renderers.
    write(outputDir, 'src/content.config.ts', generateStarlightContentConfig())

    // Sidebar order matches the Page list from product.ui.json.
    const sidebar = generateStarlightSidebar(ui.pages)
    write(outputDir, 'astro.config.mjs', generateAstroConfig(flavor, config, sidebar))

    for (const page of ui.pages) {
      const slug = pageSlug(page.name)
      write(outputDir, `src/content/docs/${slug}.md`, generateStarlightContentEntry(page))
    }
    return
  }

  // ── Marketing flavor ────────────────────────────────────────────────────────
  const siteTitle = config.siteTitle ?? ui.layout.name

  // One Layout component shared by every page.
  write(outputDir, 'src/layouts/Site.astro', generateLayout(siteTitle, ui.layout))

  // One Astro page per DNA Page. Routes from product.ui.json drive the file
  // path so the URL structure matches the Product UI DNA contract.
  for (const route of ui.routes) {
    const page = ui.pages.find((p) => p.name === route.page)
    if (!page) continue
    const filename = routeToAstroFilename(route.path)
    write(outputDir, `src/pages/${filename}`, generatePage(page, route))
  }

  // One component per unique block. Marketing pages render blocks as static
  // partials — no client JS by default. Interactivity can be added later via
  // Astro Islands when a block's type warrants it.
  const seenBlocks = new Set<string>()
  for (const page of ui.pages) {
    for (const block of page.blocks ?? []) {
      const componentName = blockComponentName(block)
      if (seenBlocks.has(componentName)) continue
      seenBlocks.add(componentName)
      write(outputDir, `src/components/${componentName}.astro`, generateBlockComponent(block))
    }
  }
}

/** Convert "About Us" → "about-us" for use as a content entry slug. */
function pageSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Map a DNA route path to an Astro file path.
 *   "/"           → "index.astro"
 *   "/about"      → "about.astro"
 *   "/loans/:id"  → "loans/[id].astro"
 */
function routeToAstroFilename(routePath: string): string {
  if (routePath === '/' || routePath === '') return 'index.astro'
  const trimmed = routePath.replace(/^\//, '').replace(/\/$/, '')
  const parts = trimmed.split('/').map((seg) =>
    seg.startsWith(':') ? `[${seg.slice(1)}]` : seg,
  )
  return parts.join('/') + '.astro'
}

function blockComponentName(block: { name: string }): string {
  const safe = block.name
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')
  return `Block${safe || 'Generic'}`
}

// Re-exported so tests + callers can mirror file layout decisions
export { pageSlug, routeToAstroFilename, blockComponentName }
