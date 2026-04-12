import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'
import { exec, execFile } from 'node:child_process'

/** Path to the cba CLI binary, resolved from the monorepo root. */
const CBA_BIN = path.resolve(__dirname, '../cba/bin/cba')

/**
 * Vite plugin that provides a POST /api/save-views/:domain endpoint
 * for merging updated views back into technical.json during dev.
 */
function saveViewsPlugin() {
  return {
    name: 'save-views',
    configureServer(server: { middlewares: { use: Function } }) {
      server.middlewares.use((req: any, res: any, next: any) => {
        // GET /api/load-views/:domain?env=dev|prod
        // Derives the graph by shelling out to `cba views <domain> --env <env>`.
        // Domain can be nested (e.g. torts/marshall).
        const loadMatch = req.url?.match(/^\/api\/load-views\/([^?]+)/)
        if (req.method === 'GET' && loadMatch) {
          const domain = decodeURIComponent(loadMatch[1])
          const urlObj = new URL(req.url!, `http://${req.headers.host}`)
          const env = urlObj.searchParams.get('env')
          const cbaArgs = ['views', domain, '--json']
          if (env) cbaArgs.push('--env', env)

          execFile(CBA_BIN, cbaArgs, { timeout: 10000 }, (err, stdout, stderr) => {
            if (err) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: stderr?.toString() || err.message }))
              return
            }
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(stdout)
          })
          return
        }

        // POST /api/save-views/:domain — merge views back into technical.json
        const match = req.url?.match(/^\/api\/save-views\/(.+)$/)
        if (req.method === 'POST' && match) {
          const domain = decodeURIComponent(match[1])
          let body = ''
          req.on('data', (chunk: string) => { body += chunk })
          req.on('end', () => {
            try {
              const dnaDir = path.resolve(__dirname, '../../dna', domain)
              const filePath = path.join(dnaDir, 'technical.json')
              if (!fs.existsSync(filePath)) {
                res.statusCode = 404
                res.end(JSON.stringify({ error: `technical.json not found for domain "${domain}"` }))
                return
              }
              const technical = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
              technical.views = JSON.parse(body)
              fs.writeFileSync(filePath, JSON.stringify(technical, null, 2) + '\n', 'utf-8')
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: true }))
            } catch (err) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: String(err) }))
            }
          })
          return
        }
        // GET /api/status/:domain?adapter=docker-compose|terraform/aws
        // Domain can be nested (e.g. torts/marshall)
        const statusMatch = req.url?.match(/^\/api\/status\/([^?]+)/)
        if (req.method === 'GET' && statusMatch) {
          const domain = decodeURIComponent(statusMatch[1])
          const urlObj = new URL(req.url!, `http://${req.headers.host}`)
          const adapter = urlObj.searchParams.get('adapter') ?? 'docker-compose'

          if (adapter === 'terraform/aws') {
            probeTerraformStatusAsync(domain).then((statuses) => {
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(statuses))
            }).catch(() => {
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({}))
            })
            return
          }
          probeDockerStatusAsync(domain).then((statuses) => {
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(statuses))
          }).catch(() => {
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({}))
          })
          return
        }

        next()
      })
    },
  }
}

/**
 * Probe Docker for running/stopped containers and map them to DNA node IDs.
 *
 * Matching strategy (uses docker-compose labels, not brittle name substring checks):
 * 1. Filter containers whose `com.docker.compose.project.working_dir` points at
 *    this domain's deploy dir: `<repo>/output/<domain>-deploy`
 * 2. For each match, read `com.docker.compose.service` to get the service name
 * 3. Map service → DNA node id:
 *      a) direct match on a construct id     (e.g. `primary-db` → primary-db)
 *      b) direct match + `-cell` suffix      (e.g. `api` → api-cell)
 */
function probeDockerStatusAsync(domain: string): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    exec(
      'docker ps -a --format "{{.Names}}\\t{{.State}}\\t{{.Labels}}"',
      { encoding: 'utf-8', timeout: 5000 },
      (err, stdout) => {
        if (err) { reject(err); return }

        const containers = (stdout ?? '').trim().split('\n').filter(Boolean).map((line) => {
          const [name, state, labels] = line.split('\t')
          return {
            name: name ?? '',
            state: state ?? '',
            labels: parseLabels(labels ?? ''),
          }
        })

        const techPath = path.resolve(__dirname, '../../dna', domain, 'technical.json')
        if (!fs.existsSync(techPath)) { resolve({}); return }
        const technical = JSON.parse(fs.readFileSync(techPath, 'utf-8'))

        const cells: Array<{ name: string }> = technical.cells ?? []
        const constructIds = new Set<string>((technical.constructs ?? []).map((c: any) => c.name))
        const cellIds = new Set<string>(cells.map((c) => c.name))

        // Compute the expected deploy dir (absolute path) for this domain
        const expectedDeployDir = path.resolve(__dirname, '../../output', `${domain}-deploy`)

        const result: Record<string, string> = {}

        for (const c of containers) {
          const workingDir = c.labels['com.docker.compose.project.working_dir']
          if (!workingDir) continue
          // Normalize both sides — handle symlinks, trailing slashes
          if (path.resolve(workingDir) !== expectedDeployDir) continue

          const service = c.labels['com.docker.compose.service']
          if (!service) continue

          // Docker compose states: running, exited, created, restarting, paused, dead
          const isRunning = c.state === 'running'
          if (!isRunning) continue // only show "deployed" for running containers

          // Strategy (a): service name is a construct id
          if (constructIds.has(service)) {
            result[service] = 'deployed'
            continue
          }

          // Strategy (b): service name + '-cell' suffix matches a cell
          const cellCandidate = `${service}-cell`
          if (cellIds.has(cellCandidate)) {
            result[cellCandidate] = 'deployed'
            continue
          }

          // Strategy (c): exact cell id match (rare — if someone named service 'api-cell' directly)
          if (cellIds.has(service)) {
            result[service] = 'deployed'
          }
        }

        resolve(result)
      },
    )
  })
}

/** Parse docker labels from comma-separated key=value list */
function parseLabels(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  // Labels can contain commas inside values, so this is imperfect.
  // But compose project labels don't contain commas, so it's fine for our purposes.
  for (const part of raw.split(',')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    out[part.slice(0, eq).trim()] = part.slice(eq + 1).trim()
  }
  return out
}

/**
 * Probe Terraform / AWS for live resource status and map to DNA node IDs.
 *
 * Strategy:
 * 1. Read terraform.tfstate from the deploy dir (if it exists) to get
 *    resource addresses and their types.
 * 2. Map DNA node types → AWS resource checks:
 *    - cell (ECS)        → describe-services / describe-tasks
 *    - construct/database → describe-db-instances
 *    - construct/queue    → EventBridge bus / SQS queue existence
 *    - provider           → always "deployed" (implicit)
 * 3. Fall back to AWS CLI probes if no tfstate exists.
 *
 * Returns a map of DNA node ID → NodeStatus.
 */
function probeTerraformStatusAsync(domain: string): Promise<Record<string, string>> {
  return new Promise((resolve) => {
    const techPath = path.resolve(__dirname, '../../dna', domain, 'technical.json')
    if (!fs.existsSync(techPath)) { resolve({}); return }

    const technical = JSON.parse(fs.readFileSync(techPath, 'utf-8'))

    // Derive node list directly from cells/constructs/providers — views[] is layout-only now
    const nodes: Array<{ id: string; type: string; metadata?: Record<string, any> }> = []
    for (const provider of (technical.providers ?? [])) {
      nodes.push({ id: provider.name, type: 'provider', metadata: { providerType: provider.type } })
    }
    for (const cell of (technical.cells ?? [])) {
      nodes.push({ id: cell.name, type: 'cell', metadata: { adapter: cell.adapter?.type } })
    }
    for (const construct of (technical.constructs ?? [])) {
      nodes.push({
        id: construct.name,
        type: 'construct',
        metadata: { category: construct.category, engine: construct.config?.engine ?? construct.type },
      })
    }

    // Deploy dir preserves the domain slash: output/<domain>-deploy
    // The AWS resource-name prefix collapses slashes: `<domain>-<env>` → torts-marshall-dev
    const awsPrefix = domain.replace(/\//g, '-')
    const deployDir = path.resolve(__dirname, '../../output', `${domain}-deploy`)

    // Try to read terraform state for precise resource mapping
    const tfStatePath = path.join(deployDir, 'terraform.tfstate')
    let tfResources: string[] = []
    if (fs.existsSync(tfStatePath)) {
      try {
        const state = JSON.parse(fs.readFileSync(tfStatePath, 'utf-8'))
        tfResources = extractTfResourceAddresses(state)
      } catch { /* ignore parse errors */ }
    }

    // Build status map by probing AWS resources
    const pending: Array<Promise<void>> = []
    const result: Record<string, string> = {}

    for (const node of nodes) {
      if (node.type === 'provider') {
        // Providers are always "deployed" — they're config, not infrastructure
        result[node.id] = 'deployed'
        continue
      }

      if (node.type === 'cell') {
        // Cells map to ECS services — check if there's a matching service
        pending.push(
          probeEcsService(awsPrefix, node.id, tfResources).then(status => {
            result[node.id] = status
          })
        )
        continue
      }

      if (node.type === 'construct') {
        const engine = node.metadata?.engine as string | undefined
        const category = node.metadata?.category as string | undefined

        if (category === 'storage' && (engine === 'postgres' || !engine)) {
          // Database construct → RDS
          pending.push(
            probeRdsInstance(awsPrefix, node.id, tfResources).then(status => {
              result[node.id] = status
            })
          )
        } else if (engine === 'eventbridge' || engine === 'rabbitmq') {
          // Queue/event-bus construct
          pending.push(
            probeEventBus(awsPrefix, node.id, engine, tfResources).then(status => {
              result[node.id] = status
            })
          )
        } else {
          // Unknown construct — check tfstate for any matching resource
          result[node.id] = tfResources.some(r => r.includes(node.id.replace(/-/g, '_')))
            ? 'deployed'
            : 'planned'
        }
        continue
      }

      // Default: unknown node type
      result[node.id] = 'planned'
    }

    Promise.all(pending).then(() => resolve(result)).catch(() => resolve(result))
  })
}

/** Extract all resource addresses from terraform state JSON */
function extractTfResourceAddresses(state: any): string[] {
  const addrs: string[] = []
  for (const resource of state.resources ?? []) {
    const addr = `${resource.type}.${resource.name}`
    addrs.push(addr)
  }
  return addrs
}

/** Run an AWS CLI command and parse JSON output */
function awsJsonAsync(cmd: string): Promise<any> {
  return new Promise((resolve, reject) => {
    exec(cmd, { encoding: 'utf-8', timeout: 10000 }, (err, stdout) => {
      if (err) { reject(err); return }
      try { resolve(JSON.parse((stdout ?? '').trim() || '{}')) }
      catch { resolve(null) }
    })
  })
}

/** Check if an ECS service exists for a given cell */
async function probeEcsService(prefix: string, nodeId: string, tfResources: string[]): Promise<string> {
  const cellName = nodeId.replace(/-cell/g, '').replace(/^-|-$/g, '') || nodeId
  const tfName = cellName.replace(/-/g, '_')
  const hasTfResource = tfResources.some(r =>
    r.includes(`ecs_service`) && r.includes(tfName)
  ) || tfResources.some(r =>
    r.includes(`ecs_task_definition`) && r.includes(tfName)
  )

  // Probe AWS for the service
  try {
    const clusters = await awsJsonAsync('aws ecs list-clusters --output json')
    const clusterArns: string[] = clusters?.clusterArns ?? []
    for (const arn of clusterArns) {
      if (!arn.includes(prefix)) continue
      const services = await awsJsonAsync(
        `aws ecs list-services --cluster "${arn}" --output json`
      )
      for (const svcArn of (services?.serviceArns ?? []) as string[]) {
        if (svcArn.includes(cellName) || svcArn.includes(nodeId)) {
          return 'deployed'
        }
      }
    }
  } catch { /* AWS CLI not available or not configured */ }

  return hasTfResource ? 'deployed' : 'planned'
}

/** Check if an RDS instance exists for a database construct */
async function probeRdsInstance(prefix: string, nodeId: string, tfResources: string[]): Promise<string> {
  const dbName = nodeId.replace(/-/g, '_')
  const hasTfResource = tfResources.some(r => r.includes('aws_db_instance') && r.includes(dbName))

  try {
    const result = await awsJsonAsync('aws rds describe-db-instances --output json')
    const instances = result?.DBInstances ?? []
    for (const db of instances) {
      const id = (db.DBInstanceIdentifier ?? '').toLowerCase()
      if (id.includes(prefix) && (id.includes(nodeId) || id.includes(nodeId.replace(/-/g, '')))) {
        return 'deployed'
      }
    }
  } catch { /* AWS CLI not available */ }

  return hasTfResource ? 'deployed' : 'planned'
}

/** Check if an EventBridge bus or SQS queue exists */
async function probeEventBus(prefix: string, nodeId: string, engine: string, tfResources: string[]): Promise<string> {
  const busName = nodeId.replace(/-/g, '_')
  const hasTfResource = tfResources.some(r =>
    (r.includes('aws_cloudwatch_event_bus') || r.includes('aws_sqs_queue') || r.includes('aws_sns_topic'))
    && r.includes(busName)
  )

  if (engine === 'eventbridge') {
    try {
      const result = await awsJsonAsync('aws events list-event-buses --output json')
      const buses = result?.EventBuses ?? []
      for (const bus of buses) {
        const name = (bus.Name ?? '').toLowerCase()
        if (name.includes(prefix) || name.includes(nodeId.replace(/-/g, ''))) {
          return 'deployed'
        }
      }
    } catch { /* fall through */ }
  }

  try {
    const result = await awsJsonAsync('aws sqs list-queues --output json')
    const queues: string[] = result?.QueueUrls ?? []
    for (const url of queues) {
      if (url.toLowerCase().includes(prefix) || url.toLowerCase().includes(nodeId.replace(/-/g, ''))) {
        return 'deployed'
      }
    }
  } catch { /* fall through */ }

  return hasTfResource ? 'deployed' : 'planned'
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    saveViewsPlugin(),
  ],
  server: {
    port: 5174,
    fs: {
      allow: [
        // Allow serving files from the repo root (for dna/ imports)
        path.resolve(__dirname, '../..'),
      ],
    },
  },
})
