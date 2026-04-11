export function generateStore(): string {
  return `import { dbCreate, dbFindById, dbFindAll, dbUpdate, dbSeed } from './drizzle-store'

// ── DataStore interface ─────────────────────────────────────────────────────

export interface DataStore {
  create(resource: string, entity: Record<string, any>): Promise<Record<string, any>>
  findById(resource: string, id: string): Promise<Record<string, any> | null>
  findAll(resource: string, filters: Record<string, string>, page: number, limit: number): Promise<{ data: any[]; total: number }>
  update(resource: string, id: string, updates: Record<string, any>): Promise<Record<string, any> | null>
}

// ── In-memory implementation ────────────────────────────────────────────────

const stores = new Map<string, Map<string, any>>()

function getMemStore(resource: string): Map<string, any> {
  if (!stores.has(resource)) stores.set(resource, new Map())
  return stores.get(resource)!
}

const memoryStore: DataStore = {
  async create(resource, entity) {
    getMemStore(resource).set(entity.id, entity)
    return entity
  },
  async findById(resource, id) {
    return getMemStore(resource).get(id) ?? null
  },
  async findAll(resource, filters, page, limit) {
    let items = Array.from(getMemStore(resource).values())
    for (const [key, val] of Object.entries(filters)) {
      items = items.filter((r: any) => String(r[key]) === val)
    }
    const start = (page - 1) * limit
    return { data: items.slice(start, start + limit), total: items.length }
  },
  async update(resource, id, updates) {
    const store = getMemStore(resource)
    const existing = store.get(id)
    if (!existing) return null
    const updated = { ...existing, ...updates }
    store.set(id, updated)
    return updated
  },
}

// ── Drizzle implementation ──────────────────────────────────────────────────

const drizzleStore: DataStore = {
  create: dbCreate,
  findById: dbFindById,
  findAll: dbFindAll,
  update: dbUpdate,
}

// ── Mode selection ──────────────────────────────────────────────────────────

const useDb = !!process.env.DATABASE_URL

export function getDataStore(): DataStore {
  return useDb ? drizzleStore : memoryStore
}

export function getStoreMode(): string {
  return useDb ? 'postgres' : 'in-memory'
}

// ── Seeding ─────────────────────────────────────────────────────────────────

/**
 * Controls whether Product Core DNA examples are loaded into the data store
 * on startup.
 *
 *   - In-memory mode (no DATABASE_URL): always seeds, because the in-memory
 *     store is ephemeral and has no other source of data.
 *   - Postgres mode (DATABASE_URL set): only seeds when SEED_EXAMPLES=true.
 *     Leaving it unset (or 'false') means the API returns real records from
 *     the database, not DNA mock records.
 */
const shouldSeedDb = process.env.SEED_EXAMPLES === 'true'

export async function seedFromProductCoreDna(core: any): Promise<void> {
  if (useDb && !shouldSeedDb) {
    console.log('[seed] skipped (SEED_EXAMPLES != true)')
    return
  }
  for (const noun of core?.nouns ?? []) {
    if (!noun.examples?.length) continue
    const key = noun.name.toLowerCase() + 's'

    if (useDb) {
      const now = new Date()
      const rows = noun.examples.map((ex: any) => {
        const row: Record<string, any> = { ...ex }
        for (const [k, val] of Object.entries(row)) {
          if (typeof val === 'string' && /^\\d{4}-\\d{2}-\\d{2}T/.test(val)) {
            row[k] = new Date(val)
          }
        }
        row.created_at = row.created_at ? new Date(row.created_at) : now
        row.updated_at = row.updated_at ? new Date(row.updated_at) : now
        return row
      })
      try {
        await dbSeed(key, rows)
      } catch (err: any) {
        console.error(\`[seed] \${noun.name} failed: \${err.message}\`)
        continue
      }
    } else {
      const store = getMemStore(key)
      for (const example of noun.examples) {
        if (example.id) store.set(example.id, { ...example })
      }
    }

    console.log(\`[seed] \${noun.name}: \${noun.examples.length} records\`)
  }
}
`
}
