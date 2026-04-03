export function generateRouter(): string {
  return `import { Application } from 'express'
import { createAuthMiddleware } from './auth'
import { createHandler } from './handler'

export function registerRoutes(app: Application, api: any, operational: any): void {
  for (const endpoint of api.endpoints ?? []) {
    const method = endpoint.method.toLowerCase() as 'get' | 'post' | 'patch' | 'put' | 'delete'
    const authMw = createAuthMiddleware(endpoint, api, operational)
    const handler = createHandler(endpoint, api, operational)
    app[method](endpoint.path, authMw, handler)
  }
}
`
}
