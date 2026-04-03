import * as fs from 'fs'
import * as path from 'path'
import { ProductApiDNA, OperationalDNA, ApiCellAdapter } from '../../../types'
import { generateDockerfile, generateDockerIgnore } from '../docker'
import { generatePackageJson, generateTsConfig, generateEnv } from './generators/scaffold'
import { generateMain } from './generators/main'
import { generateAuth } from './generators/auth'
import { generateStore } from './generators/store'
import { generateHandler } from './generators/handler'
import { generateOpenApi } from './generators/openapi'
import { generateRouter } from './generators/router'

function write(outputDir: string, relPath: string, content: string): void {
  const fullPath = path.join(outputDir, relPath)
  fs.mkdirSync(path.dirname(fullPath), { recursive: true })
  fs.writeFileSync(fullPath, content, 'utf-8')
}

export const generate: ApiCellAdapter['generate'] = (
  api: ProductApiDNA,
  operational: OperationalDNA,
  outputDir: string,
): void => {
  const appName = api.namespace.name.toLowerCase() + '-api'

  // ── DNA — loaded at runtime ─────────────────────────────────────────────────
  write(outputDir, 'src/dna/api.json', JSON.stringify(api, null, 2) + '\n')
  write(outputDir, 'src/dna/operational.json', JSON.stringify(operational, null, 2) + '\n')

  // ── Runtime interpreter — generic, reads DNA at startup ─────────────────────
  write(outputDir, 'src/interpreter/auth.ts', generateAuth())
  write(outputDir, 'src/interpreter/store.ts', generateStore())
  write(outputDir, 'src/interpreter/handler.ts', generateHandler())
  write(outputDir, 'src/interpreter/openapi.ts', generateOpenApi())
  write(outputDir, 'src/interpreter/router.ts', generateRouter())

  // ── Entry point ─────────────────────────────────────────────────────────────
  write(outputDir, 'src/main.ts', generateMain(api.namespace))

  // ── Scaffold ────────────────────────────────────────────────────────────────
  write(outputDir, 'package.json', generatePackageJson(appName))
  write(outputDir, 'tsconfig.json', generateTsConfig())
  write(outputDir, '.env', generateEnv())

  // ── Containerization ────────────────────────────────────────────────────────
  write(outputDir, 'Dockerfile', generateDockerfile())
  write(outputDir, '.dockerignore', generateDockerIgnore())
}
