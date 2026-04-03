import { OperationalDNA, Noun, Domain } from '../../../../types'

function collectNouns(domain: Domain): Noun[] {
  const nouns: Noun[] = [...(domain.nouns ?? [])]
  for (const sub of domain.domains ?? []) {
    nouns.push(...collectNouns(sub))
  }
  return nouns
}

export function generateStubs(operational: OperationalDNA): string {
  const nouns = collectNouns(operational.domain)
  const stubs: Record<string, Record<string, unknown>[]> = {}

  for (const noun of nouns) {
    if (noun.examples?.length) {
      stubs[noun.name] = noun.examples
    }
  }

  return JSON.stringify(stubs, null, 2) + '\n'
}
