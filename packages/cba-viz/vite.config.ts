import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import https from 'node:https'
import { exec, execFile } from 'node:child_process'

/** Path to the cba CLI binary, resolved from the monorepo root. */
const CBA_BIN = path.resolve(__dirname, '../cba/bin/cba')

// ── Status probe cache + in-flight guard ─────────────────────────────────
//
// Client polls /api/status every 5s. The terraform/aws probe can take longer
// than a single poll interval if we're not careful (HTTP healthchecks,
// tfstate reads). These module-level maps give us two things:
//
//   1. TTL cache — rapid callers within CACHE_TTL_MS reuse the last result
//   2. In-flight dedup — if a probe is still running when a second caller
//      arrives, they await the same Promise instead of stacking probes
//
// TTL is set under the client's 5s poll interval so each poll naturally
// triggers a fresh probe but bursty requests (e.g. tab refocus) coalesce.
const STATUS_CACHE_TTL_MS = 3500
const statusCache = new Map<string, { at: number; data: Record<string, string> }>()
const statusInflight = new Map<string, Promise<Record<string, string>>>()

function getCachedStatus(
  key: string,
  fetcher: () => Promise<Record<string, string>>,
): Promise<Record<string, string>> {
  const now = Date.now()
  const cached = statusCache.get(key)
  if (cached && now - cached.at < STATUS_CACHE_TTL_MS) return Promise.resolve(cached.data)

  const inflight = statusInflight.get(key)
  if (inflight) return inflight

  const p = fetcher()
    .then((data) => {
      statusCache.set(key, { at: Date.now(), data })
      statusInflight.delete(key)
      return data
    })
    .catch((err) => {
      statusInflight.delete(key)
      throw err
    })
  statusInflight.set(key, p)
  return p
}

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

        // GET /api/dna/:layer/:domain — read a raw DNA layer file.
        //
        // Layer-agnostic load endpoint used by the operational (and future
        // product) editors. Unlike /api/load-views — which shells out to
        // `cba views` to get a derived technical graph — this reads the
        // on-disk layer document verbatim so the viewer can round-trip
        // edits directly. Layer is a URL-safe token (see LAYER_FILES).
        const dnaLoadMatch = req.url?.match(/^\/api\/dna\/([^/]+)\/(.+)$/)
        if (req.method === 'GET' && dnaLoadMatch) {
          const layer = decodeURIComponent(dnaLoadMatch[1])
          const domain = decodeURIComponent(dnaLoadMatch[2])
          const filePath = resolveDnaFile(domain, layer)
          if (!filePath) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: `Unknown layer "${layer}"` }))
            return
          }
          if (!fs.existsSync(filePath)) {
            res.statusCode = 404
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: `${layer}.json not found for domain "${domain}"` }))
            return
          }
          try {
            const raw = fs.readFileSync(filePath, 'utf-8')
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(raw)
          } catch (err) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: String(err) }))
          }
          return
        }

        // POST /api/dna/:layer/:domain — atomic write of a raw DNA layer.
        //
        // Body is the full layer document (same shape the GET returned). We
        // write to a sibling `.tmp` file then rename so a crash mid-write
        // can't leave a half-written JSON on disk. The operational editor
        // uses this to round-trip edits from the RJSF form.
        const dnaSaveMatch = req.url?.match(/^\/api\/dna\/([^/]+)\/(.+)$/)
        if (req.method === 'POST' && dnaSaveMatch) {
          const layer = decodeURIComponent(dnaSaveMatch[1])
          const domain = decodeURIComponent(dnaSaveMatch[2])
          const filePath = resolveDnaFile(domain, layer)
          if (!filePath) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: `Unknown layer "${layer}"` }))
            return
          }
          let body = ''
          req.on('data', (chunk: string) => { body += chunk })
          req.on('end', () => {
            try {
              // Validate JSON before touching disk
              const parsed = JSON.parse(body)
              const formatted = JSON.stringify(parsed, null, 2) + '\n'
              const tmpPath = `${filePath}.tmp`
              fs.writeFileSync(tmpPath, formatted, 'utf-8')
              fs.renameSync(tmpPath, filePath)
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: true }))
            } catch (err) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: String(err) }))
            }
          })
          return
        }

        // GET /api/schemas/:family/:name — serve a JSON schema from the
        // repo's layer schema directories (operational/schemas,
        // product/schemas, technical/schemas). The RJSF-driven inspector
        // forms fetch these at runtime so there's one source of truth for
        // schemas across CLI, validator, and viewer.
        //
        // `name` can be multi-segment (e.g. `api/endpoint` resolving to
        // `product/schemas/api/endpoint.json`) since product schemas live
        // in typed subdirectories. The greedy `(.+?)` with a query/frag
        // terminator captures everything after the family segment.
        const schemaMatch = req.url?.match(/^\/api\/schemas\/([^/]+)\/([^?]+?)\/?$/)
        if (req.method === 'GET' && schemaMatch) {
          const family = decodeURIComponent(schemaMatch[1])
          const name = decodeURIComponent(schemaMatch[2]).replace(/\.json$/, '')
          const filePath = resolveSchemaFile(family, name)
          if (!filePath || !fs.existsSync(filePath)) {
            res.statusCode = 404
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: `Schema "${family}/${name}" not found` }))
            return
          }
          try {
            const raw = fs.readFileSync(filePath, 'utf-8')
            const parsed = JSON.parse(raw)
            // Dereference external $refs (e.g. noun.json → attribute.json) so
            // RJSF's ajv validator can resolve them — it only handles refs
            // inside the current document, not across URIs. See inlineRefs().
            const dereferenced = inlineRefs(parsed)
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(dereferenced))
          } catch (err) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: String(err) }))
          }
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
        // GET /api/status/:domain?adapter=docker-compose|terraform/aws&env=dev|prod
        // Domain can be nested (e.g. torts/marshall). The env is used to apply
        // the technical.json overlay before matching against the adapter's
        // runtime surface (dev → local docker, prod → AWS).
        const statusMatch = req.url?.match(/^\/api\/status\/([^?]+)/)
        if (req.method === 'GET' && statusMatch) {
          const domain = decodeURIComponent(statusMatch[1])
          const urlObj = new URL(req.url!, `http://${req.headers.host}`)
          const adapter = urlObj.searchParams.get('adapter') ?? 'docker-compose'
          const env = urlObj.searchParams.get('env') ?? (adapter === 'terraform/aws' ? 'prod' : 'dev')

          const respond = (statuses: Record<string, string>) => {
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(statuses))
          }

          if (adapter === 'terraform/aws') {
            getCachedStatus(`tf:${domain}:${env}`, () => probeTerraformStatusAsync(domain, env))
              .then(respond)
              .catch(() => respond({}))
            return
          }
          getCachedStatus(`docker:${domain}:${env}`, () => probeDockerStatusAsync(domain, env))
            .then(respond)
            .catch(() => respond({}))
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
function probeDockerStatusAsync(domain: string, env: string): Promise<Record<string, string>> {
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

        const technical = loadTechnical(domain)
        if (!technical) { resolve({}); return }

        const cells: Array<{ name: string }> = technical.cells ?? []
        // Apply env overlay so we only match the constructs that belong to this
        // environment (e.g. dev → local postgres/RabbitMQ, prod → RDS/EventBridge).
        const constructs = overlayByName<{ name: string }>(technical.constructs ?? [], env)
        const constructIds = new Set<string>(constructs.map((c) => c.name))
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
 * Designed to complete well under the client's 5s poll interval by avoiding
 * per-node AWS CLI spawning. Signal sources:
 *
 *   1. `terraform.tfstate` (direct fs read) → source of truth for what was
 *      deployed. Outputs like `alb_dns_name`, `cloudfront_domain_<tfid>`,
 *      `rds_endpoint_<tfid>`, `eventbridge_bus_name_<tfid>`, `sqs_queue_url_<tfid>`
 *      exist iff the terraform apply that created them succeeded.
 *
 *   2. HTTP healthchecks on the URLs extracted from outputs:
 *        - API cells → `http://<alb_dns>/health` (ALB target group already
 *          health-checks /health, so the API implements it)
 *        - UI cells  → `https://<cloudfront_domain>/`
 *      A 2xx/3xx/4xx response means the endpoint is answering; only connection
 *      errors / 5xx mark it as unreachable.
 *
 *   3. Construct presence in outputs (RDS / EventBridge / SQS). We don't
 *      currently HTTP-probe these — their appearance in outputs is a reliable
 *      proxy for "terraform apply finished for this resource".
 *
 * `env` is applied as an overlay on technical.json so that dev-only variants
 * (local Postgres, RabbitMQ) don't show up when probing the prod surface,
 * and vice versa. Providers are implicitly "deployed" (they're config).
 */
function probeTerraformStatusAsync(domain: string, env: string): Promise<Record<string, string>> {
  return new Promise((resolve) => {
    const technical = loadTechnical(domain)
    if (!technical) { resolve({}); return }

    // Apply env overlay — for prod, dev-only constructs (local postgres,
    // rabbitmq) are filtered out, so we only probe what's actually in AWS.
    const cells = overlayByName<any>(technical.cells ?? [], env)
    const constructs = overlayByName<any>(technical.constructs ?? [], env)

    const deployDir = path.resolve(__dirname, '../../output', `${domain}-deploy`)
    const tf = readTfState(deployDir)

    const result: Record<string, string> = {}
    for (const c of cells) result[c.name] = 'planned'
    for (const c of constructs) result[c.name] = 'planned'
    for (const p of technical.providers ?? []) result[p.name] = 'deployed'

    // No state → nothing has been applied for this domain
    if (!tf || Object.keys(tf.outputs).length === 0) { resolve(result); return }

    // Reverse tfId lookups so we can turn `cloudfront_domain_ui_cell` → `ui-cell`
    const tfIdToCell = new Map<string, any>()
    for (const c of cells) tfIdToCell.set(tfId(c.name), c)
    const tfIdToConstruct = new Map<string, any>()
    for (const c of constructs) tfIdToConstruct.set(tfId(c.name), c)

    // ── Constructs: presence of their output = deployed ──
    for (const [outName] of Object.entries(tf.outputs)) {
      const patterns: Array<[RegExp, Map<string, any>]> = [
        [/^rds_endpoint_(.+)$/, tfIdToConstruct],
        [/^eventbridge_bus_name_(.+)$/, tfIdToConstruct],
        [/^sqs_queue_url_(.+)$/, tfIdToConstruct],
      ]
      for (const [re, table] of patterns) {
        const m = outName.match(re)
        if (m) {
          const node = table.get(m[1])
          if (node) result[node.name] = 'deployed'
        }
      }
    }

    // ── Cells: build URL map from outputs, then HTTP healthcheck ──
    const cellUrls = new Map<string, string>()

    // Any non-vite cell shares a single ALB; use /health (ALB target group
    // already uses this path).
    const albDns = typeof tf.outputs.alb_dns_name === 'string' ? tf.outputs.alb_dns_name : undefined
    if (albDns) {
      for (const c of cells) {
        const adapterType: string = c.adapter?.type ?? ''
        const isProvisioner = adapterType === 'postgres' || adapterType === 'node/event-bus'
        const isVite = adapterType.startsWith('vite/')
        if (!isProvisioner && !isVite) {
          cellUrls.set(c.name, `http://${albDns}/health`)
        }
      }
    }

    // Vite cells → CloudFront
    for (const [outName, value] of Object.entries(tf.outputs)) {
      const m = outName.match(/^cloudfront_domain_(.+)$/)
      if (m && typeof value === 'string') {
        const cell = tfIdToCell.get(m[1])
        if (cell) cellUrls.set(cell.name, `https://${value}/`)
      }
    }

    // Run healthchecks concurrently with a 2s per-request budget. The whole
    // fan-out completes in ~max(latency) rather than sum(latency).
    const checks: Array<Promise<void>> = []
    for (const [cellName, url] of cellUrls) {
      checks.push(
        httpOk(url, 2000).then((ok) => {
          if (ok) result[cellName] = 'deployed'
        }),
      )
    }
    Promise.all(checks).then(() => resolve(result)).catch(() => resolve(result))
  })
}

// ── DNA layer + schema resolution ────────────────────────────────────────
//
// URL-safe layer tokens map to on-disk filenames. Dots in `product.core` /
// `product.api` / `product.ui` are awkward in URL path segments and would
// collide with file extension sniffing, so we use dashes in the URL and
// translate at the boundary. Mirrors packages/cba/src/context.ts:LAYERS but
// inlined here to avoid a cross-package import (cba has a build step).
const LAYER_FILES: Record<string, string> = {
  'operational': 'operational.json',
  'product-core': 'product.core.json',
  'product-api': 'product.api.json',
  'product-ui': 'product.ui.json',
  'technical': 'technical.json',
}

function resolveDnaFile(domain: string, layer: string): string | null {
  const file = LAYER_FILES[layer]
  if (!file) return null
  return path.resolve(__dirname, '../../dna', domain, file)
}

/**
 * Schema families map to top-level schema directories at the repo root.
 * Phase 1 only needs `operational`; product/technical are wired up so the
 * Phase 2 editor can reuse the same endpoint without another config pass.
 */
const SCHEMA_DIRS: Record<string, string> = {
  'operational': 'operational/schemas',
  'product': 'product/schemas',
  'technical': 'technical/schemas',
}

function resolveSchemaFile(family: string, name: string): string | null {
  const dir = SCHEMA_DIRS[family]
  if (!dir) return null
  return path.resolve(__dirname, '../..', dir, `${name}.json`)
}

/**
 * Dereference cross-schema `$ref`s into a self-contained document.
 *
 * JSON Schemas in this repo use absolute URIs like
 * `https://dna.local/operational/attribute` as refs across files. RJSF's
 * bundled ajv validator only resolves internal references (`#/...`), so
 * without preprocessing a form for a Noun explodes with "Could not find
 * a definition for https://dna.local/operational/attribute".
 *
 * We fix that server-side by walking the loaded schema, loading each
 * referenced external schema file, and stashing it under a root `$defs`
 * section with a local pointer. Repeated refs reuse the same entry, and
 * cycles are broken by pre-marking the def key before recursing.
 *
 * Inlined schemas have their `$id` / `$schema` stripped because those
 * create nested scopes inside ajv that would re-introduce the absolute
 * URI lookup we're trying to avoid.
 */
function inlineRefs(rootSchema: unknown): unknown {
  if (!rootSchema || typeof rootSchema !== 'object') return rootSchema
  const defs: Record<string, unknown> = {}

  /**
   * Flatten a family + possibly-nested name into a safe $defs key.
   * `operational, attribute` → `operational_attribute`
   * `product, core/resource`  → `product_core_resource`
   */
  function defKey(family: string, name: string): string {
    return `${family}_${name.replace(/\//g, '_')}`
  }

  function loadExternal(family: string, name: string): unknown | null {
    const file = resolveSchemaFile(family, name)
    if (!file || !fs.existsSync(file)) return null
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf-8'))
      // Strip $id / $schema — ajv treats $id as a new base URI for
      // nested resolution and would re-fetch the absolute URI we just
      // worked around. A pure structural schema without $id is safer.
      if (raw && typeof raw === 'object') {
        delete raw.$id
        delete raw.$schema
      }
      return raw
    } catch {
      return null
    }
  }

  function walk(node: unknown): unknown {
    if (!node || typeof node !== 'object') return node
    if (Array.isArray(node)) return node.map(walk)
    const src = node as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(src)) {
      if (key === '$ref' && typeof value === 'string' && value.startsWith('https://dna.local/')) {
        // Strip fragment — we don't currently use subschema pointers,
        // so `https://dna.local/operational/attribute#/foo` is unsupported.
        const cleaned = value.split('#')[0]
        // Path after `dna.local/` can be multi-segment:
        //   operational/attribute          → family=operational, name=attribute
        //   product/core/resource          → family=product,     name=core/resource
        //   product/api/endpoint           → family=product,     name=api/endpoint
        // The first segment is always the family; everything else is the
        // schema name (possibly nested into a family subdirectory).
        const m = cleaned.match(/^https:\/\/dna\.local\/(.+)$/)
        if (m) {
          const parts = m[1].split('/')
          if (parts.length >= 2) {
            const family = parts[0]
            const name = parts.slice(1).join('/')
            const key = defKey(family, name)
            if (!(key in defs)) {
              // Mark before recursing so cyclic refs (A → B → A) don't
              // infinite-loop. We'll overwrite with the real schema next.
              defs[key] = true
              const loaded = loadExternal(family, name)
              defs[key] = loaded ? walk(loaded) : {}
            }
            out['$ref'] = `#/$defs/${key}`
            continue
          }
        }
      }
      out[key] = walk(value)
    }
    return out
  }

  const walked = walk(rootSchema) as Record<string, unknown>
  if (Object.keys(defs).length > 0) {
    const existingDefs = (walked.$defs ?? {}) as Record<string, unknown>
    walked.$defs = { ...existingDefs, ...defs }
  }
  return walked
}

// ── Technical DNA helpers ────────────────────────────────────────────────

/** Load technical.json for a domain. Returns null if missing. */
function loadTechnical(domain: string): any | null {
  const p = path.resolve(__dirname, '../../dna', domain, 'technical.json')
  if (!fs.existsSync(p)) return null
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')) }
  catch { return null }
}

/**
 * Environment overlay: when an entry has an `environment` field matching the
 * target env, it replaces the default (no-env) entry with the same name.
 * Mirrors packages/cba/src/deliver/plan.ts overlayByName.
 */
function overlayByName<T extends { name: string; environment?: string }>(
  list: T[],
  environment: string,
): T[] {
  const out = new Map<string, T>()
  for (const item of list) {
    if (item.environment && item.environment !== environment) continue
    const existing = out.get(item.name)
    if (!existing || (item.environment && !existing.environment)) {
      out.set(item.name, item)
    }
  }
  return Array.from(out.values())
}

/** Convert a DNA name to a terraform identifier (mirrors terraform-aws.ts tfId). */
function tfId(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').toLowerCase()
}

// ── Terraform state + HTTP healthcheck helpers ───────────────────────────

/** Read terraform.tfstate directly. No terraform CLI spawn. */
function readTfState(deployDir: string): { outputs: Record<string, any>; resources: string[] } | null {
  const p = path.join(deployDir, 'terraform.tfstate')
  if (!fs.existsSync(p)) return null
  try {
    const state = JSON.parse(fs.readFileSync(p, 'utf-8'))
    const outputs: Record<string, any> = {}
    for (const [name, entry] of Object.entries<any>(state.outputs ?? {})) {
      outputs[name] = entry?.value
    }
    const resources: string[] = []
    for (const r of state.resources ?? []) resources.push(`${r.type}.${r.name}`)
    return { outputs, resources }
  } catch {
    return null
  }
}

/**
 * HEAD-request a URL with a hard timeout. Returns true on any response
 * (including 4xx) — the goal is "is something answering", not "is it healthy".
 * 5xx and connection errors return false.
 */
function httpOk(urlStr: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false
    const done = (v: boolean) => { if (!settled) { settled = true; resolve(v) } }
    try {
      const url = new URL(urlStr)
      const lib = url.protocol === 'https:' ? https : http
      const req = lib.request({
        method: 'HEAD',
        host: url.hostname,
        port: url.port || undefined,
        path: url.pathname + url.search,
        timeout: timeoutMs,
        headers: { 'User-Agent': 'cba-viz-status/1' },
      }, (res) => {
        const code = res.statusCode ?? 0
        res.resume()
        done(code >= 200 && code < 500)
      })
      req.on('error', () => done(false))
      req.on('timeout', () => { req.destroy(); done(false) })
      req.end()
    } catch {
      done(false)
    }
  })
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
  build: {
    rollupOptions: {
      output: {
        // Split heavy vendor deps into separate chunks so the initial page
        // load doesn't ship JointJS (~1 MB) and the RJSF/ajv stack when
        // neither is needed before the user picks a canvas. Everything
        // unmatched stays in the main chunk.
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('@joint/plus') || id.includes('@joint\\plus')) return 'joint'
          if (id.includes('@rjsf/') || id.includes('@rjsf\\') || /[\\/]node_modules[\\/]ajv(-|[\\/])/.test(id)) return 'rjsf'
          if (
            /[\\/]node_modules[\\/]react[\\/]/.test(id) ||
            /[\\/]node_modules[\\/]react-dom[\\/]/.test(id) ||
            /[\\/]node_modules[\\/]mobx[\\/]/.test(id) ||
            /[\\/]node_modules[\\/]mobx-react-lite[\\/]/.test(id)
          ) {
            return 'vendor'
          }
          return undefined
        },
      },
    },
  },
})
