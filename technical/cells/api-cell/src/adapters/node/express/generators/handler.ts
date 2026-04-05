export function generateHandler(): string {
  return `import { Request, Response } from 'express'
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
  capability: string,
  operational: any,
  body: Record<string, any>,
) {
  const effect = operational.effects?.find((e: any) => e.capability === capability)
  if (!effect) return
  for (const change of effect.changes) {
    const attr = change.attribute.split('.').pop()
    const val = resolveEffectSet(change.set, entity, body)
    if (val !== undefined) entity[attr] = val
  }
}

export function createHandler(endpoint: any, api: any, operational: any) {
  const [resource] = endpoint.operation.split('.')
  const resourceKey = resource.toLowerCase() + 's'
  const operation = api.operations?.find((op: any) => op.name === endpoint.operation)
  const capability = operation?.capability ?? endpoint.operation
  const kind = classifyEndpoint(endpoint)
  const queryParams = (endpoint.params ?? []).filter((p: any) => p.in === 'query')
  const store = getDataStore()

  return async (req: Request, res: Response) => {
    try {
      if (kind === 'create') {
        const now = new Date()
        const entity: Record<string, any> = {
          id: crypto.randomUUID(),
          ...req.body,
          created_at: now,
          updated_at: now,
        }
        applyEffects(entity, capability, operational, req.body)
        const created = await store.create(resourceKey, entity)
        return res.status(201).json(created)
      }

      if (kind === 'view') {
        const entity = await store.findById(resourceKey, req.params.id)
        if (!entity) {
          return res.status(404).json({ message: \`\${resource} \${req.params.id} not found\` })
        }
        return res.json(entity)
      }

      if (kind === 'list') {
        const filters: Record<string, string> = {}
        for (const qp of queryParams) {
          if (qp.name === 'page' || qp.name === 'limit') continue
          const val = req.query[qp.name] as string | undefined
          if (val) filters[qp.name] = val
        }
        const page = parseInt((req.query.page as string) ?? '1', 10)
        const limit = parseInt((req.query.limit as string) ?? '20', 10)
        const result = await store.findAll(resourceKey, filters, page, limit)
        return res.json(result)
      }

      if (kind === 'update') {
        const existing = await store.findById(resourceKey, req.params.id)
        if (!existing) {
          return res.status(404).json({ message: \`\${resource} \${req.params.id} not found\` })
        }
        const now = new Date()
        const merged = { ...existing, ...req.body, updated_at: now }
        applyEffects(merged, capability, operational, req.body)
        const updated = await store.update(resourceKey, req.params.id, merged)
        return res.json(updated)
      }
    } catch (err: any) {
      return res.status(500).json({ message: err.message })
    }
  }
}
`
}
