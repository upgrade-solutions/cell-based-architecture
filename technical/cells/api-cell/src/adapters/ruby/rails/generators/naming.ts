/**
 * Ruby/Rails naming conventions derived from DNA names.
 *
 * DNA names are PascalCase (e.g. "Borrower", "LoanApplication").
 * Rails expects specific casing for different contexts.
 */

/** PascalCase → snake_case: 'LoanApplication' → 'loan_application' */
export function toSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, (c, _p1, offset: number) =>
    (offset === 0 ? '' : '_') + c.toLowerCase()
  )
}

/** Plural snake_case: 'Borrower' → 'borrowers' */
export function toPlural(str: string): string {
  return toSnakeCase(str) + 's'
}

/** Table name (plural snake_case): 'Borrower' → 'borrowers' */
export function toTableName(str: string): string {
  return toPlural(str)
}

/** Controller class name: 'Borrower' → 'BorrowersController' */
export function toControllerName(str: string): string {
  return `${str}sController`
}

/** Controller file name: 'Borrower' → 'borrowers_controller.rb' */
export function toControllerFileName(str: string): string {
  return `${toPlural(str)}_controller.rb`
}

/** Model file name: 'Borrower' → 'borrower.rb' */
export function toModelFileName(str: string): string {
  return `${toSnakeCase(str)}.rb`
}

/** Method name from action: 'Register' → 'register', 'View' → 'show', 'List' → 'index' */
export function toActionMethod(action: string): string {
  const lc = action.toLowerCase()
  if (lc === 'view') return 'show'
  if (lc === 'list') return 'index'
  return toSnakeCase(action)
}

/** DNA type → Rails migration column type */
export function toRailsColumnType(dnaType: string): string {
  const map: Record<string, string> = {
    string: 'string',
    text: 'text',
    number: 'decimal',
    boolean: 'boolean',
    date: 'date',
    datetime: 'datetime',
    enum: 'string',
    reference: 'string',
  }
  return map[dnaType] ?? 'string'
}
