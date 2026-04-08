import * as fs from 'fs'
import * as path from 'path'
import { ProductApiDNA, OperationalDNA, AuthProviderConfig, ApiCellAdapter } from '../../../types'
import { collectNouns } from '../../../utils'
import { toSnakeCase, toPlural, toModelFileName, toSchemaFileName, toRouterFileName } from './generators/naming'
import { generateModel, generateModelsInit } from './generators/models'
import { generateResourceSchemas, generateSchemasInit } from './generators/schemas'
import { generateRouter, generateRoutersInit } from './generators/router'
import { generateAuth } from './generators/auth'
import { generateDatabase } from './generators/database'
import { generateMain } from './generators/main'
import { generateSeed } from './generators/seed'
import { generateOpenApiSpec } from './generators/openapi'
import { generateDockerfile, generateDockerIgnore } from './generators/docker'
import {
  generateRequirements,
  generatePyprojectToml,
  generateAlembicIni,
  generateAlembicEnvPy,
  generateAlembicScriptMako,
  generateEnv,
  generateAppInit,
} from './generators/scaffold'

function write(outputDir: string, relPath: string, content: string): void {
  const fullPath = path.join(outputDir, relPath)
  fs.mkdirSync(path.dirname(fullPath), { recursive: true })
  fs.writeFileSync(fullPath, content, 'utf-8')
}

function endpointsForResource(resourceName: string, endpoints: ProductApiDNA['endpoints']): ProductApiDNA['endpoints'] {
  return endpoints.filter(ep => ep.operation.split('.')[0] === resourceName)
}

export const generate: ApiCellAdapter['generate'] = (
  api: ProductApiDNA,
  operational: OperationalDNA,
  outputDir: string,
  authConfig?: AuthProviderConfig,
): void => {
  const resources = api.resources ?? []
  const operations = api.operations ?? []
  const rules = operational.rules ?? []
  const outcomes = operational.outcomes ?? []
  const nouns = collectNouns(operational.domain)

  // ── Database ──────────────────────────────────────────────────────────────
  write(outputDir, 'app/database.py', generateDatabase())

  // ── Models (one per Noun) ─────────────────────────────────────────────────
  for (const noun of nouns) {
    write(outputDir, `app/models/${toModelFileName(noun.name)}`, generateModel(noun))
  }
  write(outputDir, 'app/models/__init__.py', generateModelsInit(nouns))

  // ── Pydantic schemas (one per Resource) ───────────────────────────────────
  for (const resource of resources) {
    const endpoints = endpointsForResource(resource.name, api.endpoints)
    write(outputDir, `app/schemas/${toSchemaFileName(resource.name)}`,
      generateResourceSchemas(resource, endpoints))
  }
  write(outputDir, 'app/schemas/__init__.py', generateSchemasInit(resources))

  // ── Auth ──────────────────────────────────────────────────────────────────
  write(outputDir, 'app/auth.py', generateAuth(authConfig))

  // ── Routers (one per Resource) ────────────────────────────────────────────
  for (const resource of resources) {
    const endpoints = endpointsForResource(resource.name, api.endpoints)
    write(outputDir, `app/routers/${toRouterFileName(resource.name)}`,
      generateRouter(resource, endpoints, operations, rules, outcomes, api.namespace, operational.signals))
  }
  write(outputDir, 'app/routers/__init__.py', generateRoutersInit(resources, api.namespace))

  // ── App entrypoint ────────────────────────────────────────────────────────
  write(outputDir, 'app/main.py', generateMain(api.namespace))
  write(outputDir, 'app/__init__.py', generateAppInit())

  // ── Seed ──────────────────────────────────────────────────────────────────
  write(outputDir, 'seed.py', generateSeed(nouns))

  // ── Static OpenAPI spec ───────────────────────────────────────────────────
  write(outputDir, 'openapi.json', generateOpenApiSpec(api))

  // ── Scaffold ──────────────────────────────────────────────────────────────
  write(outputDir, 'requirements.txt', generateRequirements())
  write(outputDir, 'pyproject.toml', generatePyprojectToml(api.namespace))
  write(outputDir, '.env', generateEnv())

  // ── Alembic ───────────────────────────────────────────────────────────────
  write(outputDir, 'alembic.ini', generateAlembicIni())
  write(outputDir, 'alembic/env.py', generateAlembicEnvPy())
  write(outputDir, 'alembic/script.py.mako', generateAlembicScriptMako())
  write(outputDir, 'alembic/versions/.gitkeep', '')

  // ── Copy DNA into output for reference ────────────────────────────────────
  write(outputDir, 'dna/api.json', JSON.stringify(api, null, 2) + '\n')
  write(outputDir, 'dna/operational.json', JSON.stringify(operational, null, 2) + '\n')

  // ── Containerization ──────────────────────────────────────────────────────
  write(outputDir, 'Dockerfile', generateDockerfile())
  write(outputDir, '.dockerignore', generateDockerIgnore())
}
