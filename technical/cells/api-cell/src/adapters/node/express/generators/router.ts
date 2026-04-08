export function generateRouter(): string {
  return `import { Router } from 'express'
import { createAuthMiddleware } from './auth'
import { createRequestValidator, createRuleValidator } from './validators'
import { createSignalMiddleware } from './signal-middleware'
import { createHandler } from './handler'

export function buildRouter(api: any, operational: any): Router {
  const router = Router()
  for (const endpoint of api.endpoints ?? []) {
    const method = endpoint.method.toLowerCase() as 'get' | 'post' | 'patch' | 'put' | 'delete'
    const authMw = createAuthMiddleware(endpoint, api, operational)
    const requestValidator = createRequestValidator(endpoint, api, operational)
    const ruleValidator = createRuleValidator(endpoint, api, operational)
    const signalMw = createSignalMiddleware(endpoint, api, operational)
    const handler = createHandler(endpoint, api, operational)
    router[method](endpoint.path, authMw, requestValidator, ruleValidator, signalMw, handler)
  }
  return router
}
`
}
