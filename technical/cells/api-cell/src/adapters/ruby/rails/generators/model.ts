import { CoreResource, Attribute } from '../../../../types'
import { toSnakeCase } from './naming'

function validationLines(attrs: Attribute[]): string[] {
  const lines: string[] = []
  for (const attr of attrs) {
    if (attr.name === 'id') continue
    if (attr.required) {
      lines.push(`  validates :${attr.name}, presence: true`)
    }
    if (attr.type === 'enum' && attr.values?.length) {
      lines.push(`  validates :${attr.name}, inclusion: { in: [${attr.values.map(v => `'${v}'`).join(', ')}] }, allow_nil: ${attr.required ? 'false' : 'true'}`)
    }
  }
  return lines
}

export function generateModel(noun: CoreResource): string {
  const attrs = noun.attributes ?? []
  const validations = validationLines(attrs)
  const comment = noun.description ? `# ${noun.description}\n` : ''

  return `${comment}class ${noun.name} < ApplicationRecord
  self.primary_key = 'id'
${validations.length ? '\n' + validations.join('\n') + '\n' : ''}end
`
}
