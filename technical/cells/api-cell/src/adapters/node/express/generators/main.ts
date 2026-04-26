import { Namespace } from '../../../../types'

export function generateMain(namespace: Namespace, authMode?: string): string {
  const title = namespace.name

  return `import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import express, { Router } from 'express'
import cors from 'cors'
import swaggerUi from 'swagger-ui-express'
import { buildRouter } from './interpreter/router'
import { buildOpenApiSpec } from './interpreter/openapi'
import { seedFromProductCoreDna, getStoreMode } from './interpreter/store'${authMode === 'built-in' ? `\nimport authRoutes from './interpreter/auth-routes'` : ''}

const DNA_API = path.resolve(__dirname, 'dna/api.json')
const DNA_CORE = path.resolve(__dirname, 'dna/product.core.json')

function loadDNA() {
  return {
    api: JSON.parse(fs.readFileSync(DNA_API, 'utf-8')),
    core: JSON.parse(fs.readFileSync(DNA_CORE, 'utf-8')),
  }
}

let currentSpec: object
let currentRouter: Router

function reload(label = 'loaded') {
  try {
    const { api, core } = loadDNA()
    currentSpec = buildOpenApiSpec(api, core)
    currentRouter = buildRouter(api, core)
    console.log(\`[dna] \${label}\`)
  } catch (err: any) {
    console.error(\`[dna] reload failed: \${err.message}\`)
  }
}

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

async function bootstrap() {
  console.log(\`[store] using \${getStoreMode()}\`)

  // Run migrations if using Postgres
  await runMigrations()

  reload('loaded')

  // Seed store with examples from Product Core DNA
  const { core } = loadDNA()
  await seedFromProductCoreDna(core)

  const app = express()
  app.use(express.json())
  app.use(cors())

  app.get('/health', (_req, res) => res.json({ status: 'ok' }))${authMode === 'built-in' ? `\n  app.use('/auth', authRoutes)` : ''}
  // Root lands on Swagger UI so visiting http://host:port/ in a browser
  // (e.g. the cba-viz URL ribbon) doesn't return "Cannot GET /".
  app.get('/', (_req, res) => res.redirect('/api'))
  app.get('/api-json', (_req, res) => res.json(currentSpec))
  app.use('/api', swaggerUi.serve, swaggerUi.setup(null as any, { swaggerOptions: { url: '/api-json' } }))

  app.get('/docs', (_req, res) => {
    res.setHeader('Content-Type', 'text/html')
    res.send(\`<!DOCTYPE html>
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
</html>\`)
  })

  // Delegate to current router — swapped on each DNA reload
  app.use((req, res, next) => currentRouter(req, res, next))

  // Watch DNA files and hot-reload on change
  let reloadTimer: ReturnType<typeof setTimeout> | null = null
  function scheduleReload() {
    if (reloadTimer) clearTimeout(reloadTimer)
    reloadTimer = setTimeout(() => reload('reloaded'), 100)
  }

  fs.watch(DNA_API, scheduleReload)
  fs.watch(DNA_CORE, scheduleReload)

  const port = process.env.PORT ?? 3001
  app.listen(port, () => {
    console.log(\`Listening:  http://localhost:\${port}\`)
    console.log(\`Swagger UI: http://localhost:\${port}/api\`)
    console.log(\`Redoc:      http://localhost:\${port}/docs\`)
    console.log(\`OpenAPI:    http://localhost:\${port}/api-json\`)
    console.log(\`[dna] watching \${DNA_API}\`)
    console.log(\`[dna] watching \${DNA_CORE}\`)
  })

  // Graceful shutdown
  for (const sig of ['SIGTERM', 'SIGINT'] as const) {
    process.on(sig, async () => {
      process.exit(0)
    })
  }
}

bootstrap()
`
}
