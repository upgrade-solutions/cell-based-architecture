import { Namespace } from '../../../../types'

export function generateMain(namespace: Namespace): string {
  const title = namespace.name
  const description = namespace.description ?? ''

  return `import express from 'express'
import cors from 'cors'
import swaggerUi from 'swagger-ui-express'
import * as apiDNA from './dna/api.json'
import * as operationalDNA from './dna/operational.json'
import { registerRoutes } from './interpreter/router'
import { buildOpenApiSpec } from './interpreter/openapi'

async function bootstrap() {
  const app = express()
  app.use(express.json())
  app.use(cors())

  const spec = buildOpenApiSpec(apiDNA, operationalDNA)

  app.get('/api-json', (_req, res) => res.json(spec))
  app.use('/api', swaggerUi.serve, swaggerUi.setup(spec as any))

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

  registerRoutes(app, apiDNA, operationalDNA)

  const port = process.env.PORT ?? 3000
  app.listen(port, () => {
    console.log(\`Listening:  http://localhost:\${port}\`)
    console.log(\`Swagger UI: http://localhost:\${port}/api\`)
    console.log(\`Redoc:      http://localhost:\${port}/docs\`)
    console.log(\`OpenAPI:    http://localhost:\${port}/api-json\`)
  })
}

bootstrap()
`
}
