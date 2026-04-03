import { OperationalDNA, Noun, Attribute, Domain } from '../../../../types'

// ── Seed data pools ───────────────────────────────────────────────────────────

const FIRST_NAMES = ['Alice', 'Bob', 'Carol', 'David', 'Eva']
const LAST_NAMES  = ['Smith', 'Johnson', 'Williams', 'Brown', 'Davis']
const PURPOSES    = ['Home renovation', 'Business capital', 'Education', 'Medical expenses', 'Debt consolidation']
const DATES       = ['2025-06-15', '2025-12-31', '2026-03-20', '2025-09-01', '2026-01-10']
const DOB_DATES   = ['1985-04-12', '1990-07-23', '1978-11-05', '1995-02-28', '1982-08-17']
const DATETIMES   = ['2024-11-01T10:30:00Z', '2024-10-15T14:20:00Z', '2024-09-28T09:00:00Z', '2024-12-03T16:45:00Z', '2025-01-07T08:15:00Z']
const AMOUNTS     = [15000, 8500, 25000, 12000, 50000]
const INCOMES     = [65000, 82000, 95000, 48000, 110000]
const SCORES      = [720, 680, 760, 640, 800]
const RATES       = [0.085, 0.072, 0.095, 0.068, 0.110]
const TERMS       = [24, 12, 36, 18, 60]

// ── Value generator ───────────────────────────────────────────────────────────

function stubValue(attr: Attribute, nounName: string, index: number): unknown {
  const n = attr.name.toLowerCase()

  // Enum — cycle through declared values
  if (attr.type === 'enum' && attr.values?.length) {
    return attr.values[index % attr.values.length]
  }

  // ID and foreign key references
  if (n === 'id') return `${nounName.toLowerCase()}-${index + 1}`
  if (n.endsWith('_id')) {
    const ref = n.slice(0, -3)
    return `${ref}-${(index % 3) + 1}`
  }

  // Named string patterns
  if (n === 'first_name') return FIRST_NAMES[index % FIRST_NAMES.length]
  if (n === 'last_name')  return LAST_NAMES[index % LAST_NAMES.length]
  if (n === 'email')      return `${FIRST_NAMES[index % FIRST_NAMES.length].toLowerCase()}.${LAST_NAMES[index % LAST_NAMES.length].toLowerCase()}@example.com`
  if (n === 'purpose')    return PURPOSES[index % PURPOSES.length]
  if (n.includes('reviewed_by') || n.includes('reviewer')) return `underwriter-${(index % 2) + 1}`

  // Number patterns — name-driven
  if (attr.type === 'number') {
    if (n === 'amount_paid')                  return [0, 2500, 5000, 1200, 8000][index % 5]
    if (n === 'amount' || n.endsWith('_amount')) return AMOUNTS[index % AMOUNTS.length]
    if (n.includes('income'))                 return INCOMES[index % INCOMES.length]
    if (n.includes('score'))                  return SCORES[index % SCORES.length]
    if (n.includes('rate'))                   return RATES[index % RATES.length]
    if (n.includes('month'))                  return TERMS[index % TERMS.length]
    return (index + 1) * 100
  }

  // Date patterns
  if (attr.type === 'date') {
    if (n.includes('birth')) return DOB_DATES[index % DOB_DATES.length]
    return DATES[index % DATES.length]
  }

  // Datetime patterns
  if (attr.type === 'datetime') return DATETIMES[index % DATETIMES.length]

  // Default string
  return `${n.replace(/_/g, ' ')} ${index + 1}`
}

// ── Noun collector ────────────────────────────────────────────────────────────

function collectNouns(domain: Domain): Noun[] {
  const nouns: Noun[] = [...(domain.nouns ?? [])]
  for (const sub of domain.domains ?? []) {
    nouns.push(...collectNouns(sub))
  }
  return nouns
}

// ── Public API ────────────────────────────────────────────────────────────────

export function generateStubs(operational: OperationalDNA, count = 3): string {
  const nouns = collectNouns(operational.domain)
  const stubs: Record<string, Record<string, unknown>[]> = {}

  for (const noun of nouns) {
    stubs[noun.name] = Array.from({ length: count }, (_, i) => {
      const record: Record<string, unknown> = {}
      for (const attr of noun.attributes ?? []) {
        record[attr.name] = stubValue(attr, noun.name, i)
      }
      return record
    })
  }

  return JSON.stringify(stubs, null, 2) + '\n'
}
