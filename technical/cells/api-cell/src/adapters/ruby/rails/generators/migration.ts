import { CoreResource, Attribute } from '../../../../types'
import { toTableName, toRailsColumnType } from './naming'

function columnLine(attr: Attribute): string {
  if (attr.name === 'id') return '' // handled by primary key
  const colType = toRailsColumnType(attr.type)
  const nullable = attr.required ? ', null: false' : ''
  return `      t.${colType} :${attr.name}${nullable}`
}

export function generateMigration(nouns: CoreResource[], timestamp: string): string {
  const className = 'CreateDnaTables'
  const tableBlocks: string[] = []

  for (const noun of nouns) {
    const tableName = toTableName(noun.name)
    const attrs = (noun.attributes ?? []).filter((a: Attribute) => a.name !== 'id')
    const comment = noun.description ? `      # ${noun.description}` : ''

    const columns = attrs.map(columnLine).filter(Boolean)

    const block = [
      `    create_table :${tableName}, id: false do |t|`,
      `      t.string :id, null: false, primary_key: true`,
      ...(comment ? [comment] : []),
      ...columns,
      `      t.timestamps`,
      `    end`,
    ].join('\n')

    tableBlocks.push(block)
  }

  return `class ${className} < ActiveRecord::Migration[7.1]
  def change
${tableBlocks.join('\n\n')}
  end
end
`
}

/** Generate a migration filename: YYYYMMDDHHMMSS_create_dna_tables.rb */
export function migrationFileName(timestamp: string): string {
  return `${timestamp}_create_dna_tables.rb`
}
