import * as fs from 'fs'
import * as path from 'path'

export const SCHEMA_ROOT = path.resolve(__dirname, '..', 'schemas')

function load(rel: string): JsonSchema {
  const file = path.join(SCHEMA_ROOT, rel)
  return JSON.parse(fs.readFileSync(file, 'utf-8'))
}

export type JsonSchema = {
  $id?: string
  $schema?: string
  title?: string
  description?: string
  type?: string | string[]
  [key: string]: unknown
}

export type Layer = 'operational' | 'product.core' | 'product.api' | 'product.ui' | 'technical'

export const schemas = {
  operational: {
    attribute: load('operational/attribute.json'),
    capability: load('operational/capability.json'),
    cause: load('operational/cause.json'),
    domain: load('operational/domain.json'),
    equation: load('operational/equation.json'),
    noun: load('operational/noun.json'),
    outcome: load('operational/outcome.json'),
    person: load('operational/person.json'),
    position: load('operational/position.json'),
    process: load('operational/process.json'),
    relationship: load('operational/relationship.json'),
    rule: load('operational/rule.json'),
    signal: load('operational/signal.json'),
    task: load('operational/task.json'),
    verb: load('operational/verb.json'),
  },
  product: {
    core: {
      action: load('product/core/action.json'),
      field: load('product/core/field.json'),
      operation: load('product/core/operation.json'),
      resource: load('product/core/resource.json'),
      role: load('product/core/role.json'),
    },
    api: {
      endpoint: load('product/api/endpoint.json'),
      namespace: load('product/api/namespace.json'),
      param: load('product/api/param.json'),
      schema: load('product/api/schema.json'),
    },
    web: {
      block: load('product/web/block.json'),
      layout: load('product/web/layout.json'),
      page: load('product/web/page.json'),
      route: load('product/web/route.json'),
    },
  },
  technical: {
    cell: load('technical/cell.json'),
    connection: load('technical/connection.json'),
    construct: load('technical/construct.json'),
    environment: load('technical/environment.json'),
    node: load('technical/node.json'),
    output: load('technical/output.json'),
    provider: load('technical/provider.json'),
    script: load('technical/script.json'),
    variable: load('technical/variable.json'),
    view: load('technical/view.json'),
    zone: load('technical/zone.json'),
  },
} as const

export const documents = {
  operational: load('operational/operational.json'),
  productCore: load('product/product.core.json'),
  productApi: load('product/product.api.json'),
  productUi: load('product/product.ui.json'),
  technical: load('technical/technical.json'),
} as const

export const layerDirs: Record<'operational' | 'product' | 'technical', string> = {
  operational: path.join(SCHEMA_ROOT, 'operational'),
  product: path.join(SCHEMA_ROOT, 'product'),
  technical: path.join(SCHEMA_ROOT, 'technical'),
}

export function resolveSchemaFile(family: 'operational' | 'product' | 'technical', name: string): string | null {
  const dir = layerDirs[family]
  if (!dir) return null
  const candidate = path.join(dir, `${name}.json`)
  return fs.existsSync(candidate) ? candidate : null
}

export function allSchemas(): JsonSchema[] {
  const out: JsonSchema[] = []
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    const obj = node as Record<string, unknown>
    if (typeof obj.$id === 'string') {
      out.push(obj as JsonSchema)
      return
    }
    for (const v of Object.values(obj)) walk(v)
  }
  walk(schemas)
  walk(documents)
  return out
}
