export function generateHandler(): string {
  return `import { FastifyRequest, FastifyReply } from 'fastify'
import { getDataStore } from './store'

type OpKind = 'create' | 'view' | 'list' | 'update'

function classifyEndpoint(endpoint: any): OpKind {
  const hasIdParam = (endpoint.params ?? []).some((p: any) => p.in === 'path' && p.name === 'id')
  if (endpoint.method === 'GET' && hasIdParam) return 'view'
  if (endpoint.method === 'GET') return 'list'
  if (!hasIdParam) return 'create'
  return 'update'
}

function resolveEffectSet(
  set: unknown,
  entity: Record<string, any>,
  body: Record<string, any>,
): unknown {
  if (typeof set === 'number' || typeof set === 'boolean') return set
  if (typeof set !== 'string') return undefined
  if (set === 'now') return new Date()
  if (set === 'actor.id') return 'mock-user'
  const addMatch = set.match(/^(\\w+)\\.(\\w+)\\s*\\+\\s*input\\.(\\w+)$/)
  if (addMatch) {
    const [, , entityField, inputField] = addMatch
    return (entity[entityField] ?? 0) + body[inputField]
  }
  if (/^[\\w_-]+$/.test(set)) return set
  return undefined
}

function applyEffects(
  entity: Record<string, any>,
  operationName: string,
  core: any,
  body: Record<string, any>,
) {
  const operation = (core.operations ?? []).find((o: any) => o.name === operationName)
  if (!operation?.changes?.length) return
  for (const change of operation.changes) {
    const attr = change.attribute.split('.').pop()
    const val = resolveEffectSet(change.set, entity, body)
    if (val !== undefined) entity[attr] = val
  }
}

function checkOwnership(req: FastifyRequest, entity: Record<string, any>): boolean {
  if (!(req as any).requiresOwnership) return true
  const user = (req as any).user
  if (!user?.sub) return false
  const ownerFields = ['user_id', 'owner_id', 'borrower_id', 'created_by']
  return ownerFields.some(f => entity[f] && entity[f] === user.sub)
}

// Resource key matches the schema export name from drizzle.ts:
// PascalCase resource name → camelCase + 's' (IntakeSubmission → intakeSubmissions).
const toResourceKey = (n: string) => n.charAt(0).toLowerCase() + n.slice(1) + 's'

export function createHandler(endpoint: any, api: any, core: any) {
  const [resource] = endpoint.operation.split('.')
  const resourceKey = toResourceKey(resource)
  const operationName = endpoint.operation
  const kind = classifyEndpoint(endpoint)
  const queryParams = (endpoint.params ?? []).filter((p: any) => p.in === 'query')
  const store = getDataStore()

  return async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = (req.params as Record<string, string> | undefined) ?? {}
      const query = (req.query as Record<string, string> | undefined) ?? {}
      const body = (req.body as Record<string, any> | undefined) ?? {}

      if (kind === 'create') {
        const now = new Date()
        const entity: Record<string, any> = {
          id: crypto.randomUUID(),
          ...body,
          created_at: now,
          updated_at: now,
        }
        applyEffects(entity, operationName, core, body)
        const created = await store.create(resourceKey, entity)
        return reply.code(201).send(created)
      }

      if (kind === 'view') {
        const entity = await store.findById(resourceKey, params.id)
        if (!entity) {
          return reply.code(404).send({ message: \`\${resource} \${params.id} not found\` })
        }
        if (!checkOwnership(req, entity)) {
          return reply.code(403).send({ message: 'Forbidden' })
        }
        return reply.send(entity)
      }

      if (kind === 'list') {
        const filters: Record<string, string> = {}
        for (const qp of queryParams) {
          if (qp.name === 'page' || qp.name === 'limit') continue
          const val = query[qp.name]
          if (val) filters[qp.name] = val
        }
        const page = parseInt(query.page ?? '1', 10)
        const limit = parseInt(query.limit ?? '20', 10)
        const result = await store.findAll(resourceKey, filters, page, limit)
        return reply.send(result)
      }

      if (kind === 'update') {
        const existing = await store.findById(resourceKey, params.id)
        if (!existing) {
          return reply.code(404).send({ message: \`\${resource} \${params.id} not found\` })
        }
        if (!checkOwnership(req, existing)) {
          return reply.code(403).send({ message: 'Forbidden' })
        }
        const now = new Date()
        const merged = { ...existing, ...body, updated_at: now }
        applyEffects(merged, operationName, core, body)
        const updated = await store.update(resourceKey, params.id, merged)
        return reply.send(updated)
      }
    } catch (err: any) {
      return reply.code(500).send({ message: err.message })
    }
  }
}
`
}
