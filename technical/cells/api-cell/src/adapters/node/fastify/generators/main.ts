import { Namespace } from '../../../../types'

/**
 * ECS entrypoint: builds Fastify, registers routes, calls listen(). Mirrors
 * the express adapter's main.ts: hot DNA reload via fs.watch, Swagger UI at
 * /api, Redoc at /docs, /api-json for the spec.
 */
export function generateMain(namespace: Namespace, authMode?: string): string {
  const title = namespace.name
  const authImport = authMode === 'built-in'
    ? `\nimport { authRoutes } from './interpreter/auth-routes'`
    : ''
  const authRegister = authMode === 'built-in'
    ? `\n  await app.register(authRoutes)`
    : ''

  return `import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import Fastify, { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { registerRoutes } from './interpreter/router'
import { buildOpenApiSpec } from './interpreter/openapi'
import { seedFromProductCoreDna, getStoreMode } from './interpreter/store'${authImport}

const DNA_API = path.resolve(__dirname, 'dna/api.json')
const DNA_CORE = path.resolve(__dirname, 'dna/product.core.json')

function loadDNA() {
  return {
    api: JSON.parse(fs.readFileSync(DNA_API, 'utf-8')),
    core: JSON.parse(fs.readFileSync(DNA_CORE, 'utf-8')),
  }
}

let currentSpec: object = {}

async function runMigrations() {
  if (!process.env.DATABASE_URL) return
  try {
    const { migrate } = await import('drizzle-orm/node-postgres/migrator')
    const { db } = await import('./db')
    const migrationsFolder = path.resolve(__dirname, '..', 'drizzle')
    await migrate(db, { migrationsFolder })
    console.log('[db] migrations applied')
  } catch (err: any) {
    console.error(\`[db] migration failed: \${err.message}\`)
  }
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false, bodyLimit: 1048576 })
  await app.register(cors, { origin: true })

  app.get('/health', async () => ({ status: 'ok' }))

  // Root redirects to Swagger UI so visiting http://host:port/ in a browser
  // doesn't return a 404 page.
  app.get('/', async (_req, reply) => reply.redirect('/api'))

  app.get('/api-json', async () => currentSpec)

  app.get('/docs', async (_req, reply) => {
    reply.header('Content-Type', 'text/html')
    return \`<!DOCTYPE html>
<html>
  <head>
    <title>${title} — API Reference</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet" />
    <style>body { margin: 0; padding: 0; }</style>
  </head>
  <body>
    <redoc spec-url='/api-json'></redoc>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
  </body>
</html>\`
  })

  // Swagger UI — fed from the dynamically rebuilt /api-json route.
  await app.register(swagger, { mode: 'static', specification: { document: currentSpec as any } })
  await app.register(swaggerUi, {
    routePrefix: '/api',
    uiConfig: { url: '/api-json' },
  })${authRegister}

  // Register DNA-driven routes
  const { api, core } = loadDNA()
  currentSpec = buildOpenApiSpec(api, core)
  await registerRoutes(app, api, core)

  return app
}

async function bootstrap() {
  console.log(\`[store] using \${getStoreMode()}\`)
  await runMigrations()

  const { core } = loadDNA()
  await seedFromProductCoreDna(core)

  const app = await buildApp()

  // Watch DNA files and log on change. Fastify cannot hot-swap routes after
  // listen() the way Express's pluggable Router can, so we log a warning that
  // a restart is required — operationally fine for ECS where the orchestrator
  // can replace the task.
  let warnTimer: ReturnType<typeof setTimeout> | null = null
  function scheduleWarn() {
    if (warnTimer) clearTimeout(warnTimer)
    warnTimer = setTimeout(() => {
      console.warn('[dna] DNA file changed — restart this task to pick up changes')
    }, 100)
  }
  fs.watch(DNA_API, scheduleWarn)
  fs.watch(DNA_CORE, scheduleWarn)

  const port = Number(process.env.PORT ?? 3001)
  await app.listen({ port, host: '0.0.0.0' })
  console.log(\`Listening:  http://localhost:\${port}\`)
  console.log(\`Swagger UI: http://localhost:\${port}/api\`)
  console.log(\`Redoc:      http://localhost:\${port}/docs\`)
  console.log(\`OpenAPI:    http://localhost:\${port}/api-json\`)

  for (const sig of ['SIGTERM', 'SIGINT'] as const) {
    process.on(sig, async () => {
      await app.close()
      process.exit(0)
    })
  }
}

bootstrap().catch(err => {
  console.error(err)
  process.exit(1)
})
`
}

/**
 * Lambda entrypoint: builds Fastify once at cold start, wraps it with
 * @fastify/aws-lambda in streaming mode (`awslambda.streamifyResponse`), and
 * exports the handler for the Function URL with invoke_mode = RESPONSE_STREAM.
 *
 * SSE compatibility: Fastify routes write SSE via reply.raw.write(); the
 * streaming wrapper passes those writes straight through to the Function URL
 * response stream. CloudFront forwards the stream untouched when its cache
 * behavior is set to Managed-CachingDisabled (terraform-aws emits that).
 *
 * OpenAPI-as-contract seam: the proposal calls for the lambda compute path
 * to consume the OpenAPI document emitted by @dna-codes/output-openapi rather
 * than reading product.api.json directly. Until that package publishes
 * (sister proposal task 6.1), this entrypoint loads product.api.json — the
 * same source the ECS path uses. Swap point is the loadDNA() function below.
 */
export function generateLambdaHandler(namespace: Namespace, authMode?: string): string {
  const authImport = authMode === 'built-in'
    ? `\nimport { authRoutes } from './interpreter/auth-routes'`
    : ''
  const authRegister = authMode === 'built-in'
    ? `\n  await app.register(authRoutes)`
    : ''

  return `import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import Fastify, { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import awsLambdaFastify from '@fastify/aws-lambda'
import { registerRoutes } from './interpreter/router'
import { buildOpenApiSpec } from './interpreter/openapi'
import { seedFromProductCoreDna, getStoreMode } from './interpreter/store'${authImport}

const DNA_API = path.resolve(__dirname, 'dna/api.json')
const DNA_CORE = path.resolve(__dirname, 'dna/product.core.json')

/**
 * SEAM: when @dna-codes/output-openapi publishes, swap the api.json read for
 * a read of the emitted OpenAPI document and adapt registerRoutes to consume
 * it. Everything else in this file is compute-target agnostic.
 */
function loadDNA() {
  return {
    api: JSON.parse(fs.readFileSync(DNA_API, 'utf-8')),
    core: JSON.parse(fs.readFileSync(DNA_CORE, 'utf-8')),
  }
}

let cachedHandler: ReturnType<typeof awsLambdaFastify> | null = null

async function buildApp(): Promise<FastifyInstance> {
  console.log(\`[store] using \${getStoreMode()}\`)
  const app = Fastify({ logger: false, bodyLimit: 1048576 })
  await app.register(cors, { origin: true })

  app.get('/health', async () => ({ status: 'ok' }))

  const { api, core } = loadDNA()
  app.get('/api-json', async () => buildOpenApiSpec(api, core))

  // Seed the in-memory store on cold start so demo data is available without
  // a database. Lambda + Postgres should set DATABASE_URL + SEED_EXAMPLES.
  await seedFromProductCoreDna(core)

  await registerRoutes(app, api, core)${authRegister}

  return app
}

async function ensureHandler() {
  if (cachedHandler) return cachedHandler
  const app = await buildApp()
  await app.ready()
  cachedHandler = awsLambdaFastify(app)
  return cachedHandler
}

/**
 * Lambda Function URL with invoke_mode = RESPONSE_STREAM streams the response
 * body as it is written. \`awslambda.streamifyResponse\` is the runtime API
 * that exposes that stream to user code; @fastify/aws-lambda v4+ forwards
 * reply writes (including reply.raw.write() for SSE) into it.
 *
 * On unsupported runtimes (local dev, plain invoke), the global is undefined
 * and we fall back to the buffered handler — useful for unit tests.
 */
const streamifyResponse: any = (globalThis as any).awslambda?.streamifyResponse

export const handler = streamifyResponse
  ? streamifyResponse(async (event: any, responseStream: any, context: any) => {
      const h = await ensureHandler()
      const result: any = await h(event, context)
      // The streaming wrapper receives a Lambda Function URL response; pipe
      // the JSON/text body to the response stream and end.
      responseStream.setContentType?.(result.headers?.['content-type'] ?? 'application/json')
      responseStream.write(result.body ?? '')
      responseStream.end()
    })
  : async (event: any, context: any) => {
      const h = await ensureHandler()
      return h(event, context)
    }
`
}
