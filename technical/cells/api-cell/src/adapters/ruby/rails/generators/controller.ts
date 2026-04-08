import { Resource, Endpoint, Operation, Rule, Outcome, Signal, Namespace } from '../../../../types'
import { resolveCapability } from '../../../../utils'
import { toSnakeCase, toPlural, toActionMethod } from './naming'

type OpKind = 'create' | 'view' | 'list' | 'update'

function classifyEndpoint(ep: Endpoint): OpKind {
  const hasIdParam = (ep.params ?? []).some(p => p.in === 'path' && p.name === 'id')
  if (ep.method === 'GET' && hasIdParam) return 'view'
  if (ep.method === 'GET') return 'list'
  if (!hasIdParam) return 'create'
  return 'update'
}

function resolveEffectSet(set: unknown, entityVar: string): string | null {
  if (typeof set === 'number') return String(set)
  if (typeof set === 'boolean') return String(set)
  if (typeof set !== 'string') return null
  if (set === 'now') return 'Time.current'
  if (set === 'actor.id') return "request.env['current_user']&.dig('sub') || 'mock-user'"
  const addMatch = set.match(/^(\w+)\.(\w+)\s*\+\s*input\.(\w+)$/)
  if (addMatch) {
    const [, , entityField, inputField] = addMatch
    return `(${entityVar}.${toSnakeCase(entityField)} || 0) + params[:${toSnakeCase(inputField)}].to_f`
  }
  if (/^[\w_-]+$/.test(set)) return `'${set}'`
  return null
}

function buildCreateBody(
  ep: Endpoint,
  resource: Resource,
  outcomes: Outcome[],
  capability: string,
  signals?: Signal[],
): string[] {
  const modelName = resource.name
  const entityFields = new Set(resource.fields.map(f => f.name))
  const dtoFields = (ep.request?.fields ?? []).filter(f => entityFields.has(f.name))
  const outcome = outcomes.find(o => o.capability === capability)

  const permitFields = (ep.request?.fields ?? []).map(f => `:${f.name}`)
  const lines: string[] = [
    `      attrs = params.permit(${permitFields.join(', ')})`,
    `      record = ${modelName}.new(attrs)`,
    `      record.id = SecureRandom.uuid`,
  ]

  if (outcome) {
    for (const ch of outcome.changes) {
      const attr = ch.attribute.split('.').pop()!
      if (!entityFields.has(attr)) continue
      const val = resolveEffectSet(ch.set, 'record')
      if (val !== null) lines.push(`      record.${attr} = ${val}`)
    }
  }

  const emitLines = buildEmitLines(outcome, signals)
  lines.push(
    `      if record.save`,
    ...emitLines.map(l => `  ${l}`),
    `        render json: record, status: :created`,
    `      else`,
    `        render json: { errors: record.errors.full_messages }, status: :unprocessable_entity`,
    `      end`,
  )
  return lines
}

function buildViewBody(resource: Resource): string[] {
  return [
    `      record = ${resource.name}.find(params[:id])`,
    `      render json: record`,
  ]
}

function buildListBody(ep: Endpoint, resource: Resource): string[] {
  const entityFields = new Set(resource.fields.map(f => f.name))
  const filterParams = (ep.params ?? []).filter(
    p => p.in === 'query' && p.name !== 'page' && p.name !== 'limit' && entityFields.has(p.name)
  )

  const lines = [`      records = ${resource.name}.all`]
  for (const p of filterParams) {
    lines.push(`      records = records.where(${p.name}: params[:${p.name}]) if params[:${p.name}].present?`)
  }
  lines.push(
    `      page = (params[:page] || 1).to_i`,
    `      limit = (params[:limit] || 20).to_i`,
    `      offset = (page - 1) * limit`,
    `      render json: { data: records.offset(offset).limit(limit), total: records.count }`,
  )
  return lines
}

function buildUpdateBody(
  ep: Endpoint,
  resource: Resource,
  outcomes: Outcome[],
  capability: string,
  signals?: Signal[],
): string[] {
  const entityFields = new Set(resource.fields.map(f => f.name))
  const dtoFields = (ep.request?.fields ?? []).filter(f => entityFields.has(f.name))
  const outcome = outcomes.find(o => o.capability === capability)
  const varName = toSnakeCase(resource.name)

  const permitFields = dtoFields.map(f => `:${f.name}`)
  const lines: string[] = [
    `      ${varName} = ${resource.name}.find(params[:id])`,
  ]

  if (permitFields.length) {
    lines.push(`      attrs = params.permit(${permitFields.join(', ')})`)
    lines.push(`      ${varName}.assign_attributes(attrs)`)
  }

  if (outcome) {
    for (const ch of outcome.changes) {
      const attr = ch.attribute.split('.').pop()!
      if (!entityFields.has(attr)) continue
      const val = resolveEffectSet(ch.set, varName)
      if (val !== null) lines.push(`      ${varName}.${attr} = ${val}`)
    }
  }

  const emitLines = buildEmitLines(outcome, signals, varName)
  lines.push(
    `      if ${varName}.save`,
    ...emitLines.map(l => `  ${l}`),
    `        render json: ${varName}`,
    `      else`,
    `        render json: { errors: ${varName}.errors.full_messages }, status: :unprocessable_entity`,
    `      end`,
  )
  return lines
}

function buildEmitLines(outcome: Outcome | undefined, signals?: Signal[], varName = 'record'): string[] {
  if (!outcome?.emits?.length) return []
  const lines: string[] = []
  for (const signalName of outcome.emits) {
    const signal = (signals ?? []).find(s => s.name === signalName)
    if (!signal) continue
    const payloadFields = signal.payload.map(f => `${f.name}: ${varName}.${f.name}`).join(', ')
    lines.push(`        EventBus.publish('${signalName}', { ${payloadFields} }) rescue nil`)
  }
  return lines
}

export function generateController(
  resource: Resource,
  endpoints: Endpoint[],
  operations: Operation[],
  rules: Rule[],
  outcomes: Outcome[],
  namespace: Namespace,
  signals?: Signal[],
): string {
  const className = `${resource.name}sController`
  const methods: string[] = []

  for (const ep of endpoints) {
    const action = ep.operation.split('.')[1]
    const methodName = toActionMethod(action)
    const capability = resolveCapability(ep.operation, operations)
    const kind = classifyEndpoint(ep)

    const accessRule = rules.find(r => r.capability === capability && r.type === 'access')
    const roles = accessRule?.allow?.map(a => a.role) ?? []
    const requiresOwnership = accessRule?.allow?.some(a => a.ownership) ?? false

    let body: string[]
    if (kind === 'create') body = buildCreateBody(ep, resource, outcomes, capability, signals)
    else if (kind === 'view') body = buildViewBody(resource)
    else if (kind === 'list') body = buildListBody(ep, resource)
    else body = buildUpdateBody(ep, resource, outcomes, capability, signals)

    const roleComment = roles.length ? `      # Roles: ${roles.join(', ')}` : null
    const ownerComment = requiresOwnership ? '      # Requires ownership' : null

    const lines: string[] = [
      `    # ${ep.operation}${ep.description ? `: ${ep.description}` : ''}`,
      `    def ${methodName}`,
    ]
    if (roleComment) lines.push(roleComment)
    if (ownerComment) lines.push(ownerComment)
    lines.push(...body)
    lines.push(`    end`)

    methods.push(lines.join('\n'))
  }

  const roleChecks: string[] = []
  for (const ep of endpoints) {
    const action = ep.operation.split('.')[1]
    const methodName = toActionMethod(action)
    const capability = resolveCapability(ep.operation, operations)
    const accessRule = rules.find(r => r.capability === capability && r.type === 'access')
    const roles = accessRule?.allow?.map(a => a.role) ?? []
    if (roles.length) {
      roleChecks.push(`    authorize_roles! ${roles.map(r => `'${r}'`).join(', ')}, only: [:${methodName}]`)
    }
  }

  return `class ${className} < ApplicationController
    before_action :authenticate!
${roleChecks.length ? roleChecks.join('\n') + '\n' : ''}
${methods.join('\n\n')}
  end
`
}
