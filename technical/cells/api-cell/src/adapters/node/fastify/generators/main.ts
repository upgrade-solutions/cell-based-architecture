import { Namespace } from '../../../../types'

/**
 * ECS entrypoint: builds Fastify, registers routes, calls listen(). Mirrors
 * the express adapter's main.ts: hot DNA reload via fs.watch, Redoc at
 * /docs, /api-json for the spec.
 *
 * Docs strategy (see openspec change `fix-fastify-adapter-swagger-ui-wiring`):
 * Redoc only. We do NOT use `@fastify/swagger` or `@fastify/swagger-ui`, and
 * we do NOT hand-roll a Swagger UI page. Reasons:
 *   - The api-cell builds the OpenAPI document directly from DNA; there are
 *     no route schemas for `@fastify/swagger` to introspect, so its
 *     `mode: 'static'` path was the only useful seam — and it captures the
 *     doc at registration, turning the plugin into dead weight that has to be
 *     re-fed via decorator overrides.
 *   - `@fastify/swagger-ui@^5` force-resolves `<routePrefix>/json` through
 *     `app.swagger()`, ignoring `uiConfig.url`. That was the proximate cause
 *     of the "definition does not specify a valid version field" error the
 *     change fixes; any reintroduction of the plugin pair re-introduces it.
 *   - Redoc already renders the same OpenAPI doc with a built-in
 *     "Request samples" panel (curl + copy button) out of the box, so a
 *     second renderer added no real value to justify the extra HTML/CDN
 *     surface.
 * Two plugin majors leave the dep set; one renderer (Redoc) remains, served
 * from CDN at /docs.
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

  // Root redirects to Redoc so visiting http://host:port/ in a browser
  // doesn't return a 404 page.
  app.get('/', async (_req, reply) => reply.redirect('/docs'))

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
 * OpenAPI-as-contract seam — partial:
 * - The runtime spec served at /api-json is rendered by
 *   @dna-codes/dna-output-openapi (see ./interpreter/openapi). DNA → OpenAPI
 *   translation lives upstream now.
 * - Route registration (registerRoutes) still consumes product.api.json
 *   directly. Flipping it to consume the OpenAPI document is a separate,
 *   larger change (param parsing, validation middleware, error shapes)
 *   deferred to a follow-on. The loadDNA() function below is still the
 *   swap point for that future change.
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
 * loadDNA is the swap point for the deferred routing-from-OpenAPI change.
 * Today registerRoutes consumes product.api.json directly; when that flip
 * happens, this function becomes the place to read an OpenAPI document
 * instead. The /api-json render seam has already been crossed (see
 * ./interpreter/openapi).
 */
function loadDNA() {
  return {
    api: JSON.parse(fs.readFileSync(DNA_API, 'utf-8')),
    core: JSON.parse(fs.readFileSync(DNA_CORE, 'utf-8')),
  }
}

// @fastify/aws-lambda@^5 ships two overloads for awsLambdaFastify (promise vs.
// callback). TS's overload resolution picks the callback variant, which then
// rejects the 2-arg \`h(event, context)\` calls below. We always invoke the
// promise form, so we narrow the cached handler's type explicitly rather than
// importing a named type (the package exports the type only via a namespace,
// which doesn't survive default-import + ts-node combos cleanly).
type PromiseLambdaHandler = (event: any, context: any) => Promise<any>
let cachedHandler: PromiseLambdaHandler | null = null

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

async function ensureHandler(): Promise<PromiseLambdaHandler> {
  if (cachedHandler) return cachedHandler
  const app = await buildApp()
  await app.ready()
  cachedHandler = awsLambdaFastify(app) as unknown as PromiseLambdaHandler
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
