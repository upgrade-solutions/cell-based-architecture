/**
 * Generates the Fastify route registrar. Where the express adapter returns a
 * Router and uses chained middleware, Fastify uses route options + lifecycle
 * hooks: `preHandler` runs before the handler, in array order, exactly like
 * Express middleware chains. The auth hook → request validator → rule
 * validator order is preserved.
 *
 * Path conversion: DNA endpoints use `/:id`; Fastify accepts the same syntax,
 * no rewrite needed (unlike OpenAPI's `{id}`).
 */
export function generateRouter(): string {
  return `import { FastifyInstance } from 'fastify'
import { createAuthHook } from './auth'
import { createRequestValidator, createRuleValidator } from './validators'
import { createHandler } from './handler'

export async function registerRoutes(app: FastifyInstance, api: any, operational: any): Promise<void> {
  for (const endpoint of api.endpoints ?? []) {
    const method = endpoint.method.toLowerCase() as 'get' | 'post' | 'patch' | 'put' | 'delete'
    const authHook = createAuthHook(endpoint, api, operational)
    const requestValidator = createRequestValidator(endpoint, api, operational)
    const ruleValidator = createRuleValidator(endpoint, api, operational)
    const handler = createHandler(endpoint, api, operational)

    app.route({
      method: method.toUpperCase() as any,
      url: endpoint.path,
      preHandler: [authHook, requestValidator, ruleValidator],
      handler,
    })
  }
}
`
}
