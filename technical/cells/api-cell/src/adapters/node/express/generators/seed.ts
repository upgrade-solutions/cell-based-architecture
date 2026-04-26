export function generateSeed(): string {
  return `import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './db/schema'

const DNA_CORE = path.resolve(__dirname, 'dna/product.core.json')

async function seed() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set')
    process.exit(1)
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const db = drizzle(pool, { schema })
  const core = JSON.parse(fs.readFileSync(DNA_CORE, 'utf-8'))

  // Build table lookup from schema exports
  const tables: Record<string, any> = {}
  for (const [key, value] of Object.entries(schema)) {
    if (value && typeof value === 'object' && 'getSQL' in (value as any)) {
      tables[key] = value
    }
  }

  // Resource key matches the schema export name produced by drizzle.ts:
  // PascalCase noun name → camelCase + 's' (e.g. IntakeSubmission → intakeSubmissions).
  const toResourceKey = (n: string) => n.charAt(0).toLowerCase() + n.slice(1) + 's'

  for (const resource of core?.resources ?? []) {
    if (!resource.examples?.length) continue
    const key = toResourceKey(resource.name)
    const table = tables[key]
    if (!table) {
      console.log(\`[seed] skipping \${resource.name} — no table "\${key}"\`)
      continue
    }
    const now = new Date()
    const rows = resource.examples.map((ex: any) => {
      const row: Record<string, any> = { ...ex }
      // Convert ISO date strings to Date objects for timestamp columns
      for (const [k, val] of Object.entries(row)) {
        if (typeof val === 'string' && /^\\d{4}-\\d{2}-\\d{2}T/.test(val)) {
          row[k] = new Date(val)
        }
      }
      row.created_at = row.created_at ? new Date(row.created_at) : now
      row.updated_at = row.updated_at ? new Date(row.updated_at) : now
      return row
    })
    await db.insert(table).values(rows).onConflictDoNothing()
    console.log(\`[seed] \${resource.name}: \${resource.examples.length} records\`)
  }

  await pool.end()
  console.log('[seed] done')
}

seed().catch(err => {
  console.error(err)
  process.exit(1)
})
`
}
