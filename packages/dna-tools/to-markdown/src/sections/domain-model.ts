import { DnaInput, Noun, OperationalDomain, Relationship } from '../types'
import { hashes } from '../util'

export function renderDomainModel(dna: DnaInput, h: number): string | null {
  const op = dna.operational
  if (!op) return null

  const nouns = collectNouns(op.domain)
  if (!nouns.length) return null

  const relsByFrom = groupBy(op.relationships ?? [], (r) => r.from)

  const lines: string[] = [`${hashes(h)} Domain Model`]

  for (const noun of nouns) {
    lines.push('', `${hashes(h + 1)} ${noun.name}`)
    if (noun.description) lines.push('', noun.description)

    if (noun.attributes?.length) {
      lines.push(
        '',
        '| Attribute | Type | Required | Description |',
        '| --- | --- | --- | --- |',
      )
      for (const attr of noun.attributes) {
        lines.push(
          `| \`${attr.name}\` | ${attr.type ?? '—'} | ${attr.required ? 'yes' : 'no'} | ${attr.description ?? ''} |`,
        )
      }
    }

    if (noun.verbs?.length) {
      lines.push('', `**Verbs:** ${noun.verbs.map((v) => `\`${v.name}\``).join(', ')}`)
    }

    const rels = relsByFrom.get(noun.name) ?? []
    if (rels.length) {
      lines.push('', '**Relationships:**')
      for (const r of rels) {
        lines.push(
          `- \`${r.name}\` — ${r.cardinality} → \`${r.to}\` (via \`${r.attribute}\`)`,
        )
      }
    }
  }

  return lines.join('\n')
}

function collectNouns(domain: OperationalDomain): Noun[] {
  const out = [...(domain.nouns ?? [])]
  for (const sub of domain.domains ?? []) out.push(...collectNouns(sub))
  return out
}

function groupBy<T>(arr: T[], key: (x: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const x of arr) {
    const k = key(x)
    if (!out.has(k)) out.set(k, [])
    out.get(k)!.push(x)
  }
  return out
}
