import * as fs from 'fs'
import * as path from 'path'
import { ProductApiDNA, ProductCoreDNA, AuthProviderConfig, ApiCellAdapter } from '../../../types'
import { collectNouns } from '../../../utils'
import { toControllerFileName, toModelFileName, toPlural } from './generators/naming'
import { generateController } from './generators/controller'
import { generateModel } from './generators/model'
import { generateRoutes } from './generators/routes'
import { generateMigration, migrationFileName } from './generators/migration'
import { generateApplicationController, generateJwtVerifier } from './generators/auth'
import { generateSeeds } from './generators/seeds'
import { generateOpenApiSpec, generateDocsController } from './generators/openapi'
import { generateDockerfile, generateDockerIgnore } from './generators/docker'
import {
  generateGemfile,
  generateDatabaseYml,
  generateApplicationRb,
  generateBootRb,
  generateEnvironmentRb,
  generateDevelopmentRb,
  generateProductionRb,
  generateTestRb,
  generatePumaRb,
  generateRakefile,
  generateConfigRu,
  generateEnv,
  generateBinRails,
  generateBinRake,
  generateBinSetup,
} from './generators/scaffold'

function write(outputDir: string, relPath: string, content: string): void {
  const fullPath = path.join(outputDir, relPath)
  fs.mkdirSync(path.dirname(fullPath), { recursive: true })
  fs.writeFileSync(fullPath, content, 'utf-8')
}

function writeExecutable(outputDir: string, relPath: string, content: string): void {
  write(outputDir, relPath, content)
  fs.chmodSync(path.join(outputDir, relPath), 0o755)
}

function endpointsForResource(resourceName: string, endpoints: ProductApiDNA['endpoints']): ProductApiDNA['endpoints'] {
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

  // ── Per-resource controllers ──────────────────────────────────────────────
  // Signals/Outcome plumbing was dropped with the operational rewrite —
  // controllers no longer publish events.
  for (const resource of resources) {
    const endpoints = endpointsForResource(resource.name, api.endpoints)
    write(outputDir, `app/controllers/${toControllerFileName(resource.name)}`,
      generateController(resource, endpoints, operations, rules, coreOperations, api.namespace))
  }

  // ── Models (one per Noun) ─────────────────────────────────────────────────
  for (const noun of nouns) {
    write(outputDir, `app/models/${toModelFileName(noun.name)}`,
      generateModel(noun))
  }

  // ── ApplicationRecord base ────────────────────────────────────────────────
  write(outputDir, 'app/models/application_record.rb',
    `class ApplicationRecord < ActiveRecord::Base\n  primary_abstract_class\nend\n`)

  // ── Auth ──────────────────────────────────────────────────────────────────
  write(outputDir, 'app/controllers/application_controller.rb',
    generateApplicationController(authConfig))
  write(outputDir, 'lib/jwt_verifier.rb', generateJwtVerifier())

  // ── API docs ──────────────────────────────────────────────────────────────
  write(outputDir, 'app/controllers/docs_controller.rb', generateDocsController(api.namespace))
  write(outputDir, 'public/openapi.json', generateOpenApiSpec(api))

  // ── Routes ────────────────────────────────────────────────────────────────
  write(outputDir, 'config/routes.rb', generateRoutes(api))

  // ── Database migration ────────────────────────────────────────────────────
  const timestamp = '20240101000000'
  write(outputDir, `db/migrate/${migrationFileName(timestamp)}`,
    generateMigration(nouns, timestamp))

  // ── Seeds ─────────────────────────────────────────────────────────────────
  write(outputDir, 'db/seeds.rb', generateSeeds(nouns))

  // ── Config & scaffold ─────────────────────────────────────────────────────
  write(outputDir, 'Gemfile', generateGemfile())
  write(outputDir, 'config/database.yml', generateDatabaseYml())
  write(outputDir, 'config/application.rb', generateApplicationRb(api.namespace))
  write(outputDir, 'config/boot.rb', generateBootRb())
  write(outputDir, 'config/environment.rb', generateEnvironmentRb())
  write(outputDir, 'config/environments/development.rb', generateDevelopmentRb())
  write(outputDir, 'config/environments/production.rb', generateProductionRb())
  write(outputDir, 'config/environments/test.rb', generateTestRb())
  write(outputDir, 'config/puma.rb', generatePumaRb())
  write(outputDir, 'Rakefile', generateRakefile())
  write(outputDir, 'config.ru', generateConfigRu())
  write(outputDir, '.env', generateEnv())

  // ── Bin scripts ────────────────────────────────────────────────────────────
  writeExecutable(outputDir, 'bin/rails', generateBinRails())
  writeExecutable(outputDir, 'bin/rake', generateBinRake())
  writeExecutable(outputDir, 'bin/setup', generateBinSetup())

  // ── Copy DNA into output for reference ─────────────────────────────────────
  write(outputDir, 'dna/api.json', JSON.stringify(api, null, 2) + '\n')
  write(outputDir, 'dna/product.core.json', JSON.stringify(core, null, 2) + '\n')

  // ── Containerization ──────────────────────────────────────────────────────
  write(outputDir, 'Dockerfile', generateDockerfile())
  write(outputDir, '.dockerignore', generateDockerIgnore())

  // ── Gitkeep for empty dirs Rails expects ──────────────────────────────────
  for (const dir of ['log', 'tmp/pids', 'tmp/cache']) {
    write(outputDir, `${dir}/.gitkeep`, '')
  }
}
