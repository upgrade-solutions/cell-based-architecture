import * as fs from 'fs'
import * as path from 'path'
import { DbCellAdapter, DbAdapterConfig, DbConstructConfig } from '../../types'
import { generateEnv, generateReadme } from './generators/scaffold'
import { generateDockerCompose } from './generators/docker-compose'
import { generateInitSql } from './generators/init-sql'

function write(outputDir: string, relPath: string, content: string): void {
  const fullPath = path.join(outputDir, relPath)
  fs.mkdirSync(path.dirname(fullPath), { recursive: true })
  fs.writeFileSync(fullPath, content, 'utf-8')
}

/**
 * db-cell (postgres) is infrastructure-only. It provisions the database and
 * the application role via postgres's own init scripts. It does NOT own
 * application tables — schema migrations, seeds, and queries are owned by
 * api-cell via drizzle, connecting as app_role.
 */
export const generate: DbCellAdapter['generate'] = (
  _operational,
  adapterConfig: DbAdapterConfig,
  constructConfig: DbConstructConfig,
  outputDir: string,
): void => {
  write(outputDir, 'docker-compose.yml', generateDockerCompose(adapterConfig, constructConfig))
  write(outputDir, 'docker/scripts/init.sql', generateInitSql(adapterConfig))
  write(outputDir, '.env', generateEnv(adapterConfig))
  write(outputDir, 'README.md', generateReadme(adapterConfig))
}
