import { Resource, Endpoint, Operation, Policy, Namespace } from '../../../../types'
import { toFileName, toCamelCase, stripLeadingSlash, resolveCapability } from '../../../../utils'
import { dtoClassName, dtoFileName } from './dto'

const HTTP_DECORATOR: Record<string, string> = {
  GET: 'Get',
  POST: 'Post',
  PUT: 'Put',
  PATCH: 'Patch',
  DELETE: 'Delete',
}

function resourceBasePath(namespace: Namespace, resourceName: string): string {
  return `${stripLeadingSlash(namespace.path)}/${resourceName.toLowerCase()}s`
}

function relativeEndpointPath(endpointPath: string, basePath: string): string {
  return endpointPath
    .replace(`/${basePath}`, '')
    .replace(`${basePath}`, '')
    .replace(/^\//, '')
}

export function generateController(
  resource: Resource,
  endpoints: Endpoint[],
  operations: Operation[],
  policies: Policy[],
  namespace: Namespace,
): string {
  const basePath = resourceBasePath(namespace, resource.name)
  const fileName = toFileName(resource.name)
  const className = `${resource.name}sController`
  const serviceName = `${resource.name}sService`
  const serviceVar = `${toCamelCase(resource.name)}sService`

  const usedHttpDecorators = new Set<string>()
  const usedParamDecorators = new Set<string>()
  const dtosNeeded: Array<{ action: string; resource: string }> = []

  const methods: string[] = []

  for (const ep of endpoints) {
    const action = ep.operation.split('.')[1]
    const methodName = toCamelCase(action)
    const httpDec = HTTP_DECORATOR[ep.method]
    usedHttpDecorators.add(httpDec)

    const relPath = relativeEndpointPath(ep.path, basePath)
    const pathDec = relPath ? `@${httpDec}('${relPath}')` : `@${httpDec}()`

    const capability = resolveCapability(ep.operation, operations)
    const policy = policies.find(p => p.capability === capability)
    const roles = policy?.allow.map(a => a.role) ?? []

    const pathParams = (ep.params ?? []).filter(p => p.in === 'path')
    const queryParams = (ep.params ?? []).filter(p => p.in === 'query')
    if (pathParams.length) usedParamDecorators.add('Param')
    if (queryParams.length) usedParamDecorators.add('Query')

    const hasDtoBody = !!ep.request?.fields?.length
    if (hasDtoBody) {
      usedParamDecorators.add('Body')
      dtosNeeded.push({ action, resource: resource.name })
    }

    const params: string[] = [
      ...pathParams.map(p => `@Param('${p.name}') ${p.name}: string`),
      ...queryParams.map(p => `@Query('${p.name}') ${p.name}?: string`),
      ...(hasDtoBody ? [`@Body() dto: ${dtoClassName(action, resource.name)}`] : []),
    ]

    const serviceArgs: string[] = [
      ...pathParams.map(p => p.name),
      ...(queryParams.length
        ? [`{ ${queryParams.map(p => p.name).join(', ')} }`]
        : []),
      ...(hasDtoBody ? ['dto'] : []),
    ]

    const summary = ep.description ?? ep.operation
    const apiQueryDecorators = queryParams.map(
      p => `  @ApiQuery({ name: '${p.name}', required: false })`
    )
    const lines: string[] = [
      `  // ${ep.operation}${ep.description ? `: ${ep.description}` : ''}`,
      `  @ApiOperation({ summary: '${summary.replace(/'/g, "\\'")}' })`,
      `  @ApiBearerAuth()`,
      ...apiQueryDecorators,
      `  @UseGuards(AuthGuard)`,
      ...(roles.length ? [`  @Roles(${roles.map(r => `'${r}'`).join(', ')})`] : []),
      `  ${pathDec}`,
      `  ${methodName}(${params.join(', ')}) {`,
      `    return this.${serviceVar}.${methodName}(${serviceArgs.join(', ')})`,
      `  }`,
    ]

    methods.push(lines.join('\n'))
  }

  const nestImports = [
    'Controller', 'UseGuards',
    ...usedHttpDecorators,
    ...usedParamDecorators,
  ].sort()

  const dtoImports = dtosNeeded.map(
    ({ action, resource: res }) =>
      `import { ${dtoClassName(action, res)} } from './dto/${dtoFileName(action, res)}'`
  )

  return [
    `import { ${nestImports.join(', ')} } from '@nestjs/common'`,
    `import { ApiOperation, ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger'`,
    `import { AuthGuard } from '../auth/auth.guard'`,
    `import { Roles } from '../auth/roles.decorator'`,
    `import { ${serviceName} } from './${fileName}.service'`,
    ...dtoImports,
    '',
    `@ApiTags('${resource.name}s')`,
    `@Controller('${basePath}')`,
    `export class ${className} {`,
    `  constructor(private readonly ${serviceVar}: ${serviceName}) {}`,
    '',
    methods.join('\n\n'),
    '}',
    '',
  ].join('\n')
}
