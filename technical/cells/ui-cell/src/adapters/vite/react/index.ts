import * as fs from 'fs'
import * as path from 'path'
import { ProductUiDNA, UiCellAdapter } from '../../../types'
import { toFileName } from '../../../utils'
import { generateDockerfile, generateNginxConf, generateDockerIgnore } from '../docker'
import {
  generatePackageJson,
  generateTsConfig,
  generateTsConfigNode,
  generateViteConfig,
  generateIndexHtml,
  generateMain,
} from './generators/scaffold'
import { generateLayout } from './generators/layout'
import { generateRouter } from './generators/router'
import { generatePage } from './generators/page'

function write(outputDir: string, relPath: string, content: string): void {
  const fullPath = path.join(outputDir, relPath)
  fs.mkdirSync(path.dirname(fullPath), { recursive: true })
  fs.writeFileSync(fullPath, content, 'utf-8')
}

export const generate: UiCellAdapter['generate'] = (
  ui: ProductUiDNA,
  outputDir: string,
): void => {
  const appName = ui.layout.name.toLowerCase().replace(/[^a-z0-9-]/g, '-') + '-ui'

  // ── Scaffold ────────────────────────────────────────────────────────────────
  write(outputDir, 'package.json', generatePackageJson(appName))
  write(outputDir, 'tsconfig.json', generateTsConfig())
  write(outputDir, 'tsconfig.node.json', generateTsConfigNode())
  write(outputDir, 'vite.config.ts', generateViteConfig(appName))
  write(outputDir, 'index.html', generateIndexHtml(ui.layout.name))

  // ── Entry point ─────────────────────────────────────────────────────────────
  write(outputDir, 'src/main.tsx', generateMain())

  // ── Router (App.tsx) ────────────────────────────────────────────────────────
  write(outputDir, 'src/App.tsx', generateRouter(ui))

  // ── Layout ──────────────────────────────────────────────────────────────────
  const layoutFile = `src/layouts/${toFileName(ui.layout.name)}.tsx`
  write(outputDir, layoutFile, generateLayout(ui.layout, ui.routes))

  // ── Pages ───────────────────────────────────────────────────────────────────
  for (const page of ui.pages) {
    const pageFile = `src/pages/${toFileName(page.name)}.tsx`
    write(outputDir, pageFile, generatePage(page))
  }

  // ── Containerization (nginx / static) ───────────────────────────────────────
  write(outputDir, 'Dockerfile', generateDockerfile())
  write(outputDir, 'nginx.conf', generateNginxConf())
  write(outputDir, '.dockerignore', generateDockerIgnore())
}
