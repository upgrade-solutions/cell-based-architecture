// The OpenAPI builder is framework-agnostic — it walks api.endpoints and
// core.rules to produce an OpenAPI 3.0 document. Identical between the
// express and fastify adapters; re-export to keep them in sync.
export { generateOpenApi } from '../../express/generators/openapi'
