import { Noun } from '../../../../types'
import { collectNouns } from '../../../../utils'
import { toSnakeCase } from './naming'

function nounSeedBlock(noun: Noun): string {
  const examples = (noun as any).examples as Array<Record<string, unknown>> | undefined
  if (!examples?.length) return ''

  const modelName = noun.name
  const lines: string[] = [`# Seed ${modelName} records`]

  for (const ex of examples) {
    const attrs = Object.entries(ex)
      .map(([k, v]) => `  ${k}: ${typeof v === 'string' ? `'${v}'` : v}`)
      .join(",\n")
    lines.push(`${modelName}.find_or_create_by!(id: '${ex.id ?? `seed-${toSnakeCase(noun.name)}-${examples.indexOf(ex) + 1}`}') do |r|`)
    lines.push(`${attrs}`)
    lines.push(`end`)
    lines.push('')
  }

  return lines.join('\n')
}

export function generateSeeds(nouns: Noun[]): string {
  const blocks = nouns.map(nounSeedBlock).filter(Boolean)
  if (!blocks.length) {
    return `# Seeds generated from DNA examples.\n# No example data found in Operational DNA.\n`
  }

  return `# Seeds generated from DNA examples.\n\n${blocks.join('\n')}`
}
