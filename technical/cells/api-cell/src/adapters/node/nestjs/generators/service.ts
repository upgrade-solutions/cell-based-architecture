import { Resource, Endpoint, Operation, Rule, Outcome } from '../../../../types'
import { toCamelCase, resolveCapability } from '../../../../utils'
import { dtoClassName, dtoFileName } from './dto'
import { toFileName } from '../../../../utils'

type OpKind = 'create' | 'view' | 'list' | 'update'

function classifyEndpoint(ep: Endpoint): OpKind {
  const hasIdParam = (ep.params ?? []).some(p => p.in === 'path' && p.name === 'id')
  if (ep.method === 'GET' && hasIdParam) return 'view'
  if (ep.method === 'GET') return 'list'
  if (!hasIdParam) return 'create'
  return 'update'
}

function mapFieldType(type: string): string {
  if (type === 'number') return 'number'
  if (type === 'boolean') return 'boolean'
  return 'string'
}

function resolveEffectSet(
  set: unknown,
  entityVarName: string,
): string | null {
  if (typeof set === 'number') return String(set)
  if (typeof set === 'boolean') return String(set)
  if (typeof set !== 'string') return null
  if (set === 'now') return 'now'
  if (set === 'actor.id') return `'mock-user'`
  // Handle additive expression: "entity.field + input.field"
  const addMatch = set.match(/^(\w+)\.(\w+)\s*\+\s*input\.(\w+)$/)
  if (addMatch) {
    const [, , entityField, inputField] = addMatch
    return `(${entityVarName}.${entityField} ?? 0) + dto.${inputField}`
  }
  // Plain string literal (no dots or operators)
  if (/^[\w_-]+$/.test(set)) return `'${set}'`
  return null
}

function generateInterface(resource: Resource): string {
  const fieldNames = new Set(resource.fields.map(f => f.name))
  const lines = resource.fields.map(f => {
    const opt = f.required ? '' : '?'
    return `  ${f.name}${opt}: ${mapFieldType(f.type)}`
  })
  if (!fieldNames.has('created_at')) lines.push('  created_at: string')
  if (!fieldNames.has('updated_at')) lines.push('  updated_at: string')
  return `export interface ${resource.name} {\n${lines.join('\n')}\n}`
}

function buildComment(
  operationName: string,
  capability: string,
  rules: Rule[],
  outcomes: Outcome[],
): string[] {
  const lines: string[] = [`  // Operation: ${operationName}`]
  const accessRule = rules.find(r => r.capability === capability && r.type === 'access')
  const conditionRule = rules.find(r => r.capability === capability && r.type !== 'access')
  const outcome = outcomes.find(o => o.capability === capability)
  if (!accessRule && !conditionRule && !outcome) return lines
  if (accessRule) {
    const roles = (accessRule.allow ?? []).map(a => (a.ownership ? `${a.role} (owner)` : a.role)).join(', ')
    lines.push(`  // Access:     ${roles}`)
  }
  if (conditionRule?.conditions?.length) {
    conditionRule.conditions.forEach((c, i) => {
      const val = c.value !== undefined ? ` ${JSON.stringify(c.value)}` : ''
      const line = `${c.attribute} ${c.operator}${val}`
      lines.push(i === 0 ? `  // Rules:      ${line}` : `  //             ${line}`)
    })
  }
  if (outcome?.changes.length) {
    outcome.changes.forEach((ch, i) => {
      const line = `${ch.attribute} → ${JSON.stringify(ch.set)}`
      lines.push(i === 0 ? `  // Outcome:    ${line}` : `  //             ${line}`)
    })
    if (outcome.initiates?.length) {
      lines.push(`  //             initiates: ${outcome.initiates.join(', ')}`)
    }
  }
  return lines
}

function methodSignature(ep: Endpoint, resource: string): string {
  const action = ep.operation.split('.')[1]
  const methodName = toCamelCase(action)
  const pathParams = (ep.params ?? []).filter(p => p.in === 'path')
  const queryParams = (ep.params ?? []).filter(p => p.in === 'query')
  const hasDtoBody = !!ep.request?.fields?.length
  const params: string[] = [
    ...pathParams.map(p => `${p.name}: string`),
    ...(queryParams.length
      ? [`filters: { ${queryParams.map(p => `${p.name}?: string`).join('; ')} }`]
      : []),
    ...(hasDtoBody ? [`dto: ${dtoClassName(action, resource)}`] : []),
  ]
  return `  async ${methodName}(${params.join(', ')}): Promise<any>`
}

function buildCreateBody(
  ep: Endpoint,
  resource: Resource,
  outcomes: Outcome[],
  capability: string,
): string[] {
  const varName = resource.name.toLowerCase()
  const entityFieldNames = new Set(resource.fields.map(f => f.name))
  const dtoFields = (ep.request?.fields ?? []).filter(f => entityFieldNames.has(f.name))
  const outcome = outcomes.find(o => o.capability === capability)

  const lines: string[] = [
    '    const now = new Date().toISOString()',
    `    const entity: ${resource.name} = {`,
    '      id: crypto.randomUUID(),',
    ...dtoFields.map(f => `      ${f.name}: dto.${f.name},`),
  ]

  if (outcome) {
    for (const ch of outcome.changes) {
      const attr = ch.attribute.split('.').pop()!
      if (!entityFieldNames.has(attr)) continue
      const val = resolveEffectSet(ch.set, varName)
      if (val !== null) lines.push(`      ${attr}: ${val},`)
    }
  }

  lines.push('      created_at: now,', '      updated_at: now,', '    }')
  lines.push(`    store.set(entity.id, entity)`, `    return entity`)
  return lines
}

function buildViewBody(resource: Resource): string[] {
  const varName = resource.name.toLowerCase()
  return [
    `    const ${varName} = store.get(id)`,
    `    if (!${varName}) throw new NotFoundException(\`${resource.name} \${id} not found\`)`,
    `    return ${varName}`,
  ]
}

function buildListBody(ep: Endpoint, resource: Resource): string[] {
  const entityFieldNames = new Set(resource.fields.map(f => f.name))
  const filterParams = (ep.params ?? []).filter(
    p => p.in === 'query' && p.name !== 'page' && p.name !== 'limit' && entityFieldNames.has(p.name)
  )
  const lines = [`    let items = Array.from(store.values())`]
  for (const p of filterParams) {
    lines.push(`    if (filters.${p.name}) items = items.filter(r => r.${p.name} === filters.${p.name})`)
  }
  lines.push(
    `    const page = parseInt(filters.page ?? '1', 10)`,
    `    const limit = parseInt(filters.limit ?? '20', 10)`,
    `    const start = (page - 1) * limit`,
    `    return { data: items.slice(start, start + limit), total: items.length }`,
  )
  return lines
}

function buildUpdateBody(
  ep: Endpoint,
  resource: Resource,
  outcomes: Outcome[],
  capability: string,
): string[] {
  const varName = resource.name.toLowerCase()
  const entityFieldNames = new Set(resource.fields.map(f => f.name))
  const dtoFields = (ep.request?.fields ?? []).filter(f => entityFieldNames.has(f.name))
  const outcome = outcomes.find(o => o.capability === capability)

  const lines: string[] = [
    `    const ${varName} = store.get(id)`,
    `    if (!${varName}) throw new NotFoundException(\`${resource.name} \${id} not found\`)`,
    `    const now = new Date().toISOString()`,
    `    const updates: Partial<${resource.name}> = { updated_at: now }`,
    ...dtoFields.map(f => `    updates.${f.name} = dto.${f.name}`),
  ]

  if (outcome) {
    for (const ch of outcome.changes) {
      const attr = ch.attribute.split('.').pop()!
      if (!entityFieldNames.has(attr)) continue
      const val = resolveEffectSet(ch.set, varName)
      if (val !== null) lines.push(`    updates.${attr} = ${val}`)
    }
  }

  lines.push(
    `    const updated = { ...${varName}, ...updates }`,
    `    store.set(id, updated)`,
    `    return updated`,
  )
  return lines
}

export function generateService(
  resource: Resource,
  endpoints: Endpoint[],
  operations: Operation[],
  rules: Rule[],
  outcomes: Outcome[],
): string {
  const className = `${resource.name}sService`
  const dtosNeeded = endpoints
    .filter(ep => ep.request?.fields?.length)
    .map(ep => ({ action: ep.operation.split('.')[1], resource: resource.name }))

  const dtoImports = dtosNeeded.map(
    ({ action, resource: res }) =>
      `import { ${dtoClassName(action, res)} } from './dto/${dtoFileName(action, res)}'`
  )

  const methods: string[] = []
  for (const ep of endpoints) {
    const capability = resolveCapability(ep.operation, operations)
    const comment = buildComment(ep.operation, capability, rules, outcomes)
    const sig = methodSignature(ep, resource.name)
    const kind = classifyEndpoint(ep)

    let body: string[]
    if (kind === 'create') body = buildCreateBody(ep, resource, outcomes, capability)
    else if (kind === 'view') body = buildViewBody(resource)
    else if (kind === 'list') body = buildListBody(ep, resource)
    else body = buildUpdateBody(ep, resource, outcomes, capability)

    methods.push([...comment, `${sig} {`, ...body, '  }'].join('\n'))
  }

  const iface = generateInterface(resource)

  return [
    `import { Injectable, NotFoundException } from '@nestjs/common'`,
    ...dtoImports,
    '',
    iface,
    '',
    `const store = new Map<string, ${resource.name}>()`,
    '',
    `@Injectable()`,
    `export class ${className} {`,
    '',
    methods.join('\n\n'),
    '}',
    '',
  ].join('\n')
}
