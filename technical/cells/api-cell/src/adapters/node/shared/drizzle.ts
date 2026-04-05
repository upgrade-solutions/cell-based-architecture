import { Noun, Attribute } from '../../../types'
import { toTableName, toCamelCase } from '../../../utils'

const DRIZZLE_FN: Record<string, string> = {
  string: 'text',
  text: 'text',
  number: 'numeric',
  boolean: 'boolean',
  date: 'date',
  datetime: 'timestamp',
  enum: 'text',
  reference: 'text',
}

function drizzleFn(dnaType: string): string {
  return DRIZZLE_FN[dnaType] ?? 'text'
}

function columnExpr(attr: Attribute): string {
  const fn = drizzleFn(attr.type)
  const call =
    attr.type === 'datetime'
      ? `timestamp('${attr.name}', { withTimezone: true })`
      : `${fn}('${attr.name}')`

  const primaryKey = attr.name === 'id' ? '.primaryKey()' : ''
  const notNull = attr.required ? '.notNull()' : ''
  const enumComment =
    attr.type === 'enum' && attr.values?.length
      ? ` // ${attr.values.join(' | ')}`
      : ''

  return `  ${attr.name}: ${call}${primaryKey}${notNull},${enumComment}`
}

function tableBlock(noun: Noun): string {
  const tableName = toTableName(noun.name)
  const varName = toCamelCase(noun.name) + 's'
  const attrs = noun.attributes ?? []

  const columns = [
    ...attrs.map(columnExpr),
    `  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),`,
    `  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),`,
  ].join('\n')

  const comment = noun.description ? `// ${noun.description}\n` : ''
  return `${comment}export const ${varName} = pgTable('${tableName}', {\n${columns}\n})`
}

export function generateDrizzleSchema(nouns: Noun[]): string {
  const usedFns = new Set<string>(['timestamp'])
  for (const noun of nouns) {
    for (const attr of noun.attributes ?? []) {
      usedFns.add(drizzleFn(attr.type))
    }
  }

  const imports = [...usedFns].sort().join(', ')
  const tables = nouns.map(tableBlock).join('\n\n')

  return `import { pgTable, ${imports} } from 'drizzle-orm/pg-core'\n\n${tables}\n`
}

export function generateDbIndex(): string {
  return `import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
export const db = drizzle(pool, { schema })
`
}

export function generateDrizzleConfig(): string {
  return `import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
`
}
