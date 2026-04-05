import * as fs from 'fs'
import * as path from 'path'
import { OperationalDNA, DbCellAdapter, DbAdapterConfig, DbConstructConfig } from '../../types'
import { collectNouns } from '../../utils'
import { generateDrizzleSchema, generateDbIndex, generateDrizzleConfig } from './generators/schema'
import { generatePackageJson, generateTsConfig, generateEnv } from './generators/scaffold'
import { generateDockerCompose } from './generators/docker-compose'
import { generateInitSql } from './generators/init-sql'
import { generateSeed } from './generators/seed'

function write(outputDir: string, relPath: string, content: string): void {
  const fullPath = path.join(outputDir, relPath)
  fs.mkdirSync(path.dirname(fullPath), { recursive: true })
  fs.writeFileSync(fullPath, content, 'utf-8')
}

export const generate: DbCellAdapter['generate'] = (
  operational: OperationalDNA,
  adapterConfig: DbAdapterConfig,
  constructConfig: DbConstructConfig,
  outputDir: string,
): void => {
  const nouns = collectNouns(operational.domain)

  // ── DNA — copied for seed script ───────────────────────────────────────────
  write(outputDir, 'src/dna/operational.json', JSON.stringify(operational, null, 2) + '\n')

  // ── Database schema ────────────────────────────────────────────────────────
  write(outputDir, 'src/db/schema.ts', generateDrizzleSchema(nouns))
  write(outputDir, 'src/db/index.ts', generateDbIndex(adapterConfig))

  // ── Docker + init scripts ──────────────────────────────────────────────────
  write(outputDir, 'docker-compose.yml', generateDockerCompose(adapterConfig, constructConfig))
  write(outputDir, 'docker/scripts/init.sql', generateInitSql(adapterConfig))

  // ── Seed ───────────────────────────────────────────────────────────────────
  write(outputDir, 'src/seed.ts', generateSeed())

  // ── Scaffold ───────────────────────────────────────────────────────────────
  write(outputDir, 'package.json', generatePackageJson(adapterConfig.database))
  write(outputDir, 'tsconfig.json', generateTsConfig())
  write(outputDir, '.env', generateEnv(adapterConfig))
  write(outputDir, 'drizzle.config.ts', generateDrizzleConfig())
}
