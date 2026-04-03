export function generateOpenApi(): string {
  return `const TS_TYPE: Record<string, string> = {
  string: 'string',
  text: 'string',
  number: 'number',
  boolean: 'boolean',
  date: 'string',
  datetime: 'string',
  enum: 'string',
  reference: 'string',
}

export function buildOpenApiSpec(api: any, operational: any): object {
  const paths: Record<string, any> = {}

  for (const endpoint of api.endpoints ?? []) {
    const openapiPath = endpoint.path.replace(/:([^/]+)/g, '{$1}')
    if (!paths[openapiPath]) paths[openapiPath] = {}

    const method = endpoint.method.toLowerCase()
    const [resource] = endpoint.operation.split('.')

    const operation = api.operations?.find((op: any) => op.name === endpoint.operation)
    const capability = operation?.capability ?? endpoint.operation
    const policy = operational.policies?.find((p: any) => p.capability === capability)
    const roles: string[] = policy?.allow?.map((a: any) => a.role) ?? []

    const parameters: any[] = []

    for (const param of (endpoint.params ?? []).filter((p: any) => p.in === 'path')) {
      parameters.push({ in: 'path', name: param.name, required: true, schema: { type: 'string' } })
    }

    for (const param of (endpoint.params ?? []).filter((p: any) => p.in === 'query')) {
      parameters.push({ in: 'query', name: param.name, required: false, schema: { type: 'string' } })
    }

    const op: any = {
      tags: [\`\${resource}s\`],
      summary: endpoint.description ?? endpoint.operation,
      security: [{ bearerAuth: [] }],
      parameters,
      responses: {
        '200': { description: 'Success' },
        '401': { description: 'Unauthorized' },
        '403': { description: 'Forbidden' },
        '404': { description: 'Not found' },
      },
    }

    if (roles.length) {
      op['x-roles'] = roles
    }

    if (endpoint.request?.fields?.length) {
      const properties: Record<string, any> = {}
      const required: string[] = []
      for (const field of endpoint.request.fields) {
        const schemaType = TS_TYPE[field.type] ?? 'string'
        properties[field.name] = { type: schemaType }
        if (field.required) required.push(field.name)
      }
      op.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties,
              ...(required.length ? { required } : {}),
            },
          },
        },
      }
    }

    paths[openapiPath][method] = op
  }

  return {
    openapi: '3.0.0',
    info: {
      title: api.namespace?.name ?? 'API',
      version: '1.0.0',
      description: api.namespace?.description ?? '',
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    paths,
  }
}
`
}
