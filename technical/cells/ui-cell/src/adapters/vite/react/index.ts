import * as fs from 'fs'
import * as path from 'path'
import { ProductUiDNA, OperationalDNA, UiCellContext, UiCellAdapter } from '../../../types'
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
  rendererTypes,
  rendererContext,
  rendererApp,
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
  _operational?: OperationalDNA,
  ctx?: UiCellContext,
): void => {
  const appName = ui.layout.name.toLowerCase().replace(/[^a-z0-9-]/g, '-') + '-ui'

  // ── config.json — tells the renderer where to fetch DNA at runtime ───────────
  write(outputDir, 'public/config.json', JSON.stringify({
    ui: ctx?.uiFetchPath ?? '/dna.json',
    operational: ctx?.operationalFetchPath ?? null,
  }, null, 2) + '\n')

  // ── Scaffold ────────────────────────────────────────────────────────────────
  const relDnaPath = ctx
    ? path.relative(outputDir, ctx.dnaSourceDir).replace(/\\/g, '/')
    : '../../dna'

  write(outputDir, 'package.json', generatePackageJson(appName))
  write(outputDir, 'tsconfig.json', generateTsConfig())
  write(outputDir, 'tsconfig.node.json', generateTsConfigNode())
  write(outputDir, 'vite.config.ts', generateViteConfig(appName, relDnaPath))
  write(outputDir, 'index.html', generateIndexHtml(ui.layout.name))
  write(outputDir, 'src/main.tsx', generateMain())

  // ── Renderer — fetches DNA at runtime, no DNA bundled in the build ──────────
  write(outputDir, 'src/renderer/types.ts',                     rendererTypes())
  write(outputDir, 'src/renderer/context.ts',                   rendererContext())
  write(outputDir, 'src/renderer/App.tsx',                      rendererApp())
  write(outputDir, 'src/renderer/Layout.tsx',                   rendererLayout())
  write(outputDir, 'src/renderer/Page.tsx',                     rendererPage())
  write(outputDir, 'src/renderer/Block.tsx',                    rendererBlock())
  write(outputDir, 'src/renderer/blocks/FormBlock.tsx',         rendererFormBlock())
  write(outputDir, 'src/renderer/blocks/TableBlock.tsx',        rendererTableBlock())
  write(outputDir, 'src/renderer/blocks/DetailBlock.tsx',       rendererDetailBlock())
  write(outputDir, 'src/renderer/blocks/ActionsBlock.tsx',      rendererActionsBlock())
  write(outputDir, 'src/renderer/blocks/EmptyStateBlock.tsx',   rendererEmptyStateBlock())

  // ── Containerization (nginx / static) ───────────────────────────────────────
  write(outputDir, 'Dockerfile', generateDockerfile())
  write(outputDir, 'nginx.conf', generateNginxConf())
  write(outputDir, '.dockerignore', generateDockerIgnore())
}
