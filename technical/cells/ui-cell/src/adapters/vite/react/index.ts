import * as fs from 'fs'
import * as path from 'path'
import { ProductUiDNA, ProductCoreDNA, UiCellContext, UiCellAdapter } from '../../../types'
import { generateDockerfile, generateNginxConf, generateDockerIgnore } from '../docker'
import {
  generatePackageJson,
  generateTsConfig,
  generateTsConfigNode,
  generateViteConfig,
  generateIndexHtml,
  generateMain,
} from './generators/scaffold'
import {
  rendererGlobalsCss,
  rendererTypes,
  rendererContext,
  rendererDnaLoader,
  rendererApiHook,
  rendererApp,
  rendererLayout,
  rendererPage,
  rendererBlock,
  rendererFormBlock,
  rendererSurveyBlock,
  rendererTableBlock,
  rendererDetailBlock,
  rendererActionsBlock,
  rendererEmptyStateBlock,
  rendererLayoutMachine,
  rendererUniversalLayout,
  rendererMarketingLayout,
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
  const appName = ui.layout.name.toLowerCase().replace(/[^a-z0-9-]/g, '-') + '-ui'

  // ── Vendor mode + primitives path ───────────────────────────────────────────
  const vendorComponents = ctx?.vendorComponents ?? true
  const primitivesPath = vendorComponents ? '../primitives' : '@dna-codes/cells-ui/primitives'

  // ── config.json — tells the renderer where to fetch DNA at runtime ───────────
  write(outputDir, 'public/config.json', JSON.stringify({
    ui: ctx?.uiFetchPath ?? '/dna.json',
    api: ctx?.apiFetchPath ?? null,
    core: ctx?.coreFetchPath ?? null,
    operational: ctx?.operationalFetchPath ?? null,
    apiBase: ctx?.apiBase ?? '',
  }, null, 2) + '\n')

  // ── Copy DNA files into public/dna/ so they ship with the vite build ────────
  // The vite dev server has a middleware that serves DNA from the source dir,
  // but production builds (nginx in the container) have no such middleware —
  // DNA must be shipped as static assets under the same /dna/... URL paths.
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

  // ── Vendor primitives (copy source files into output) ───────────────────────
  if (vendorComponents) {
    const primitivesDir = path.join(__dirname, '../../../primitives')
    if (fs.existsSync(primitivesDir)) {
      const files = fs.readdirSync(primitivesDir)
      for (const file of files) {
        if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          write(outputDir, `src/primitives/${file}`, fs.readFileSync(path.join(primitivesDir, file), 'utf-8'))
        }
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
  write(outputDir, 'vite.config.ts', generateViteConfig(appName, relDnaPath, ctx?.apiBase))
  write(outputDir, 'index.html', generateIndexHtml(ui.layout.name))
  write(outputDir, 'src/main.tsx', generateMain())

  // ── Renderer — fetches DNA at runtime, no DNA bundled in the build ──────────
  write(outputDir, 'src/globals.css',                           rendererGlobalsCss(ui.layout))
  write(outputDir, 'src/renderer/types.ts',                     rendererTypes())
  write(outputDir, 'src/renderer/context.ts',                   rendererContext())
  write(outputDir, 'src/renderer/flags-context.tsx',            rendererFlagsContext())
  write(outputDir, 'src/renderer/rules.ts',                     rendererRules())
  write(outputDir, 'src/renderer/dna-loader.ts',                rendererDnaLoader())
  write(outputDir, 'src/renderer/useApi.ts',                    rendererApiHook())
  write(outputDir, 'src/renderer/App.tsx',                      rendererApp())
  write(outputDir, 'src/renderer/Layout.tsx',                   rendererLayout())
  write(outputDir, 'src/renderer/layout-machine.ts',            rendererLayoutMachine())
  write(outputDir, 'src/renderer/UniversalLayout.tsx',          rendererUniversalLayout(primitivesPath))
  write(outputDir, 'src/renderer/MarketingLayout.tsx',          rendererMarketingLayout())
  write(outputDir, 'src/renderer/Page.tsx',                     rendererPage())
  write(outputDir, 'src/renderer/Block.tsx',                    rendererBlock())
  write(outputDir, 'src/renderer/blocks/FormBlock.tsx',         rendererFormBlock())
  write(outputDir, 'src/renderer/blocks/SurveyBlock.tsx',       rendererSurveyBlock())
  write(outputDir, 'src/renderer/blocks/TableBlock.tsx',        rendererTableBlock())
  write(outputDir, 'src/renderer/blocks/DetailBlock.tsx',       rendererDetailBlock())
  write(outputDir, 'src/renderer/blocks/ActionsBlock.tsx',      rendererActionsBlock())
  write(outputDir, 'src/renderer/blocks/EmptyStateBlock.tsx',   rendererEmptyStateBlock())

  // ── Containerization (nginx / static) ───────────────────────────────────────
  write(outputDir, 'Dockerfile', generateDockerfile())
  write(outputDir, 'nginx.conf', generateNginxConf())
  write(outputDir, '.dockerignore', generateDockerIgnore())
}
