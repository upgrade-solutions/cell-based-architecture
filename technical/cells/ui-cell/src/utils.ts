export function toKebabCase(str: string): string {
  return str.replace(/([A-Z])/g, (c, _p1, offset: number) =>
    (offset === 0 ? '' : '-') + c.toLowerCase()
  )
}

export function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1)
}

/** 'LoanList' → 'Loan List' */
export function toTitleCase(str: string): string {
  return str.replace(/([A-Z])/g, (c, _p1, offset: number) =>
    (offset === 0 ? '' : ' ') + c
  )
}

/** 'LoanList' → 'loan-list' */
export function toFileName(name: string): string {
  return toKebabCase(name)
}
