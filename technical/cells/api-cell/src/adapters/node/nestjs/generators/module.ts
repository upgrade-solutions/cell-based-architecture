import { Resource } from '../../../../types'
import { toFileName } from '../../../../utils'

export function generateModule(resource: Resource): string {
  const fileName = toFileName(resource.name)
  const controllerName = `${resource.name}sController`
  const serviceName = `${resource.name}sService`

  return [
    `import { Module } from '@nestjs/common'`,
    `import { ${controllerName} } from './${fileName}.controller'`,
    `import { ${serviceName} } from './${fileName}.service'`,
    '',
    `@Module({`,
    `  controllers: [${controllerName}],`,
    `  providers: [${serviceName}],`,
    `  exports: [${serviceName}],`,
    `})`,
    `export class ${resource.name}sModule {}`,
    '',
  ].join('\n')
}
