import { Endpoint, Field } from '../../../../types'
import { toKebabCase, toCamelCase } from '../../../../utils'

const VALIDATOR_DECORATOR: Record<string, string[]> = {
  string: ['@IsString()'],
  text: ['@IsString()'],
  number: ['@IsNumber()'],
  boolean: ['@IsBoolean()'],
  date: ['@IsDateString()'],
  datetime: ['@IsDateString()'],
  enum: [], // handled separately via @IsIn
  reference: ['@IsString()'],
}

const TS_TYPE: Record<string, string> = {
  string: 'string',
  text: 'string',
  number: 'number',
  boolean: 'boolean',
  date: 'string',
  datetime: 'string',
  enum: 'string',
  reference: 'string',
}

export function dtoClassName(action: string, resource: string): string {
  return `${action}${resource}Dto`
}

export function dtoFileName(action: string, resource: string): string {
  return `${toKebabCase(action)}-${toKebabCase(resource)}.dto`
}

function fieldLines(field: Field): string[] {
  const decorators: string[] = []

  if (!field.required) decorators.push('@IsOptional()')

  if (field.type === 'enum' && field.values?.length) {
    decorators.push(`@IsIn([${field.values.map(v => `'${v}'`).join(', ')}])`)
  } else {
    decorators.push(...(VALIDATOR_DECORATOR[field.type] ?? ['@IsString()']))
  }

  const tsType = TS_TYPE[field.type] ?? 'string'
  const optional = field.required ? '' : '?'
  const prop = `  ${field.name}${optional}: ${tsType}`

  return [...decorators.map(d => `  ${d}`), prop]
}

export function generateDto(endpoint: Endpoint, resource: string): string | null {
  if (!endpoint.request?.fields?.length) return null

  const action = endpoint.operation.split('.')[1]
  const className = dtoClassName(action, resource)

  const usedDecorators = new Set<string>()
  const allLines: string[] = []

  for (const field of endpoint.request.fields) {
    const lines = fieldLines(field)
    for (const line of lines) {
      if (line.trim().startsWith('@')) {
        const name = line.trim().replace(/[(@)].*/g, '').replace('@', '')
        usedDecorators.add(name.split('(')[0].replace('@', ''))
      }
    }
    allLines.push(...lines, '')
  }

  // Collect decorator names from the fields
  const needed = new Set<string>()
  for (const field of endpoint.request.fields) {
    if (!field.required) needed.add('IsOptional')
    if (field.type === 'enum') {
      needed.add('IsIn')
    } else {
      const decoratorNames = (VALIDATOR_DECORATOR[field.type] ?? ['@IsString()']).map(d =>
        d.replace('@', '').replace('()', '')
      )
      decoratorNames.forEach(n => needed.add(n))
    }
  }
  needed.add('IsOptional')

  const importLine = `import { ${[...needed].sort().join(', ')} } from 'class-validator'`

  const body = allLines.join('\n').replace(/\n$/, '')

  return `${importLine}

export class ${className} {
${body}
}
`
}
