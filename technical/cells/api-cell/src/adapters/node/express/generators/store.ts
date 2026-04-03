export function generateStore(): string {
  return `const stores = new Map<string, Map<string, any>>()

export function getStore(resource: string): Map<string, any> {
  if (!stores.has(resource)) stores.set(resource, new Map())
  return stores.get(resource)!
}
`
}
