export function generateValidators(): string {
  return `import { Request, Response, NextFunction } from 'express'
import { getDataStore } from './store'

// ── Type coercion helpers ───────────────────────────────────────────────────

function coerceType(value: unknown, type: string): { valid: boolean; coerced: unknown } {
  if (value === undefined || value === null) return { valid: true, coerced: value }

  switch (type) {
    case 'string':
    case 'text':
    case 'reference':
      return { valid: typeof value === 'string', coerced: value }
    case 'number': {
      if (typeof value === 'number') return { valid: !isNaN(value), coerced: value }
      const n = Number(value)
      return { valid: !isNaN(n), coerced: n }
    }
    case 'boolean': {
      if (typeof value === 'boolean') return { valid: true, coerced: value }
      if (value === 'true') return { valid: true, coerced: true }
      if (value === 'false') return { valid: true, coerced: false }
      return { valid: false, coerced: value }
    }
    case 'date':
    case 'datetime': {
      if (typeof value !== 'string') return { valid: false, coerced: value }
      const d = new Date(value)
      return { valid: !isNaN(d.getTime()), coerced: value }
    }
    case 'enum':
      return { valid: typeof value === 'string', coerced: value }
    default:
      return { valid: true, coerced: value }
  }
}

// ── Resolve attribute metadata from Product Core DNA ────────────────────────

function findAttribute(nounName: string, attrName: string, core: any): any | null {
  const noun = (core?.nouns ?? []).find((n: any) => n.name === nounName)
  if (!noun) return null
  return (noun.attributes ?? []).find((a: any) => a.name === attrName) ?? null
}

// ── Request schema validation middleware ─────────────────────────────────────

export function createRequestValidator(endpoint: any, api: any, operational: any) {
  const fields = endpoint.request?.fields ?? []
  const [resourceName] = endpoint.operation.split('.')

  return (req: Request, res: Response, next: NextFunction) => {
    if (!fields.length) return next()

    const errors: string[] = []
    const body = req.body ?? {}

    for (const field of fields) {
      const value = body[field.name]

      // Required check
      if (field.required && (value === undefined || value === null || value === '')) {
        errors.push(\`\${field.name} is required\`)
        continue
      }

      // Skip further checks if not provided and not required
      if (value === undefined || value === null) continue

      // Type check
      const { valid } = coerceType(value, field.type)
      if (!valid) {
        errors.push(\`\${field.name} must be a valid \${field.type}\`)
        continue
      }

      // Enum values check — look up from Operational DNA attribute
      const attr = findAttribute(resourceName, field.name, operational)
      if (attr?.values?.length) {
        if (!attr.values.includes(value)) {
          errors.push(\`\${field.name} must be one of: \${attr.values.join(', ')}\`)
        }
      }
    }

    if (errors.length) {
      return res.status(400).json({ message: 'Validation failed', errors })
    }

    next()
  }
}

// ── Business rule validation middleware ──────────────────────────────────────

interface RuleCondition {
  attribute: string
  operator: string
  value?: unknown
}

function evaluateCondition(
  condition: RuleCondition,
  entity: Record<string, any> | null,
  body: Record<string, any>,
  resourceName: string,
): string | null {
  const attrPath = condition.attribute
  const parts = attrPath.split('.')
  const noun = parts[0]
  const field = parts[parts.length - 1]

  // Determine which object to read from
  const isRequestField = noun !== resourceName.toLowerCase() || !entity
  const source = isRequestField && noun !== resourceName.toLowerCase()
    ? null  // Cross-entity checks need a separate lookup — skip for now
    : entity ?? body

  if (!source && condition.operator !== 'present') return null

  const actual = source ? (source[field] ?? body[field]) : body[field]

  switch (condition.operator) {
    case 'present':
      if (actual === undefined || actual === null || actual === '') {
        return \`\${field} must be present\`
      }
      break

    case 'eq': {
      const expected = condition.value
      if (String(actual) !== String(expected)) {
        return \`\${field} must be \${expected} (current: \${actual})\`
      }
      break
    }

    case 'gt': {
      const num = Number(actual ?? body[field])
      const threshold = Number(condition.value)
      if (isNaN(num) || num <= threshold) {
        return \`\${field} must be greater than \${threshold}\`
      }
      break
    }

    case 'gte': {
      const num = Number(actual ?? body[field])
      const threshold = Number(condition.value)
      if (isNaN(num) || num < threshold) {
        return \`\${field} must be greater than or equal to \${threshold}\`
      }
      break
    }

    case 'lt': {
      const num = Number(actual ?? body[field])
      // Value can be a field reference like "loan.amount"
      let threshold: number
      if (typeof condition.value === 'string' && condition.value.includes('.')) {
        const refField = condition.value.split('.').pop()!
        threshold = Number(entity?.[refField] ?? 0)
      } else {
        threshold = Number(condition.value)
      }
      if (isNaN(num) || num >= threshold) {
        return \`\${field} must be less than \${threshold}\`
      }
      break
    }

    case 'lte': {
      const num = Number(actual ?? body[field])
      const threshold = Number(condition.value)
      if (isNaN(num) || num > threshold) {
        return \`\${field} must be less than or equal to \${threshold}\`
      }
      break
    }
  }

  return null
}

// Resource key matches the schema export name from drizzle.ts:
// PascalCase resource name → camelCase + 's' (IntakeSubmission → intakeSubmissions).
const toResourceKey = (n: string) => n.charAt(0).toLowerCase() + n.slice(1) + 's'

export function createRuleValidator(endpoint: any, api: any, operational: any) {
  const operation = api.operations?.find((op: any) => op.name === endpoint.operation)
  const capability = operation?.capability ?? endpoint.operation
  const rule = (operational.rules ?? []).find((r: any) => r.capability === capability && r.type !== 'access')
  const [resourceName] = endpoint.operation.split('.')
  const resourceKey = toResourceKey(resourceName)
  const hasIdParam = (endpoint.params ?? []).some((p: any) => p.in === 'path' && p.name === 'id')

  if (!rule) {
    return (_req: Request, _res: Response, next: NextFunction) => next()
  }

  const store = getDataStore()

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Load existing entity for update operations
      let entity: Record<string, any> | null = null
      if (hasIdParam && req.params.id) {
        entity = await store.findById(resourceKey, req.params.id)
        if (!entity) {
          return res.status(404).json({ message: \`\${resourceName} \${req.params.id} not found\` })
        }
      }

      const errors: string[] = []
      for (const condition of rule.conditions ?? []) {
        const error = evaluateCondition(condition, entity, req.body, resourceName)
        if (error) errors.push(error)
      }

      if (errors.length) {
        return res.status(422).json({
          message: \`Rule violation: \${rule.description ?? capability}\`,
          errors,
        })
      }

      next()
    } catch (err: any) {
      return res.status(500).json({ message: err.message })
    }
  }
}
`
}
