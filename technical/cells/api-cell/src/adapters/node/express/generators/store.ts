export function generateStore(): string {
  return `const stores = new Map<string, Map<string, any>>()

export function getStore(resource: string): Map<string, any> {
  if (!stores.has(resource)) stores.set(resource, new Map())
  return stores.get(resource)!
}

export function seedFromOperationalDna(operational: any): void {
  function walk(domain: any) {
    for (const noun of domain.nouns ?? []) {
      if (noun.examples?.length) {
        const key = noun.name.toLowerCase() + 's'
        const store = getStore(key)
        for (const example of noun.examples) {
          if (example.id) store.set(example.id, { ...example })
        }
        console.log(\`[seed] \${noun.name}: \${noun.examples.length} records\`)
      }
    }
    for (const sub of domain.domains ?? []) walk(sub)
  }
  if (operational?.domain) walk(operational.domain)
}
`
}
