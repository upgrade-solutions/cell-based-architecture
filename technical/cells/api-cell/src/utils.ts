import { Domain, Noun } from './types'

export function toKebabCase(str: string): string {
  return str.replace(/([A-Z])/g, (c, _p1, offset: number) =>
    (offset === 0 ? '' : '-') + c.toLowerCase()
  )
}

export function toTableName(nounName: string): string {
  return nounName.replace(/([A-Z])/g, (c, _p1, offset: number) =>
    (offset === 0 ? '' : '_') + c.toLowerCase()
  ) + 's'
}

export function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1)
}

/** 'Borrower' → 'borrowers', 'LoanApplication' → 'loan-applications' */
export function toFileName(resourceName: string): string {
  return toKebabCase(resourceName) + 's'
}

export function stripLeadingSlash(p: string): string {
  return p.replace(/^\//, '')
}

export function collectNouns(domain: Domain): Noun[] {
  const nouns: Noun[] = [...(domain.nouns ?? [])]
  for (const sub of domain.domains ?? []) {
    nouns.push(...collectNouns(sub))
  }
  return nouns
}

/** 'Loan.Approve' → resource='Loan', action='Approve' */
export function splitOperation(operation: string): { resource: string; action: string } {
  const [resource, action] = operation.split('.')
  return { resource, action }
}

/** Resolve the capability name for an operation via the operations index. Falls back to operation name. */
export function resolveCapability(
  operationName: string,
  operations: Array<{ name: string; capability?: string }>
): string {
  return operations.find(o => o.name === operationName)?.capability ?? operationName
}
