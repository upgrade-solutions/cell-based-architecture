import * as fs from 'fs'
import * as path from 'path'
import { OperationalDNA, EventBusCellAdapter, EventBusAdapterConfig } from '../../../types'
import { generateSchemaRegistry } from './generators/schema-registry'
import { generatePublishers } from './generators/publishers'
import { generateRouting } from './generators/routing'
import { generateSubscriberWorker } from './generators/subscriber'
import { generateClient } from './generators/client'
import { generatePackageJson, generateTsConfig } from './generators/scaffold'

function write(outputDir: string, relativePath: string, content: string): void {
  const fullPath = path.join(outputDir, relativePath)
  fs.mkdirSync(path.dirname(fullPath), { recursive: true })
  fs.writeFileSync(fullPath, content)
}

export const generate: EventBusCellAdapter['generate'] = (
  operational: OperationalDNA,
  config: EventBusAdapterConfig,
  outputDir: string,
): void => {
  const signals = operational.signals ?? []
  const causes = operational.causes ?? []
  const engine = config.engine ?? 'rabbitmq'

  // Derive a name from the domain
  const domainName = operational.domain.name
  const appName = `${domainName}-event-bus`

  // ── Write DNA snapshot ──────────────────────────────────────────────────────
  write(outputDir, 'src/dna/operational.json', JSON.stringify(operational, null, 2))

  // ── Generate event bus code ─────────────────────────────────────────────────
  write(outputDir, 'src/schema-registry.ts', generateSchemaRegistry(signals))
  write(outputDir, 'src/publishers.ts', generatePublishers(signals))
  write(outputDir, 'src/routing.ts', generateRouting(signals, causes))
  write(outputDir, 'src/subscriber.ts', generateSubscriberWorker(signals, causes))
  write(outputDir, 'src/client.ts', generateClient(engine))

  // ── Scaffold ────────────────────────────────────────────────────────────────
  write(outputDir, 'package.json', generatePackageJson(appName))
  write(outputDir, 'tsconfig.json', generateTsConfig())
}
