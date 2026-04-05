export function generateSeed(): string {
  return `import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './db/schema'

const DNA_OPS = path.resolve(__dirname, 'dna/operational.json')

async function seed() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set')
    process.exit(1)
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const db = drizzle(pool, { schema })
  const operational = JSON.parse(fs.readFileSync(DNA_OPS, 'utf-8'))

  // Build table lookup from schema exports
  const tables: Record<string, any> = {}
  for (const [key, value] of Object.entries(schema)) {
    if (value && typeof value === 'object' && 'getSQL' in (value as any)) {
      tables[key] = value
    }
  }

  async function walk(domain: any) {
    for (const noun of domain.nouns ?? []) {
      if (noun.examples?.length) {
        const key = noun.name.toLowerCase() + 's'
        const table = tables[key]
        if (!table) {
          console.log(\`[seed] skipping \${noun.name} — no table "\${key}"\`)
          continue
        }
        const now = new Date().toISOString()
        const rows = noun.examples.map((ex: any) => ({
          ...ex,
          created_at: ex.created_at ?? now,
          updated_at: ex.updated_at ?? now,
        }))
        await db.insert(table).values(rows).onConflictDoNothing()
        console.log(\`[seed] \${noun.name}: \${noun.examples.length} records\`)
      }
    }
    for (const sub of domain.domains ?? []) await walk(sub)
  }

  if (operational?.domain) await walk(operational.domain)

  await pool.end()
  console.log('[seed] done')
}

seed().catch(err => {
  console.error(err)
  process.exit(1)
})
`
}
