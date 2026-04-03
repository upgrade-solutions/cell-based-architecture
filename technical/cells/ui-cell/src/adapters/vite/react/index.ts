import * as fs from 'fs'
import * as path from 'path'
import { ProductUiDNA, OperationalDNA, UiCellAdapter } from '../../../types'
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
import { generateStubs } from './generators/stubs'

function write(outputDir: string, relPath: string, content: string): void {
  const fullPath = path.join(outputDir, relPath)
  fs.mkdirSync(path.dirname(fullPath), { recursive: true })
  fs.writeFileSync(fullPath, content, 'utf-8')
}

export const generate: UiCellAdapter['generate'] = (
  ui: ProductUiDNA,
  outputDir: string,
  operational?: OperationalDNA,
): void => {
  const appName = ui.layout.name.toLowerCase().replace(/[^a-z0-9-]/g, '-') + '-ui'

  // ── DNA bundle — the only files that change when DNA changes ────────────────
  write(outputDir, 'src/dna.json', JSON.stringify(ui, null, 2) + '\n')
  write(outputDir, 'src/stubs.json', operational ? generateStubs(operational) : '{}\n')

  // ── Scaffold ────────────────────────────────────────────────────────────────
  write(outputDir, 'package.json', generatePackageJson(appName))
  write(outputDir, 'tsconfig.json', generateTsConfig())
  write(outputDir, 'tsconfig.node.json', generateTsConfigNode())
  write(outputDir, 'vite.config.ts', generateViteConfig(appName))
  write(outputDir, 'index.html', generateIndexHtml(ui.layout.name))
  write(outputDir, 'src/main.tsx', generateMain())

  // ── Renderer — generic, reads dna.json at runtime ───────────────────────────
  write(outputDir, 'src/renderer/types.ts',                     rendererTypes())
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
