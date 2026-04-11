import * as fs from 'fs'
import * as path from 'path'
import { ProductUiDNA, ProductCoreDNA, UiCellContext, UiCellAdapter } from '../../../types'
import { generateDockerfile, generateDockerIgnore } from '../docker'
import {
  generatePackageJson,
  generateTsConfig,
  generateNextConfig,
} from './generators/scaffold'
import {
  rendererTypes,
  rendererContext,
  rendererDnaLoader,
  rendererApiHook,
  rendererDnaProvider,
  rendererRootLayout,
  rendererAppLayout,
  rendererAppPage,
  rendererCatchAllPage,
  rendererLayout,
  rendererPage,
  rendererBlock,
  rendererFormBlock,
  rendererTableBlock,
  rendererDetailBlock,
  rendererActionsBlock,
  rendererEmptyStateBlock,
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

  // ── config.json — tells the renderer where to fetch DNA at runtime ───────────
  write(outputDir, 'public/config.json', JSON.stringify({
    ui: ctx?.uiFetchPath ?? '/dna.json',
    api: ctx?.apiFetchPath ?? null,
    core: ctx?.coreFetchPath ?? null,
    apiBase: ctx?.apiBase ?? '',
  }, null, 2) + '\n')

  // ── Copy DNA files into public/dna/ so they ship with the Next.js build ─────
  if (ctx) {
    const fetchPaths = [ctx.uiFetchPath, ctx.apiFetchPath, ctx.coreFetchPath].filter(
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
  write(outputDir, 'package.json', generatePackageJson(appName))
  write(outputDir, 'tsconfig.json', generateTsConfig())
  write(outputDir, 'next.config.js', generateNextConfig(ctx?.apiBase))

  // ── App Router pages ───────────────────────────────────────────────────────
  write(outputDir, 'src/app/layout.tsx',              rendererRootLayout())
  write(outputDir, 'src/app/(app)/layout.tsx',        rendererAppLayout())
  write(outputDir, 'src/app/(app)/page.tsx',          rendererAppPage())
  write(outputDir, 'src/app/(app)/[...slug]/page.tsx', rendererCatchAllPage())

  // ── Renderer — fetches DNA at runtime, no DNA bundled in the build ──────────
  write(outputDir, 'src/renderer/types.ts',                     rendererTypes())
  write(outputDir, 'src/renderer/context.ts',                   rendererContext())
  write(outputDir, 'src/renderer/dna-loader.ts',                rendererDnaLoader())
  write(outputDir, 'src/renderer/useApi.ts',                    rendererApiHook())
  write(outputDir, 'src/renderer/DnaProvider.tsx',              rendererDnaProvider())
  write(outputDir, 'src/renderer/Layout.tsx',                   rendererLayout())
  write(outputDir, 'src/renderer/Page.tsx',                     rendererPage())
  write(outputDir, 'src/renderer/Block.tsx',                    rendererBlock())
  write(outputDir, 'src/renderer/blocks/FormBlock.tsx',         rendererFormBlock())
  write(outputDir, 'src/renderer/blocks/TableBlock.tsx',        rendererTableBlock())
  write(outputDir, 'src/renderer/blocks/DetailBlock.tsx',       rendererDetailBlock())
  write(outputDir, 'src/renderer/blocks/ActionsBlock.tsx',      rendererActionsBlock())
  write(outputDir, 'src/renderer/blocks/EmptyStateBlock.tsx',   rendererEmptyStateBlock())

  // ── Containerization (Next.js standalone) ──────────────────────────────────
  write(outputDir, 'Dockerfile', generateDockerfile())
  write(outputDir, '.dockerignore', generateDockerIgnore())
}
