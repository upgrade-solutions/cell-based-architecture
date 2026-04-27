import { Layout, Page, Route, Block } from '../../../types'
import { AstroFlavor, AstroAdapterConfig } from '..'

/**
 * package.json — common deps + flavor-specific additions. Marketing ships
 * astro alone; Starlight adds the integration + the openapi plugin (we
 * always include the plugin so cell config can flip openapiPath without
 * regenerating; the integration is a no-op when no path is wired).
 */
export function generatePackageJson(appName: string, flavor: AstroFlavor): string {
  const baseDeps: Record<string, string> = {
    astro: '^4.16.0',
  }

  const starlightDeps: Record<string, string> = {
    '@astrojs/starlight': '^0.28.0',
    'starlight-openapi': '^0.10.0',
  }

  const dependencies: Record<string, string> =
    flavor === 'starlight' ? { ...baseDeps, ...starlightDeps } : baseDeps

  return JSON.stringify(
    {
      name: appName,
      version: '0.0.1',
      type: 'module',
      private: true,
      scripts: {
        dev: 'astro dev',
        start: 'astro dev',
        build: 'astro build',
        preview: 'astro preview',
      },
      dependencies,
    },
    null,
    2,
  ) + '\n'
}

export function generateTsConfig(): string {
  return JSON.stringify(
    {
      extends: 'astro/tsconfigs/strict',
    },
    null,
    2,
  ) + '\n'
}

/**
 * astro.config.mjs — flavor-aware:
 *   - marketing: bare Astro config
 *   - starlight: registers the Starlight integration + (optionally) the
 *     starlight-openapi plugin pointing at the OpenAPI document supplied
 *     via cell config
 */
export function generateAstroConfig(
  flavor: AstroFlavor,
  config: AstroAdapterConfig,
  sidebar?: string,
): string {
  if (flavor === 'marketing') {
    return `import { defineConfig } from 'astro/config'

export default defineConfig({})
`
  }

  // starlight flavor
  const openapiImport = config.openapiPath
    ? `import starlightOpenAPI, { openAPISidebarGroups } from 'starlight-openapi'\n`
    : ''
  const openapiPlugin = config.openapiPath
    ? `
      starlightOpenAPI([
        {
          base: 'api',
          schema: '${config.openapiPath}',
        },
      ]),`
    : ''
  const sidebarSection = sidebar
    ? `,
        sidebar: ${sidebar}`
    : ''

  return `import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'
${openapiImport}
export default defineConfig({
  integrations: [
    starlight({
      title: '${escapeString(config.siteTitle ?? 'Docs')}',
      plugins: [${openapiPlugin}
      ]${sidebarSection},
    }),
  ],
})
`
}

export function generateGitignore(): string {
  return `dist/
.astro/
node_modules/
*.log
`
}

/**
 * Marketing layout — wraps every page. `<slot />` is Astro's children API.
 * Pulls the layout type from DNA so a `full-width` layout doesn't render the
 * sidebar nav, and `sidebar` does.
 */
export function generateLayout(siteTitle: string, layout: Layout): string {
  const isSidebar = layout.type === 'sidebar'
  const navMarkup = isSidebar
    ? `<aside class="sidebar"><slot name="sidebar" /></aside>\n      `
    : ''
  return `---
const { title } = Astro.props
---
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{title ? \`\${title} — ${escapeString(siteTitle)}\` : '${escapeString(siteTitle)}'}</title>
    <link rel="stylesheet" href="/styles/site.css" />
  </head>
  <body class="layout-${layout.type}">
    <header class="site-header">
      <a href="/" class="brand">${escapeString(siteTitle)}</a>
    </header>
    <main class="site-main">
      ${navMarkup}<div class="content">
        <slot />
      </div>
    </main>
    <footer class="site-footer">
      <small>© ${new Date().getFullYear()} ${escapeString(siteTitle)}</small>
    </footer>
  </body>
</html>
`
}

/**
 * Page — imports each block component, then renders them in DNA order.
 * Static-only; no client JS. The page receives the route's path metadata
 * via Astro frontmatter so client-side enhancement can layer on later.
 */
export function generatePage(page: Page, route: Route): string {
  const importLines: string[] = ["import Site from '../layouts/Site.astro'"]
  const seen = new Set<string>()
  const renderLines: string[] = []
  for (const block of page.blocks ?? []) {
    const compName = blockComponentName(block)
    if (!seen.has(compName)) {
      seen.add(compName)
      importLines.push(`import ${compName} from '../components/${compName}.astro'`)
    }
    renderLines.push(`  <${compName} />`)
  }

  return `---
${importLines.join('\n')}
---
<Site title="${escapeString(page.name)}">
${renderLines.join('\n')}
</Site>
`
}

/**
 * Block component — block.type drives the rendered markup. For v1 we render
 * each block as a static section; interactivity (form submission, table
 * sorting, etc.) is delegated to a later iteration that adds Astro Islands
 * + client-side hydration as needed.
 */
export function generateBlockComponent(block: Block): string {
  const heading = block.description ?? block.name
  const fieldsMarkup = (block.fields ?? [])
    .map(
      (f) =>
        `      <div class="field">
        <label>${escapeString(f.label)}${f.required ? ' *' : ''}</label>
        <span class="type">${escapeString(f.type)}</span>
      </div>`,
    )
    .join('\n')

  const body = (() => {
    switch (block.type) {
      case 'form':
      case 'survey':
        return `    <form class="block-form">\n${fieldsMarkup}\n      <button type="submit" disabled>Submit (demo)</button>\n    </form>`
      case 'table':
        return `    <table class="block-table">\n      <thead><tr>${(block.fields ?? [])
          .map((f) => `<th>${escapeString(f.label)}</th>`)
          .join('')}</tr></thead>\n      <tbody><!-- rows hydrated client-side --></tbody>\n    </table>`
      case 'detail':
        return `    <dl class="block-detail">\n${(block.fields ?? [])
          .map(
            (f) => `      <dt>${escapeString(f.label)}</dt>\n      <dd class="type">${escapeString(f.type)}</dd>`,
          )
          .join('\n')}\n    </dl>`
      case 'actions':
        return `    <div class="block-actions">\n      <em>${escapeString(
          block.operation ?? '',
        )}</em>\n    </div>`
      case 'empty-state':
        return `    <div class="block-empty">\n      <p>${escapeString(heading)}</p>\n    </div>`
      default:
        return `    <div class="block-${block.type}">\n      <p>${escapeString(heading)}</p>\n    </div>`
    }
  })()

  return `---
// Block: ${escapeString(block.name)} (type: ${block.type})
---
<section class="block block-${block.type}">
  <h2>${escapeString(heading)}</h2>
${body}
</section>
`
}

/**
 * Starlight content config — the Starlight integration consumes the docs
 * collection at src/content/docs/. We define it explicitly so the Markdown
 * entries we emit pick up the right schema.
 */
export function generateStarlightContentConfig(): string {
  return `import { defineCollection } from 'astro:content'
import { docsLoader } from '@astrojs/starlight/loaders'
import { docsSchema } from '@astrojs/starlight/schema'

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
}
`
}

/**
 * Starlight content entry — one Markdown file per Page. Each block in the
 * page becomes a section with its description + (where applicable) a small
 * field list, so the docs page mirrors what the marketing flavor renders
 * without dragging in custom Astro components.
 */
export function generateStarlightContentEntry(page: Page): string {
  const sections: string[] = []
  for (const block of page.blocks ?? []) {
    const heading = block.description ?? block.name
    sections.push(`## ${heading}\n\n_Type: \`${block.type}\`_`)
    if (block.fields?.length) {
      const rows = block.fields
        .map((f) => `| ${f.label} | \`${f.type}\` | ${f.required ? 'yes' : 'no'} |`)
        .join('\n')
      sections.push(
        `\n| Field | Type | Required |\n| --- | --- | --- |\n${rows}`,
      )
    }
  }
  const description = page.description ? page.description : `Documentation for ${page.name}.`
  return `---
title: ${page.name}
description: ${description}
---

${sections.join('\n\n')}
`
}

/**
 * Starlight sidebar literal — emitted into astro.config.mjs as a JS array
 * literal. We list manual sidebar entries for the Pages and append the
 * `openAPISidebarGroups` from starlight-openapi when an OpenAPI document
 * is wired in.
 */
export function generateStarlightSidebar(pages: Page[]): string {
  const items = pages
    .map((p) => `          { label: '${escapeString(p.name)}', slug: '${pageSlugLocal(p.name)}' }`)
    .join(',\n')
  return `[
        {
          label: 'Guides',
          items: [
${items}
          ],
        },
        ...openAPISidebarGroups,
      ]`
}

function pageSlugLocal(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
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

function escapeString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/`/g, '\\`')
}
