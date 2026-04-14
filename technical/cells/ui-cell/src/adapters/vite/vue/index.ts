import * as fs from 'fs'
import * as path from 'path'
import { ProductUiDNA, ProductCoreDNA, UiCellContext, UiCellAdapter } from '../../../types'
import { generateDockerfile, generateNginxConf, generateDockerIgnore } from '../docker'
import {
  generatePackageJson,
  generateTsConfig,
  generateTsConfigNode,
  generateEnvDts,
  generateViteConfig,
  generateIndexHtml,
  generateMain,
} from './generators/scaffold'
import {
  rendererTypes,
  rendererDnaContext,
  rendererDnaLoader,
  rendererUseApi,
  rendererApp,
  rendererLayoutShell,
  rendererSidebarLayout,
  rendererFullWidthLayout,
  rendererThemeToggle,
  rendererPageView,
  rendererBlockRenderer,
  rendererFormBlock,
  rendererTableBlock,
  rendererDetailBlock,
  rendererActionsBlock,
  rendererActionButton,
  rendererEmptyStateBlock,
  rendererFlagsContext,
  rendererRules,
} from './generators/renderer'

function write(outputDir: string, relPath: string, content: string): void {
  const fullPath = path.join(outputDir, relPath)
  fs.mkdirSync(path.dirname(fullPath), { recursive: true })
  fs.writeFileSync(fullPath, content, 'utf-8')
}

export const generate: UiCellAdapter['generate'] = (
  ui: ProductUiDNA,
  outputDir: string,
  _core?: ProductCoreDNA,
  ctx?: UiCellContext,
): void => {
  const appName = ui.layout.name.toLowerCase().replace(/[^a-z0-9-]/g, '-') + '-ui-vue'

  // ── config.json — tells the renderer where to fetch DNA at runtime ───────────
  write(outputDir, 'public/config.json', JSON.stringify({
    ui: ctx?.uiFetchPath ?? '/dna.json',
    api: ctx?.apiFetchPath ?? null,
    core: ctx?.coreFetchPath ?? null,
    operational: ctx?.operationalFetchPath ?? null,
    apiBase: ctx?.apiBase ?? '',
  }, null, 2) + '\n')

  // ── Copy DNA files into public/dna/ so they ship with the vite build ────────
  if (ctx) {
    const fetchPaths = [ctx.uiFetchPath, ctx.apiFetchPath, ctx.coreFetchPath, ctx.operationalFetchPath].filter(
      (p): p is string => typeof p === 'string' && p.startsWith('/dna/'),
    )
    for (const fetchPath of fetchPaths) {
      const rel = fetchPath.replace(/^\/dna\//, '')
      const src = path.join(ctx.dnaSourceDir, rel)
      if (fs.existsSync(src)) {
        const dest = path.join(outputDir, 'public/dna', rel)
        fs.mkdirSync(path.dirname(dest), { recursive: true })
        fs.copyFileSync(src, dest)
      }
    }
  }

  // ── Scaffold ────────────────────────────────────────────────────────────────
  const relDnaPath = ctx
    ? path.relative(outputDir, ctx.dnaSourceDir).replace(/\\/g, '/')
    : '../../dna'

  write(outputDir, 'package.json', generatePackageJson(appName))
  write(outputDir, 'tsconfig.json', generateTsConfig())
  write(outputDir, 'tsconfig.node.json', generateTsConfigNode())
  write(outputDir, 'env.d.ts', generateEnvDts())
  write(outputDir, 'vite.config.ts', generateViteConfig(appName, relDnaPath, ctx?.apiBase))
  write(outputDir, 'index.html', generateIndexHtml(ui.layout.name))
  write(outputDir, 'src/main.ts', generateMain())

  // ── Renderer — Vue 3 SFC components, fetches DNA at runtime ────────────────
  write(outputDir, 'src/renderer/types.ts',                        rendererTypes())
  write(outputDir, 'src/renderer/context.ts',                      rendererDnaContext())
  write(outputDir, 'src/renderer/flags-context.ts',                rendererFlagsContext())
  write(outputDir, 'src/renderer/rules.ts',                        rendererRules())
  write(outputDir, 'src/renderer/dna-loader.ts',                   rendererDnaLoader())
  write(outputDir, 'src/renderer/useApi.ts',                       rendererUseApi())
  write(outputDir, 'src/renderer/App.vue',                         rendererApp())
  write(outputDir, 'src/renderer/LayoutShell.vue',                 rendererLayoutShell())
  write(outputDir, 'src/renderer/layouts/SidebarLayout.vue',       rendererSidebarLayout())
  write(outputDir, 'src/renderer/layouts/FullWidthLayout.vue',     rendererFullWidthLayout())
  write(outputDir, 'src/renderer/ThemeToggle.vue',                 rendererThemeToggle())
  write(outputDir, 'src/renderer/PageView.vue',                    rendererPageView())
  write(outputDir, 'src/renderer/BlockRenderer.vue',               rendererBlockRenderer())
  write(outputDir, 'src/renderer/blocks/FormBlock.vue',            rendererFormBlock())
  write(outputDir, 'src/renderer/blocks/TableBlock.vue',           rendererTableBlock())
  write(outputDir, 'src/renderer/blocks/DetailBlock.vue',          rendererDetailBlock())
  write(outputDir, 'src/renderer/blocks/ActionsBlock.vue',         rendererActionsBlock())
  write(outputDir, 'src/renderer/blocks/ActionButton.vue',         rendererActionButton())
  write(outputDir, 'src/renderer/blocks/EmptyStateBlock.vue',      rendererEmptyStateBlock())

  // ── Containerization (nginx / static) ───────────────────────────────────────
  write(outputDir, 'Dockerfile', generateDockerfile())
  write(outputDir, 'nginx.conf', generateNginxConf())
  write(outputDir, '.dockerignore', generateDockerIgnore())
}
