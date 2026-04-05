import * as path from 'path'
import { EnvironmentPlan, ResolvedCell, ResolvedConstruct, ResolvedVariable } from '../plan'

export interface ComposeFile {
  path: string
  content: string
}

export interface ComposeResult {
  files: ComposeFile[]
  services: string[]
  skipped: Array<{ name: string; kind: string; reason: string }>
}

/**
 * Generate a top-level docker-compose.yml that wires together:
 *   - storage Constructs (postgres databases, redis caches) → standard images
 *   - deployable Cells (node/express, node/nestjs, vite/react) → build contexts
 *     pointing at each cell's output dir
 *
 * External providers (auth0, stripe, etc.) and network Constructs (gateway,
 * loadbalancer, cdn) are skipped — they're either out-of-scope for local
 * compose deployment or handled via port exposure.
 */
export function generateDockerCompose(plan: EnvironmentPlan): ComposeResult {
  const services: Record<string, any> = {}
  const volumes: Record<string, any> = {}
  const skipped: Array<{ name: string; kind: string; reason: string }> = []

  // Storage constructs → compose services
  for (const c of plan.constructs) {
    const svc = buildConstructService(c, volumes)
    if (svc) {
      services[c.name] = svc.definition
    } else {
      skipped.push({
        name: c.name,
        kind: `${c.category}/${c.type}`,
        reason: skipReason(c),
      })
    }
  }

  // Cells → compose services (build from output dir)
  for (const cell of plan.cells) {
    const svc = buildCellService(cell, plan)
    if (svc) {
      services[svc.name] = svc.definition
    } else {
      skipped.push({
        name: cell.name,
        kind: `cell/${cell.adapterType}`,
        reason: `adapter "${cell.adapterType}" has no docker-compose mapping (skipped)`,
      })
    }
  }

  const doc: any = { services }
  if (Object.keys(volumes).length) doc.volumes = volumes

  return {
    files: [
      {
        path: path.join(plan.deployDir, 'docker-compose.yml'),
        content: renderYaml(doc),
      },
      {
        path: path.join(plan.deployDir, 'README.md'),
        content: renderReadme(plan, Object.keys(services), skipped),
      },
    ],
    services: Object.keys(services),
    skipped,
  }
}

// ──────────────── constructs ────────────────

function buildConstructService(
  c: ResolvedConstruct,
  volumes: Record<string, any>,
): { definition: any } | null {
  if (c.category !== 'storage') return null
  if (c.type === 'database' && c.config?.engine === 'postgres') {
    const volName = `${c.name}-data`.replace(/[^a-z0-9_-]/gi, '_')
    volumes[volName] = null
    return {
      definition: {
        image: `postgres:${c.config.version ?? '16'}-alpine`,
        restart: 'unless-stopped',
        environment: {
          POSTGRES_USER: 'postgres',
          POSTGRES_PASSWORD: 'postgres',
          POSTGRES_DB: 'postgres',
        },
        ports: [`${c.config.port ?? 5432}:5432`],
        volumes: [`${volName}:/var/lib/postgresql/data`],
      },
    }
  }
  if (c.type === 'cache' && c.config?.engine === 'redis') {
    return {
      definition: {
        image: `redis:${c.config.version ?? '7'}-alpine`,
        restart: 'unless-stopped',
        ports: [`${c.config.port ?? 6379}:6379`],
      },
    }
  }
  return null
}

function skipReason(c: ResolvedConstruct): string {
  if (c.provider !== 'aws' && c.provider !== 'local') {
    return `external provider "${c.provider}" — not deployable via compose`
  }
  if (c.category === 'network') {
    return `network constructs are handled via port exposure, not compose services`
  }
  if (c.category === 'compute' && c.type === 'container') {
    return `container compute is provided by Cells, not Constructs directly`
  }
  return `no compose mapping for ${c.category}/${c.type}`
}

// ──────────────── cells ────────────────

interface CellService {
  name: string
  definition: any
}

function buildCellService(cell: ResolvedCell, plan: EnvironmentPlan): CellService | null {
  const svcName = serviceNameForCell(cell.name)
  const relBuildContext = path.relative(plan.deployDir, cell.outputDir)

  if (cell.adapterType.startsWith('node/')) {
    const port = guessApiPort(cell, plan)
    const env = resolveEnv(cell, plan, port)
    env.PORT = String(port)
    return {
      name: svcName,
      definition: {
        build: { context: relBuildContext },
        restart: 'unless-stopped',
        ports: [`${port}:${port}`],
        environment: env,
        depends_on: dependsOn(cell, plan),
      },
    }
  }

  if (cell.adapterType.startsWith('vite/')) {
    const port = 80 // nginx in vite Dockerfile serves on 80
    const exposed = 5173
    return {
      name: svcName,
      definition: {
        build: { context: relBuildContext },
        restart: 'unless-stopped',
        ports: [`${exposed}:${port}`],
        environment: resolveEnv(cell, plan, exposed),
        depends_on: dependsOn(cell, plan),
      },
    }
  }

  // db-cell is init/migration logic, not a runtime service — skip
  return null
}

function serviceNameForCell(cellName: string): string {
  // api-cell → api, api-cell-nestjs → api-nestjs, ui-cell → ui
  return cellName.replace(/-cell/g, '').replace(/^-|-$/g, '') || cellName
}

function guessApiPort(cell: ResolvedCell, _plan: EnvironmentPlan): number {
  // Prefer adapter-native port. Construct.config.port describes deploy-target
  // infra (e.g. ECS task port) which may collide when multiple cells share a
  // construct (e.g. express + nestjs both pointing at api-server).
  if (cell.adapterType === 'node/nestjs') return 3000
  if (cell.adapterType === 'node/express') return 3001
  return 3000
}

// ──────────────── variable resolution ────────────────

function resolveEnv(
  cell: ResolvedCell,
  plan: EnvironmentPlan,
  selfPort: number,
): Record<string, string> {
  const env: Record<string, string> = {}
  for (const v of cell.variables) {
    const val = resolveVariable(v, cell, plan, selfPort)
    if (val !== undefined) env[v.name] = val
  }
  return env
}

function resolveVariable(
  v: ResolvedVariable,
  cell: ResolvedCell,
  plan: EnvironmentPlan,
  selfPort: number,
): string | undefined {
  if (v.source === 'literal') return v.value
  if (v.source === 'env') return `\${${v.name}:-}`
  if (v.source === 'secret') return devSecretDefault(v.name, plan)
  if (v.source === 'output') return resolveOutputRef(v.value ?? '', plan)
  return undefined
}

/**
 * Dev-time defaults for secret-sourced variables. Produces sane local values
 * so compose "just works" without a real secret store. Production delivery
 * adapters will wire these to actual secret managers.
 */
function devSecretDefault(name: string, plan: EnvironmentPlan): string {
  if (name === 'DATABASE_URL') {
    const dbConstruct = plan.constructs.find(
      (c) => c.category === 'storage' && c.type === 'database' && c.config?.engine === 'postgres',
    )
    if (dbConstruct) {
      const dbName = findDbCellDatabase(plan) ?? 'postgres'
      return `postgresql://postgres:postgres@${dbConstruct.name}:5432/${dbName}`
    }
  }
  if (name === 'REDIS_URL') {
    const cache = plan.constructs.find(
      (c) => c.category === 'storage' && c.type === 'cache' && c.config?.engine === 'redis',
    )
    if (cache) return `redis://${cache.name}:6379`
  }
  // Unresolved secrets → passthrough from deployer's env
  return `\${${name}:-}`
}

function findDbCellDatabase(plan: EnvironmentPlan): string | undefined {
  const dbCell = plan.cells.find((c) => c.adapterType === 'postgres')
  return dbCell?.adapterConfig?.database
}

/**
 * Resolve an output reference like "api-cell.api_url" to a compose-internal
 * URL using the producing cell's service name and port.
 */
function resolveOutputRef(ref: string, plan: EnvironmentPlan): string {
  const [cellName] = ref.split('.')
  const producer = plan.cells.find((c) => c.name === cellName)
  if (!producer) return `\${${ref.replace(/\./g, '_').toUpperCase()}:-}`
  const svc = serviceNameForCell(producer.name)
  const port = guessApiPort(producer, plan)
  return `http://${svc}:${port}`
}

// ──────────────── depends_on ────────────────

function dependsOn(cell: ResolvedCell, plan: EnvironmentPlan): string[] {
  const deps: string[] = []
  // Depend on any storage construct the cell references that we emit as a service
  for (const cName of cell.constructs) {
    const c = plan.constructs.find((x) => x.name === cName)
    if (!c) continue
    if (c.category !== 'storage') continue
    const isPostgres = c.type === 'database' && c.config?.engine === 'postgres'
    const isRedis = c.type === 'cache' && c.config?.engine === 'redis'
    if (isPostgres || isRedis) deps.push(c.name)
  }
  // Depend on producer cells of any `output`-sourced variable
  for (const v of cell.variables) {
    if (v.source === 'output' && v.value) {
      const [producerName] = v.value.split('.')
      const producer = plan.cells.find((c) => c.name === producerName && c.name !== cell.name)
      if (producer) {
        const svc = serviceNameForCell(producer.name)
        if (!deps.includes(svc)) deps.push(svc)
      }
    }
  }
  return deps
}

// ──────────────── YAML rendering (minimal, no dep) ────────────────

function renderYaml(doc: any, indent = 0): string {
  const pad = '  '.repeat(indent)
  if (doc === null) return pad + '{}\n'
  if (Array.isArray(doc)) {
    if (doc.length === 0) return pad + '[]\n'
    return doc.map((item) => pad + '- ' + yamlScalar(item)).join('\n') + '\n'
  }
  if (typeof doc === 'object') {
    const lines: string[] = []
    for (const [k, v] of Object.entries(doc)) {
      if (v === null || v === undefined) {
        lines.push(`${pad}${k}:`)
      } else if (Array.isArray(v)) {
        if (v.length === 0) {
          lines.push(`${pad}${k}: []`)
        } else {
          lines.push(`${pad}${k}:`)
          for (const item of v) {
            lines.push(`${pad}  - ${yamlScalar(item)}`)
          }
        }
      } else if (typeof v === 'object') {
        lines.push(`${pad}${k}:`)
        lines.push(renderYaml(v, indent + 1).replace(/\n$/, ''))
      } else {
        lines.push(`${pad}${k}: ${yamlScalar(v)}`)
      }
    }
    return lines.join('\n') + '\n'
  }
  return pad + yamlScalar(doc) + '\n'
}

function yamlScalar(v: any): string {
  if (v === null || v === undefined) return '~'
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  const s = String(v)
  // Quote if contains special chars, leading/trailing whitespace, or looks like yes/no/number
  if (/[:#\[\]{}&*!|>'"%@`,]/.test(s) || /^\s|\s$/.test(s) || /^(yes|no|true|false|null|~)$/i.test(s) || /^-?\d/.test(s)) {
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  }
  return s
}

// ──────────────── README ────────────────

function renderReadme(
  plan: EnvironmentPlan,
  services: string[],
  skipped: Array<{ name: string; kind: string; reason: string }>,
): string {
  const lines = [
    `# ${plan.domain} — ${plan.environment} deployment (docker-compose)`,
    ``,
    `Generated by \`cba deliver ${plan.domain} --env ${plan.environment} --adapter docker-compose\`.`,
    ``,
    `## Services`,
    ``,
    ...services.map((s) => `- \`${s}\``),
    ``,
    `## Run`,
    ``,
    '```bash',
    `cd output/${plan.domain}-deploy`,
    `docker compose up -d`,
    '```',
    ``,
  ]
  if (skipped.length) {
    lines.push(`## Skipped`, ``)
    for (const s of skipped) {
      lines.push(`- \`${s.name}\` (${s.kind}) — ${s.reason}`)
    }
    lines.push(``)
  }
  lines.push(
    `## Regenerating`,
    ``,
    `This file and \`docker-compose.yml\` are regenerated from Technical DNA`,
    `on every \`cba deliver\`. Do not edit by hand — edit the DNA instead.`,
    ``,
  )
  return lines.join('\n')
}
