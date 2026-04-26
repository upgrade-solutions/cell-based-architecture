import { Resource, Endpoint, ApiOperation, Rule, CoreOperation, Namespace } from '../../../../types'
import { toSnakeCase, toPlural, toActionMethod } from './naming'

type OpKind = 'create' | 'view' | 'list' | 'update'

function classifyEndpoint(ep: Endpoint): OpKind {
  const hasIdParam = (ep.params ?? []).some(p => p.in === 'path' && p.name === 'id')
  if (ep.method === 'GET' && hasIdParam) return 'view'
  if (ep.method === 'GET') return 'list'
  if (!hasIdParam) return 'create'
  return 'update'
}

function findCoreOp(
  operationName: string,
  ops: CoreOperation[],
): CoreOperation | undefined {
  return ops.find(o => o.name === operationName)
}

function resolveEffectSet(set: unknown, entityVar: string): string | null {
  if (typeof set === 'number') return String(set)
  if (typeof set === 'boolean') return `${set ? 'True' : 'False'}`
  if (typeof set !== 'string') return null
  if (set === 'now') return 'datetime.utcnow().isoformat()'
  if (set === 'actor.id') return 'user.get("sub", "mock-user")'
  const addMatch = set.match(/^(\w+)\.(\w+)\s*\+\s*input\.(\w+)$/)
  if (addMatch) {
    const [, , entityField, inputField] = addMatch
    return `(${entityVar}.${toSnakeCase(entityField)} or 0) + body.${toSnakeCase(inputField)}`
  }
  if (/^[\w_-]+$/.test(set)) return `"${set}"`
  return null
}

function httpMethod(method: string): string {
  return method.toLowerCase()
}

function fastapiPath(epPath: string): string {
  // Express :param → FastAPI {param}
  return epPath.replace(/:(\w+)/g, '{$1}')
}

function buildCreateBody(
  ep: Endpoint,
  resource: Resource,
  operation: CoreOperation | undefined,
): string[] {
  const modelName = resource.name
  const entityFields = new Set(resource.fields.map(f => f.name))

  const lines: string[] = [
    `    attrs = body.model_dump(exclude_unset=True)`,
    `    attrs["id"] = str(uuid4())`,
  ]

  if (operation?.changes?.length) {
    for (const ch of operation.changes) {
      const attr = ch.attribute.split('.').pop()!
      if (!entityFields.has(attr)) continue
      const val = resolveEffectSet(ch.set, 'record')
      if (val !== null) lines.push(`    attrs["${attr}"] = ${val}`)
    }
  }

  lines.push(
    `    record = ${modelName}(**attrs)`,
    `    db.add(record)`,
    `    db.commit()`,
    `    db.refresh(record)`,
    `    return record`,
  )
  return lines
}

function buildViewBody(resource: Resource): string[] {
  return [
    `    record = db.query(${resource.name}).filter(${resource.name}.id == id).first()`,
    `    if not record:`,
    `        raise HTTPException(status_code=404, detail="Not found")`,
    `    return record`,
  ]
}

function buildListBody(ep: Endpoint, resource: Resource): string[] {
  const entityFields = new Set(resource.fields.map(f => f.name))
  const filterParams = (ep.params ?? []).filter(
    p => p.in === 'query' && p.name !== 'page' && p.name !== 'limit' && entityFields.has(p.name)
  )

  const lines = [`    query = db.query(${resource.name})`]
  for (const p of filterParams) {
    lines.push(`    if ${p.name} is not None:`)
    lines.push(`        query = query.filter(${resource.name}.${p.name} == ${p.name})`)
  }
  lines.push(
    `    total = query.count()`,
    `    records = query.offset((page - 1) * limit).limit(limit).all()`,
    `    return {"data": records, "total": total}`,
  )
  return lines
}

function buildUpdateBody(
  ep: Endpoint,
  resource: Resource,
  operation: CoreOperation | undefined,
): string[] {
  const entityFields = new Set(resource.fields.map(f => f.name))
  const varName = toSnakeCase(resource.name)

  const lines: string[] = [
    `    ${varName} = db.query(${resource.name}).filter(${resource.name}.id == id).first()`,
    `    if not ${varName}:`,
    `        raise HTTPException(status_code=404, detail="Not found")`,
  ]

  if (ep.request?.fields?.length) {
    lines.push(`    updates = body.model_dump(exclude_unset=True)`)
    lines.push(`    for key, value in updates.items():`)
    lines.push(`        setattr(${varName}, key, value)`)
  }

  if (operation?.changes?.length) {
    for (const ch of operation.changes) {
      const attr = ch.attribute.split('.').pop()!
      if (!entityFields.has(attr)) continue
      const val = resolveEffectSet(ch.set, varName)
      if (val !== null) lines.push(`    ${varName}.${attr} = ${val}`)
    }
  }

  lines.push(
    `    db.commit()`,
    `    db.refresh(${varName})`,
    `    return ${varName}`,
  )
  return lines
}

type AllowEntry = { role?: string; ownership?: boolean; flags?: string[] }

/** Render an AllowEntry as a Python dict literal. */
function pyAllowEntry(entry: AllowEntry): string {
  const parts: string[] = []
  if (entry.role) parts.push(`"role": "${entry.role}"`)
  if (entry.ownership) parts.push(`"ownership": True`)
  if (Array.isArray(entry.flags) && entry.flags.length > 0) {
    parts.push(`"flags": [${entry.flags.map(f => `"${f}"`).join(', ')}]`)
  }
  return `{${parts.join(', ')}}`
}

function buildRouteParams(
  ep: Endpoint,
  kind: OpKind,
  resource: Resource,
  requestClass: string | undefined,
  roles: string[],
  allowEntries: AllowEntry[],
): string {
  const params: string[] = []

  // Path params
  if (kind === 'view' || kind === 'update') {
    params.push(`id: str`)
  }

  // Query params for list
  if (kind === 'list') {
    const entityFields = new Set(resource.fields.map(f => f.name))
    const filterParams = (ep.params ?? []).filter(
      p => p.in === 'query' && p.name !== 'page' && p.name !== 'limit' && entityFields.has(p.name)
    )
    for (const p of filterParams) {
      params.push(`${p.name}: Optional[str] = None`)
    }
    params.push(`page: int = 1`)
    params.push(`limit: int = 20`)
  }

  // Request body
  if (requestClass && (kind === 'create' || kind === 'update')) {
    params.push(`body: ${requestClass}`)
  }

  // DB session
  params.push(`db: Session = Depends(get_db)`)

  // Auth dependency
  // Use require_allow when any entry has flags (need full structured entries);
  // fall back to require_roles for the simpler common case.
  const hasFlags = allowEntries.some(a => Array.isArray(a.flags) && a.flags.length > 0)
  if (hasFlags) {
    const entriesLiteral = allowEntries.map(pyAllowEntry).join(', ')
    params.push(`user: dict = Depends(require_allow([${entriesLiteral}]))`)
  } else if (roles.length) {
    params.push(`user: dict = Depends(require_roles(${roles.map(r => `"${r}"`).join(', ')}))`)
  } else {
    params.push(`user: dict = Depends(get_current_user)`)
  }

  return params.join(', ')
}

export function generateRouter(
  resource: Resource,
  endpoints: Endpoint[],
  _apiOperations: ApiOperation[],
  rules: Rule[],
  coreOperations: CoreOperation[],
  _namespace: Namespace,
): string {
  const routerVar = 'router'

  // Collect imports we'll need
  const needsDatetime = coreOperations.some(o =>
    (o.changes ?? []).some(c => c.set === 'now')
  )
  const needsUuid = endpoints.some(ep => classifyEndpoint(ep) === 'create')

  const extraImports: string[] = []
  if (needsDatetime) extraImports.push('from datetime import datetime')
  if (needsUuid) extraImports.push('from uuid import uuid4')

  // Collect request schema imports
  const schemaImports = new Set<string>()
  schemaImports.add(`${resource.name}Response`)
  schemaImports.add(`${resource.name}ListResponse`)
  for (const ep of endpoints) {
    if (ep.request?.fields?.length) {
      schemaImports.add(ep.request.name ?? `${ep.operation.replace('.', '')}Request`)
    }
  }

  const methods: string[] = []

  for (const ep of endpoints) {
    const action = ep.operation.split('.')[1]
    const methodName = toActionMethod(action)
    const op = findCoreOp(ep.operation, coreOperations)
    const kind = classifyEndpoint(ep)

    const accessRule = rules.find(r => r.operation === ep.operation && r.type === 'access')
    const allowEntries: AllowEntry[] = (accessRule?.allow ?? []) as AllowEntry[]
    const roles = allowEntries.map(a => a.role).filter((r): r is string => !!r)

    const path = fastapiPath(ep.path)
    const method = httpMethod(ep.method)
    const statusCode = kind === 'create' ? ', status_code=201' : ''

    const responseModel = kind === 'list'
      ? `${resource.name}ListResponse`
      : `${resource.name}Response`

    const requestClass = ep.request?.fields?.length
      ? (ep.request.name ?? `${ep.operation.replace('.', '')}Request`)
      : undefined

    const params = buildRouteParams(ep, kind, resource, requestClass, roles, allowEntries)

    let body: string[]
    if (kind === 'create') body = buildCreateBody(ep, resource, op)
    else if (kind === 'view') body = buildViewBody(resource)
    else if (kind === 'list') body = buildListBody(ep, resource)
    else body = buildUpdateBody(ep, resource, op)

    const docstring = ep.description ? `    """${ep.description}"""` : `    """${ep.operation}"""`

    methods.push(`
@${routerVar}.${method}("${path}"${statusCode}, response_model=${responseModel})
def ${methodName}(${params}):
${docstring}
${body.join('\n')}
`)
  }

  return `from typing import Optional
${extraImports.join('\n')}${extraImports.length ? '\n' : ''}
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user, require_roles, require_allow
from app.models.${toSnakeCase(resource.name)} import ${resource.name}
from app.schemas.${toSnakeCase(resource.name)} import ${[...schemaImports].join(', ')}

${routerVar} = APIRouter(tags=["${resource.name}"])
${methods.join('\n')}
`
}

/** Generate routers __init__.py that registers all routers */
export function generateRoutersInit(resources: Resource[], _namespace: Namespace): string {
  const imports = resources.map(r =>
    `from app.routers.${toPlural(r.name)} import router as ${toPlural(r.name)}_router`
  )
  const includes = resources.map(r =>
    `    app.include_router(${toPlural(r.name)}_router)`
  )

  return `${imports.join('\n')}


def register_routers(app):
${includes.join('\n')}
`
}
