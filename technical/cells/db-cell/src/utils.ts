import { Domain, Noun } from './types'

export function toTableName(nounName: string): string {
  return nounName.replace(/([A-Z])/g, (c, _p1, offset: number) =>
    (offset === 0 ? '' : '_') + c.toLowerCase()
  ) + 's'
}

export function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1)
}

export function collectNouns(domain: Domain): Noun[] {
  const nouns: Noun[] = [...(domain.nouns ?? [])]
  for (const sub of domain.domains ?? []) {
    nouns.push(...collectNouns(sub))
  }
  return nouns
}
