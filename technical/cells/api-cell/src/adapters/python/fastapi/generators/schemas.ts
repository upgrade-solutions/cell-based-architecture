import { Resource, Endpoint, Field } from '../../../../types'
import { toSnakeCase, toPythonType } from './naming'

function fieldLine(field: Field, forRequest: boolean): string {
  const pyType = toPythonType(field.type)
  if (field.type === 'enum' && field.values?.length) {
    const enumValues = field.values.map(v => `"${v}"`).join(', ')
    const annotation = field.required && forRequest ? `str` : `Optional[str]`
    const default_ = field.required && forRequest ? '' : ' = None'
    return `    ${field.name}: ${annotation}${default_}  # enum: ${enumValues}`
  }
  if (field.required && forRequest) {
    return `    ${field.name}: ${pyType}`
  }
  return `    ${field.name}: Optional[${pyType}] = None`
}

function needsDateImport(fields: Field[]): boolean {
  return fields.some(f => f.type === 'date' || f.type === 'datetime')
}

export function generateResourceSchemas(
  resource: Resource,
  endpoints: Endpoint[],
): string {
  const allFields = resource.fields
  const requestFields = endpoints.flatMap(ep => ep.request?.fields ?? [])
  const hasDate = needsDateImport(allFields) || needsDateImport(requestFields)

  const imports = [
    `from __future__ import annotations`,
    `from typing import Optional`,
  ]
  if (hasDate) {
    imports.push(`from datetime import date, datetime`)
  }
  imports.push(`from pydantic import BaseModel`)

  const classes: string[] = []

  // Response schema — all fields, all optional except id
  const responseFields = allFields.map(f => {
    const pyType = toPythonType(f.type)
    return f.name === 'id'
      ? `    id: str`
      : `    ${f.name}: Optional[${pyType}] = None`
  })
  classes.push(`
class ${resource.name}Response(BaseModel):
    model_config = {"from_attributes": True}

${responseFields.join('\n')}
`)

  // Per-endpoint request schemas
  for (const ep of endpoints) {
    if (!ep.request?.fields?.length) continue
    const reqFields = ep.request.fields
    const hasReqDate = needsDateImport(reqFields)
    const lines = reqFields.map(f => fieldLine(f, true))
    const className = ep.request.name ?? `${ep.operation.replace('.', '')}Request`
    classes.push(`
class ${className}(BaseModel):
${lines.join('\n')}
`)
  }

  // List response wrapper
  classes.push(`
class ${resource.name}ListResponse(BaseModel):
    data: list[${resource.name}Response]
    total: int
`)

  return `${imports.join('\n')}
${classes.join('\n')}
`
}

/** Generate schemas __init__.py */
export function generateSchemasInit(resources: Resource[]): string {
  const imports = resources.map(r =>
    `from app.schemas.${toSnakeCase(r.name)} import *`
  )
  return `${imports.join('\n')}\n`
}
