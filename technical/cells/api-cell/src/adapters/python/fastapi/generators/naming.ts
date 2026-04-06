/**
 * Python/FastAPI naming conventions derived from DNA names.
 *
 * DNA names are PascalCase (e.g. "Borrower", "LoanApplication").
 * Python expects snake_case for most identifiers.
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

/** Router file name: 'Borrower' → 'borrowers.py' */
export function toRouterFileName(str: string): string {
  return `${toPlural(str)}.py`
}

/** Model file name: 'Borrower' → 'borrower.py' */
export function toModelFileName(str: string): string {
  return `${toSnakeCase(str)}.py`
}

/** Schema file name: 'Borrower' → 'borrower.py' */
export function toSchemaFileName(str: string): string {
  return `${toSnakeCase(str)}.py`
}

/** Method name from action: 'Register' → 'register', 'View' → 'get', 'List' → 'list_all' */
export function toActionMethod(action: string): string {
  const lc = action.toLowerCase()
  if (lc === 'view') return 'get'
  if (lc === 'list') return 'list_all'
  return toSnakeCase(action)
}

/** DNA type → SQLAlchemy column type import */
export function toSqlalchemyType(dnaType: string): string {
  const map: Record<string, string> = {
    string: 'String',
    text: 'Text',
    number: 'Numeric',
    boolean: 'Boolean',
    date: 'Date',
    datetime: 'DateTime',
    enum: 'String',
    reference: 'String',
  }
  return map[dnaType] ?? 'String'
}

/** DNA type → Python/Pydantic type hint */
export function toPythonType(dnaType: string): string {
  const map: Record<string, string> = {
    string: 'str',
    text: 'str',
    number: 'float',
    boolean: 'bool',
    date: 'date',
    datetime: 'datetime',
    enum: 'str',
    reference: 'str',
  }
  return map[dnaType] ?? 'str'
}
