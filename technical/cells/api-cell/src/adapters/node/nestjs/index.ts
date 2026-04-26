import * as fs from 'fs'
import * as path from 'path'
import { ProductApiDNA, ProductCoreDNA, AuthProviderConfig, Resource, Endpoint, ApiCellAdapter } from '../../../types'
import { collectNouns, toFileName } from '../../../utils'
import { generateDockerfile, generateDockerIgnore } from '../docker'
import { generateDrizzleSchema, generateDbIndex } from './generators/schema'
import { generateDto, dtoFileName } from './generators/dto'
import { generateController } from './generators/controller'
import { generateService } from './generators/service'
import { generateModule } from './generators/module'
import { generateAuthGuard, generateRolesDecorator, generateFlags } from './generators/auth'
import { generateAppModule, generateMain } from './generators/app'
import {
  generatePackageJson,
  generateTsConfig,
  generateTsConfigBuild,
  generateDrizzleConfig,
  generateEnv,
} from './generators/scaffold'

function write(outputDir: string, relPath: string, content: string): void {
  const fullPath = path.join(outputDir, relPath)
  fs.mkdirSync(path.dirname(fullPath), { recursive: true })
  fs.writeFileSync(fullPath, content, 'utf-8')
}

function endpointsForResource(resourceName: string, endpoints: Endpoint[]): Endpoint[] {
  return endpoints.filter(ep => ep.operation.split('.')[0] === resourceName)
}

export const generate: ApiCellAdapter['generate'] = (
  api: ProductApiDNA,
  core: ProductCoreDNA,
  outputDir: string,
  authConfig?: AuthProviderConfig,
): void => {
  const resources = api.resources ?? []
  const operations = api.operations ?? []
  const rules = core.rules ?? []
  const coreOperations = core.operations ?? []
  const nouns = collectNouns(core)

  // ── Per-resource files ──────────────────────────────────────────────────────
  for (const resource of resources) {
    const endpoints = endpointsForResource(resource.name, api.endpoints)
    const fileName = toFileName(resource.name)
    const dir = `src/${fileName}`

    // Controller
    write(outputDir, `${dir}/${fileName}.controller.ts`,
      generateController(resource, endpoints, operations, rules, api.namespace))

    // Service — passes core operations so the generator can consult `changes[]`.
    // (Signal/Outcome plumbing was removed with the operational rewrite.)
    write(outputDir, `${dir}/${fileName}.service.ts`,
      generateService(resource, endpoints, coreOperations, rules))

    // Module
    write(outputDir, `${dir}/${fileName}.module.ts`,
      generateModule(resource))

    // DTOs — one file per endpoint with a request body
    for (const ep of endpoints) {
      if (!ep.request?.fields?.length) continue
      const action = ep.operation.split('.')[1]
      const dtoContent = generateDto(ep, resource.name)
      if (dtoContent) {
        write(outputDir, `${dir}/dto/${dtoFileName(action, resource.name)}.ts`, dtoContent)
      }
    }
  }

  // ── Drizzle schema ──────────────────────────────────────────────────────────
  write(outputDir, 'src/db/schema.ts', generateDrizzleSchema(nouns))
  write(outputDir, 'src/db/index.ts', generateDbIndex())

  // ── Auth ────────────────────────────────────────────────────────────────────
  write(outputDir, 'src/auth/auth.guard.ts', generateAuthGuard(authConfig))
  write(outputDir, 'src/auth/roles.decorator.ts', generateRolesDecorator())
  write(outputDir, 'src/auth/flags.ts', generateFlags())

  // ── App shell ───────────────────────────────────────────────────────────────
  write(outputDir, 'src/app.module.ts', generateAppModule(resources))
  write(outputDir, 'src/main.ts', generateMain(api.namespace))

  // ── Scaffold ────────────────────────────────────────────────────────────────
  const appName = api.namespace.name.toLowerCase() + '-api'
  write(outputDir, 'package.json', generatePackageJson(appName))
  write(outputDir, 'tsconfig.json', generateTsConfig())
  write(outputDir, 'tsconfig.build.json', generateTsConfigBuild())
  write(outputDir, 'drizzle.config.ts', generateDrizzleConfig())
  write(outputDir, '.env', generateEnv())

  // ── Containerization (node runtime) ─────────────────────────────────────────
  write(outputDir, 'Dockerfile', generateDockerfile())
  write(outputDir, '.dockerignore', generateDockerIgnore())
}
