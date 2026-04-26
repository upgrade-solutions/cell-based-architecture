import { CoreResource, ProductCoreDNA } from './types'

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

/**
 * Return all CoreResources for a Product Core document. Product Core stores
 * resources as a flat top-level array (the materializer already walked the
 * operational domain tree and emitted the surfaced closure), so this is just
 * a pass-through.
 *
 * Accepts a partial shape so old call-sites that passed `core.domain` or older
 * shapes work too — but prefer passing `core` directly.
 */
export function collectNouns(core: ProductCoreDNA | { resources?: CoreResource[] }): CoreResource[] {
  return [...(core.resources ?? [])]
}

/** 'Loan.Approve' → resource='Loan', action='Approve' */
export function splitOperation(operation: string): { resource: string; action: string } {
  const [resource, action] = operation.split('.')
  return { resource, action }
}
