import { CoreResource } from '../../../../types'
import { toSnakeCase } from './naming'

function nounSeedBlock(noun: CoreResource): string {
  const examples = (noun as any).examples as Array<Record<string, unknown>> | undefined
  if (!examples?.length) return ''

  const modelName = noun.name
  const lines: string[] = [`    # Seed ${modelName} records`]

  for (const [i, ex] of examples.entries()) {
    const id = ex.id ?? `seed-${toSnakeCase(noun.name)}-${i + 1}`
    const attrs = Object.entries(ex)
      .filter(([k]) => k !== 'id')
      .map(([k, v]) => `        ${k}=${typeof v === 'string' ? `"${v}"` : v},`)
      .join('\n')

    lines.push(`    existing = db.query(${modelName}).filter(${modelName}.id == "${id}").first()`)
    lines.push(`    if not existing:`)
    lines.push(`        db.add(${modelName}(`)
    lines.push(`            id="${id}",`)
    if (attrs) lines.push(attrs)
    lines.push(`        ))`)
    lines.push('')
  }

  return lines.join('\n')
}

export function generateSeed(nouns: CoreResource[]): string {
  const blocks = nouns.map(nounSeedBlock).filter(Boolean)
  const modelImports = nouns.map(n => `from app.models.${toSnakeCase(n.name)} import ${n.name}`)

  if (!blocks.length) {
    return `"""Seed script generated from DNA examples — no example data found."""
`
  }

  return `"""Seed script generated from DNA examples."""
from app.database import SessionLocal, engine, Base
${modelImports.join('\n')}


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
${blocks.join('\n')}
        db.commit()
        print("Seeded successfully.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
`
}
