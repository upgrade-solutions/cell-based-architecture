import * as fs from 'fs'
import * as path from 'path'
import { ProductApiDNA, ProductCoreDNA, AuthProviderConfig, SignalDispatchConfig, ApiCellAdapter } from '../../../types'
import { collectNouns } from '../../../utils'
import { generateDockerfile, generateDockerIgnore } from '../docker'
import { generateDrizzleSchema, generateDrizzleConfig } from '../shared/drizzle'
import { generatePackageJson, generateTsConfig, generateEnv } from './generators/scaffold'
import { generateMain } from './generators/main'
import { generateAuth, generateFlags } from './generators/auth'
import { generateAuthRoutes } from './generators/auth-routes'
import { generateStore } from './generators/store'
import { generateHandler } from './generators/handler'
import { generateSignalMiddleware } from './generators/signal-middleware'
import { generateSignalReceiver } from './generators/signal-receiver'
import { generateOpenApi } from './generators/openapi'
import { generateRouter } from './generators/router'
import { generateValidators } from './generators/validators'
import { generateDbConnection, generateDrizzleStore } from './generators/db'
import { generateSeed } from './generators/seed'

function write(outputDir: string, relPath: string, content: string): void {
  const fullPath = path.join(outputDir, relPath)
  fs.mkdirSync(path.dirname(fullPath), { recursive: true })
  fs.writeFileSync(fullPath, content, 'utf-8')
}

export const generate: ApiCellAdapter['generate'] = (
  api: ProductApiDNA,
  core: ProductCoreDNA,
  outputDir: string,
  authConfig?: AuthProviderConfig,
  signalDispatch?: SignalDispatchConfig,
  eventBusEngine?: string,
): void => {
  const appName = api.namespace.name.toLowerCase() + '-api'
  const nouns = collectNouns(core)
  const authMode = (authConfig as any)?.provider as string | undefined

  // ── DNA — loaded at runtime ─────────────────────────────────────────────────
  write(outputDir, 'src/dna/api.json', JSON.stringify(api, null, 2) + '\n')
  write(outputDir, 'src/dna/product.core.json', JSON.stringify(core, null, 2) + '\n')
  if (authConfig) {
    write(outputDir, 'src/dna/auth.json', JSON.stringify(authConfig, null, 2) + '\n')
  }
  write(outputDir, 'src/dna/signal-dispatch.json', JSON.stringify(signalDispatch ?? {}, null, 2) + '\n')

  // ── Database — Drizzle schema + connection ──────────────────────────────────
  write(outputDir, 'src/db/schema.ts', generateDrizzleSchema(nouns))
  write(outputDir, 'src/db/index.ts', generateDbConnection())

  // ── Runtime interpreter — generic, reads DNA at startup ─────────────────────
  write(outputDir, 'src/interpreter/flags.ts', generateFlags())
  write(outputDir, 'src/interpreter/auth.ts', generateAuth(authMode))
  if (authMode === 'built-in') {
    write(outputDir, 'src/interpreter/auth-routes.ts', generateAuthRoutes())
  }
  write(outputDir, 'src/interpreter/store.ts', generateStore())
  write(outputDir, 'src/interpreter/drizzle-store.ts', generateDrizzleStore())
  write(outputDir, 'src/interpreter/validators.ts', generateValidators())
  write(outputDir, 'src/interpreter/handler.ts', generateHandler())
  write(outputDir, 'src/interpreter/signal-middleware.ts', generateSignalMiddleware(eventBusEngine))
  write(outputDir, 'src/interpreter/signal-receiver.ts', generateSignalReceiver())
  write(outputDir, 'src/interpreter/openapi.ts', generateOpenApi())
  write(outputDir, 'src/interpreter/router.ts', generateRouter())

  // ── Entry point + seed ──────────────────────────────────────────────────────
  write(outputDir, 'src/main.ts', generateMain(api.namespace, authMode))
  write(outputDir, 'src/seed.ts', generateSeed())

  // ── Scaffold ────────────────────────────────────────────────────────────────
  write(outputDir, 'package.json', generatePackageJson(appName, eventBusEngine))
  write(outputDir, 'tsconfig.json', generateTsConfig())
  write(outputDir, '.env', generateEnv())
  write(outputDir, 'drizzle.config.ts', generateDrizzleConfig())

  // ── Docker ──────────────────────────────────────────────────────────────────
  write(outputDir, 'Dockerfile', generateDockerfile())
  write(outputDir, '.dockerignore', generateDockerIgnore())
}
