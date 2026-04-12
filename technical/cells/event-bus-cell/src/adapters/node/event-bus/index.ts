import * as fs from 'fs'
import * as path from 'path'
import { ProductCoreDNA, EventBusCellAdapter, EventBusAdapterConfig } from '../../../types'
import { generateSchemaRegistry } from './generators/schema-registry'
import { generatePublishers } from './generators/publishers'
import { generateRouting } from './generators/routing'
import { generateSubscriberWorker } from './generators/subscriber'
import { generateClient } from './generators/client'
import { generatePackageJson, generateTsConfig, generateDockerfile, generateDockerIgnore } from './generators/scaffold'

function write(outputDir: string, relativePath: string, content: string): void {
  const fullPath = path.join(outputDir, relativePath)
  fs.mkdirSync(path.dirname(fullPath), { recursive: true })
  fs.writeFileSync(fullPath, content)
}

export const generate: EventBusCellAdapter['generate'] = (
  core: ProductCoreDNA,
  config: EventBusAdapterConfig,
  outputDir: string,
): void => {
  const signals = core.signals ?? []
  const causes = core.causes ?? []
  const engine = config.engine ?? 'rabbitmq'

  // Derive a name from the domain
  const domainName = core.domain.name
  const appName = `${domainName}-event-bus`

  // ── Write DNA snapshot ──────────────────────────────────────────────────────
  write(outputDir, 'src/dna/product.core.json', JSON.stringify(core, null, 2))

  // ── Generate event bus code ─────────────────────────────────────────────────
  write(outputDir, 'src/schema-registry.ts', generateSchemaRegistry(signals))
  write(outputDir, 'src/publishers.ts', generatePublishers(signals))
  write(outputDir, 'src/routing.ts', generateRouting(signals, causes))
  write(outputDir, 'src/subscriber.ts', generateSubscriberWorker(signals, causes))
  write(outputDir, 'src/client.ts', generateClient(engine))

  // ── Scaffold ────────────────────────────────────────────────────────────────
  write(outputDir, 'package.json', generatePackageJson(appName, engine))
  write(outputDir, 'tsconfig.json', generateTsConfig())
  write(outputDir, 'Dockerfile', generateDockerfile())
  write(outputDir, '.dockerignore', generateDockerIgnore())
}
