export function generateDbConnection(): string {
  return `import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
export const db = drizzle(pool, { schema })
`
}

export function generateDrizzleStore(): string {
  return `import { eq, sql } from 'drizzle-orm'
import { db } from '../db'
import * as schema from '../db/schema'

// Build a lookup from resource key (e.g. 'loans') to Drizzle table object
const tables: Record<string, any> = {}
for (const [key, value] of Object.entries(schema)) {
  if (value && typeof value === 'object' && 'getSQL' in (value as any)) {
    tables[key] = value
  }
}

function resolveTable(resource: string): any {
  const table = tables[resource]
  if (!table) throw new Error(\`No database table for resource: \${resource}\`)
  return table
}

export async function dbCreate(resource: string, entity: Record<string, any>): Promise<Record<string, any>> {
  const table = resolveTable(resource)
  const rows = await db.insert(table).values(entity).returning()
  return (rows as any[])[0]
}

export async function dbFindById(resource: string, id: string): Promise<Record<string, any> | null> {
  const table = resolveTable(resource)
  const rows = await db.select().from(table).where(eq(table.id, id)).limit(1)
  return (rows as any[])[0] ?? null
}

export async function dbFindAll(
  resource: string,
  filters: Record<string, string>,
  page: number,
  limit: number,
): Promise<{ data: any[]; total: number }> {
  const table = resolveTable(resource)

  let query: any = db.select().from(table)
  let countQuery: any = db.select({ count: sql\`count(*)::int\` }).from(table)

  for (const [key, val] of Object.entries(filters)) {
    if (table[key]) {
      query = query.where(eq(table[key], val))
      countQuery = countQuery.where(eq(table[key], val))
    }
  }

  const offset = (page - 1) * limit
  const data = await query.limit(limit).offset(offset)
  const countRows = await countQuery
  return { data, total: (countRows as any[])[0]?.count ?? 0 }
}

export async function dbUpdate(
  resource: string,
  id: string,
  updates: Record<string, any>,
): Promise<Record<string, any> | null> {
  const table = resolveTable(resource)
  const rows = await db.update(table).set(updates).where(eq(table.id, id)).returning()
  return (rows as any[])[0] ?? null
}

export async function dbSeed(resource: string, entities: Record<string, any>[]): Promise<void> {
  const table = resolveTable(resource)
  if (!entities.length) return
  await db.insert(table).values(entities).onConflictDoNothing()
}
`
}
