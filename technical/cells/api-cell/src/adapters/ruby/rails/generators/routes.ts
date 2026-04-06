import { ProductApiDNA, Endpoint, Namespace } from '../../../../types'
import { stripLeadingSlash } from '../../../../utils'
import { toPlural, toActionMethod } from './naming'

function httpVerb(method: string): string {
  return method.toLowerCase()
}

/**
 * Build Rails route entries from DNA endpoints.
 *
 * Groups routes under `scope` matching the namespace path, then maps each
 * endpoint to an explicit route declaration pointing at the correct
 * controller#action.
 */
export function generateRoutes(api: ProductApiDNA): string {
  const nsPath = stripLeadingSlash(api.namespace.path)
  const resources = api.resources ?? []
  const routeLines: string[] = []

  for (const resource of resources) {
    const endpoints = api.endpoints.filter(ep => ep.operation.split('.')[0] === resource.name)
    const controller = toPlural(resource.name)
    const basePath = `${nsPath}/${controller}`

    for (const ep of endpoints) {
      const action = toActionMethod(ep.operation.split('.')[1])
      const verb = httpVerb(ep.method)

      // Convert Express-style :param to Rails-style :param (same syntax)
      const fullPath = ep.path.replace(/^\//, '')
      routeLines.push(`    ${verb} '/${fullPath}', to: '${controller}#${action}'`)
    }
  }

  return `Rails.application.routes.draw do
  scope defaults: { format: :json } do
${routeLines.join('\n')}
  end

  get '/api', to: 'docs#swagger'
  get '/docs', to: 'docs#redoc'
  get '/api-json', to: 'docs#openapi'
  get '/health', to: proc { [200, { 'Content-Type' => 'application/json' }, ['{"status":"ok"}']] }
end
`
}
