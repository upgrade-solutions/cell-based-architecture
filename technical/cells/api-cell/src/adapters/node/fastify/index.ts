import * as fs from 'fs'
import * as path from 'path'
import { ProductApiDNA, ProductCoreDNA, AuthProviderConfig, ApiCellAdapter } from '../../../types'
import { collectNouns } from '../../../utils'
import { generateDockerfile, generateDockerIgnore } from '../docker'
import { generateDrizzleSchema, generateDrizzleConfig } from '../shared/drizzle'
import { generatePackageJson, generateTsConfig, generateEnv } from './generators/scaffold'
import { generateMain, generateLambdaHandler } from './generators/main'
import { generateAuth, generateFlags } from './generators/auth'
import { generateAuthRoutes } from './generators/auth-routes'
import { generateStore } from './generators/store'
import { generateHandler } from './generators/handler'
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

export type ComputeTarget = 'ecs' | 'lambda'

/**
 * Fastify api-cell adapter. The same generated app runs as either:
 *   - an ECS-hosted service (`compute: 'ecs'`, the default) — Fastify listens
 *     on `:PORT` exactly like the express adapter; or
 *   - an AWS Lambda function (`compute: 'lambda'`) — Fastify is wrapped with
 *     `@fastify/aws-lambda` in streaming mode and exported as a Lambda
 *     handler, no listener.
 *
 * 95% of the generated files are identical across compute targets. Only
 * `src/main.ts` (ECS) vs `src/handler.ts` (Lambda), `package.json`
 * dependencies, and a few build settings differ.
 *
 * OpenAPI-as-contract seam: when `compute === 'lambda'`, the Lambda
 * entrypoint will eventually consume an OpenAPI document emitted by
 * `@dna-codes/output-openapi` instead of `product.api.json` directly. Until
 * that package publishes, both compute targets read `product.api.json` and
 * the OpenAPI swap is a single-file change in `src/handler.ts`.
 */
export const generate: ApiCellAdapter['generate'] = (
  api: ProductApiDNA,
  core: ProductCoreDNA,
  outputDir: string,
  authConfig?: AuthProviderConfig,
  adapterConfig?: { compute?: ComputeTarget; [key: string]: unknown },
): void => {
  const appName = api.namespace.name.toLowerCase() + '-api'
  const nouns = collectNouns(core)
  const authMode = (authConfig as any)?.provider as string | undefined
  const compute: ComputeTarget = (adapterConfig?.compute as ComputeTarget) ?? 'ecs'

  // ── DNA — loaded at runtime ─────────────────────────────────────────────────
  write(outputDir, 'src/dna/api.json', JSON.stringify(api, null, 2) + '\n')
  write(outputDir, 'src/dna/product.core.json', JSON.stringify(core, null, 2) + '\n')
  if (authConfig) {
    write(outputDir, 'src/dna/auth.json', JSON.stringify(authConfig, null, 2) + '\n')
  }

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
  write(outputDir, 'src/interpreter/openapi.ts', generateOpenApi())
  write(outputDir, 'src/interpreter/router.ts', generateRouter())

  // ── Entry point + seed ──────────────────────────────────────────────────────
  if (compute === 'lambda') {
    // Lambda export — handler entrypoint, no listener.
    write(outputDir, 'src/handler.ts', generateLambdaHandler(api.namespace, authMode))
  } else {
    // ECS entrypoint — Fastify listens on :PORT.
    write(outputDir, 'src/main.ts', generateMain(api.namespace, authMode))
  }
  write(outputDir, 'src/seed.ts', generateSeed())

  // ── Scaffold ────────────────────────────────────────────────────────────────
  write(outputDir, 'package.json', generatePackageJson(appName, compute))
  write(outputDir, 'tsconfig.json', generateTsConfig())
  write(outputDir, '.env', generateEnv())
  write(outputDir, 'drizzle.config.ts', generateDrizzleConfig())

  // ── Docker (ECS only) ───────────────────────────────────────────────────────
  if (compute === 'ecs') {
    write(outputDir, 'Dockerfile', generateDockerfile())
    write(outputDir, '.dockerignore', generateDockerIgnore())
  }
}
