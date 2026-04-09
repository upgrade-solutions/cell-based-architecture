import * as fs from 'fs'
import * as path from 'path'
import { ProductApiDNA, OperationalDNA, AuthProviderConfig, SignalDispatchConfig, ApiCellAdapter } from '../../../types'
import { collectNouns } from '../../../utils'
import { generateDockerfile, generateDockerIgnore } from '../docker'
import { generateDrizzleSchema, generateDrizzleConfig } from '../shared/drizzle'
import { generatePackageJson, generateTsConfig, generateEnv } from './generators/scaffold'
import { generateMain } from './generators/main'
import { generateAuth } from './generators/auth'
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
  operational: OperationalDNA,
  outputDir: string,
  authConfig?: AuthProviderConfig,
  signalDispatch?: SignalDispatchConfig,
): void => {
  const appName = api.namespace.name.toLowerCase() + '-api'
  const nouns = collectNouns(operational.domain)

  // ── DNA — loaded at runtime ─────────────────────────────────────────────────
  write(outputDir, 'src/dna/api.json', JSON.stringify(api, null, 2) + '\n')
  write(outputDir, 'src/dna/operational.json', JSON.stringify(operational, null, 2) + '\n')
  if (authConfig) {
    write(outputDir, 'src/dna/auth.json', JSON.stringify(authConfig, null, 2) + '\n')
  }
  write(outputDir, 'src/dna/signal-dispatch.json', JSON.stringify(signalDispatch ?? {}, null, 2) + '\n')

  // ── Database — Drizzle schema + connection ──────────────────────────────────
  write(outputDir, 'src/db/schema.ts', generateDrizzleSchema(nouns))
  write(outputDir, 'src/db/index.ts', generateDbConnection())

  // ── Runtime interpreter — generic, reads DNA at startup ─────────────────────
  write(outputDir, 'src/interpreter/auth.ts', generateAuth())
  write(outputDir, 'src/interpreter/store.ts', generateStore())
  write(outputDir, 'src/interpreter/drizzle-store.ts', generateDrizzleStore())
  write(outputDir, 'src/interpreter/validators.ts', generateValidators())
  write(outputDir, 'src/interpreter/handler.ts', generateHandler())
  write(outputDir, 'src/interpreter/signal-middleware.ts', generateSignalMiddleware())
  write(outputDir, 'src/interpreter/signal-receiver.ts', generateSignalReceiver())
  write(outputDir, 'src/interpreter/openapi.ts', generateOpenApi())
  write(outputDir, 'src/interpreter/router.ts', generateRouter())

  // ── Entry point + seed ──────────────────────────────────────────────────────
  write(outputDir, 'src/main.ts', generateMain(api.namespace))
  write(outputDir, 'src/seed.ts', generateSeed())

  // ── Scaffold ────────────────────────────────────────────────────────────────
  write(outputDir, 'package.json', generatePackageJson(appName))
  write(outputDir, 'tsconfig.json', generateTsConfig())
  write(outputDir, '.env', generateEnv())
  write(outputDir, 'drizzle.config.ts', generateDrizzleConfig())

  // ── Docker ──────────────────────────────────────────────────────────────────
  write(outputDir, 'Dockerfile', generateDockerfile())
  write(outputDir, '.dockerignore', generateDockerIgnore())
}
