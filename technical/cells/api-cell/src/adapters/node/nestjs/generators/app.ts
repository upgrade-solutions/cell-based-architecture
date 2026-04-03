import { Resource } from '../../../../types'

export function generateAppModule(resources: Resource[]): string {
  const moduleImports = resources.map(r =>
    `import { ${r.name}sModule } from './${r.name.toLowerCase()}s/${r.name.toLowerCase()}s.module'`
  )
  const moduleRefs = resources.map(r => `    ${r.name}sModule`)

  return [
    `import { Module } from '@nestjs/common'`,
    `import { ConfigModule } from '@nestjs/config'`,
    ...moduleImports,
    '',
    `@Module({`,
    `  imports: [`,
    `    ConfigModule.forRoot({ isGlobal: true }),`,
    ...moduleRefs.map(r => `${r},`),
    `  ],`,
    `})`,
    `export class AppModule {}`,
    '',
  ].join('\n')
}

export function generateMain(port = 3000): string {
  return `import { NestFactory, Reflector } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  app.enableCors()
  await app.listen(process.env.PORT ?? ${port})
}
bootstrap()
`
}
