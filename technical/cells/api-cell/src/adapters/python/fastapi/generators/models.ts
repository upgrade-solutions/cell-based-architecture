import { CoreResource, Attribute } from '../../../../types'
import { toSnakeCase, toTableName, toSqlalchemyType } from './naming'

function columnLine(attr: Attribute): string {
  if (attr.name === 'id') return ''
  const saType = toSqlalchemyType(attr.type)
  const nullable = attr.required ? ', nullable=False' : ''
  return `    ${attr.name}: Mapped[${pythonMappedType(attr)}] = mapped_column(${saType}${nullable})`
}

function pythonMappedType(attr: Attribute): string {
  const map: Record<string, string> = {
    string: 'str',
    text: 'str',
    number: 'float',
    boolean: 'bool',
    date: 'date',
    datetime: 'datetime',
    enum: 'str',
    reference: 'str',
  }
  const base = map[attr.type] ?? 'str'
  return attr.required ? base : `Optional[${base}]`
}

function needsDateImport(attrs: Attribute[]): boolean {
  return attrs.some(a => a.type === 'date' || a.type === 'datetime')
}

export function generateModel(noun: CoreResource): string {
  const attrs = noun.attributes ?? []
  const tableName = toTableName(noun.name)
  const columns = attrs.filter((a: Attribute) => a.name !== 'id').map(columnLine)
  const hasDate = needsDateImport(attrs)
  const comment = noun.description ? `    """${noun.description}"""\n` : ''

  const imports = [
    `from __future__ import annotations`,
    `from typing import Optional`,
  ]
  if (hasDate) {
    imports.push(`from datetime import date, datetime`)
  }
  imports.push(
    `from sqlalchemy import ${collectSaTypes(attrs)}`,
    `from sqlalchemy.orm import Mapped, mapped_column`,
    `from app.database import Base`,
  )

  return `${imports.join('\n')}


class ${noun.name}(Base):
${comment}    __tablename__ = "${tableName}"

    id: Mapped[str] = mapped_column(String, primary_key=True)
${columns.join('\n')}
`
}

function collectSaTypes(attrs: Attribute[]): string {
  const types = new Set<string>(['String'])
  for (const attr of attrs) {
    if (attr.name === 'id') continue
    types.add(toSqlalchemyType(attr.type))
  }
  return [...types].sort().join(', ')
}

/** Generate the models __init__.py that re-exports all models */
export function generateModelsInit(nouns: CoreResource[]): string {
  const imports = nouns.map(n => `from app.models.${toSnakeCase(n.name)} import ${n.name}`)
  const all = nouns.map(n => `    "${n.name}",`)

  return `${imports.join('\n')}

__all__ = [
${all.join('\n')}
]
`
}
