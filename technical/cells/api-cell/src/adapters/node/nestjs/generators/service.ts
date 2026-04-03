import { Resource, Endpoint, Operation, Policy, Rule, Effect } from '../../../../types'
import { toCamelCase, resolveCapability } from '../../../../utils'
import { dtoClassName, dtoFileName } from './dto'
import { toFileName } from '../../../../utils'

function buildComment(
  operationName: string,
  capability: string,
  policies: Policy[],
  rules: Rule[],
  effects: Effect[],
): string[] {
  const lines: string[] = [`  // Operation: ${operationName}`]

  const policy = policies.find(p => p.capability === capability)
  const rule = rules.find(r => r.capability === capability)
  const effect = effects.find(e => e.capability === capability)

  if (!policy && !rule && !effect) return lines

  if (policy) {
    const roles = policy.allow.map(a => (a.ownership ? `${a.role} (owner)` : a.role)).join(', ')
    lines.push(`  // Policy:     ${roles}`)
  }

  if (rule?.conditions.length) {
    rule.conditions.forEach((c, i) => {
      const val = c.value !== undefined ? ` ${JSON.stringify(c.value)}` : ''
      const line = `${c.attribute} ${c.operator}${val}`
      lines.push(i === 0 ? `  // Rules:      ${line}` : `  //             ${line}`)
    })
  }

  if (effect?.changes.length) {
    effect.changes.forEach((ch, i) => {
      const line = `${ch.attribute} → ${JSON.stringify(ch.set)}`
      lines.push(i === 0 ? `  // Effects:    ${line}` : `  //             ${line}`)
    })
    if (effect.triggers?.length) {
      lines.push(`  //             triggers: ${effect.triggers.join(', ')}`)
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

export function generateService(
  resource: Resource,
  endpoints: Endpoint[],
  operations: Operation[],
  policies: Policy[],
  rules: Rule[],
  effects: Effect[],
): string {
  const className = `${resource.name}sService`
  const fileName = toFileName(resource.name)

  const dtosNeeded = endpoints
    .filter(ep => ep.request?.fields?.length)
    .map(ep => {
      const action = ep.operation.split('.')[1]
      return { action, resource: resource.name }
    })

  const dtoImports = dtosNeeded.map(
    ({ action, resource: res }) =>
      `import { ${dtoClassName(action, res)} } from './dto/${dtoFileName(action, res)}'`
  )

  const methods: string[] = []

  for (const ep of endpoints) {
    const capability = resolveCapability(ep.operation, operations)
    const comment = buildComment(ep.operation, capability, policies, rules, effects)
    const sig = methodSignature(ep, resource.name)

    methods.push([
      ...comment,
      `${sig} {`,
      `    throw new Error('not implemented')`,
      `  }`,
    ].join('\n'))
  }

  return [
    `import { Injectable } from '@nestjs/common'`,
    ...dtoImports,
    '',
    `@Injectable()`,
    `export class ${className} {`,
    '',
    methods.join('\n\n'),
    '}',
    '',
  ].join('\n')
}
