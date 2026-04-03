export function generateHandler(): string {
  return `import { Request, Response } from 'express'
import { getStore } from './store'

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
  if (set === 'now') return new Date().toISOString()
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

  return async (req: Request, res: Response) => {
    const store = getStore(resourceKey)

    try {
      if (kind === 'create') {
        const now = new Date().toISOString()
        const entity: Record<string, any> = {
          id: crypto.randomUUID(),
          ...req.body,
          created_at: now,
          updated_at: now,
        }
        applyEffects(entity, capability, operational, req.body)
        store.set(entity.id, entity)
        return res.status(201).json(entity)
      }

      if (kind === 'view') {
        const entity = store.get(req.params.id)
        if (!entity) {
          return res.status(404).json({ message: \`\${resource} \${req.params.id} not found\` })
        }
        return res.json(entity)
      }

      if (kind === 'list') {
        let items = Array.from(store.values())
        for (const qp of queryParams) {
          if (qp.name === 'page' || qp.name === 'limit') continue
          const val = req.query[qp.name] as string | undefined
          if (val) items = items.filter((r: any) => String(r[qp.name]) === val)
        }
        const page = parseInt((req.query.page as string) ?? '1', 10)
        const limit = parseInt((req.query.limit as string) ?? '20', 10)
        const start = (page - 1) * limit
        return res.json({ data: items.slice(start, start + limit), total: items.length })
      }

      if (kind === 'update') {
        const entity = store.get(req.params.id)
        if (!entity) {
          return res.status(404).json({ message: \`\${resource} \${req.params.id} not found\` })
        }
        const now = new Date().toISOString()
        const updated = { ...entity, ...req.body, updated_at: now }
        applyEffects(updated, capability, operational, req.body)
        store.set(req.params.id, updated)
        return res.json(updated)
      }
    } catch (err: any) {
      return res.status(500).json({ message: err.message })
    }
  }
}
`
}
