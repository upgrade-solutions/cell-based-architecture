/**
 * Fastify build- + runtime-conformance suite.
 *
 * What it asserts:
 *   - For both compute targets the api-cell adapter ships, the generated
 *     directory survives a clean `npm install && npm run build` from a fresh
 *     tmpdir. ECS produces only `dist/main.js`; Lambda produces both
 *     `dist/main.js` and `dist/handler.js`.
 *   - For the ECS fixture, the built artifact also boots and serves the docs
 *     surface correctly: `/health` returns 200, `/docs` returns Redoc HTML,
 *     `/api-json` returns valid OpenAPI JSON, and `/` redirects to `/docs`.
 *
 * Why it exists: the four fastify deps (`fastify`, `@fastify/cors`, plus
 * Lambda's `@fastify/aws-lambda`) carry strict peer-version constraints —
 * drift in any one re-introduces FST_ERR_PLUGIN_VERSION_MISMATCH at startup.
 * Unit tests on the generator can't catch that; only a real install can.
 *
 * The runtime block also catches a different class of regression: the docs
 * surface silently breaking when an upstream renderer or a generator change
 * stops emitting the expected markup. (E.g. the original v9/v5 swagger-ui
 * bug where `/api/json` returned `{}` and Swagger UI showed "definition does
 * not specify a valid version field". With Redoc-only, the equivalent
 * regression would be `/docs` no longer including the Redoc CDN reference.)
 *
 * Lambda fixture skips the runtime block deliberately: its handler.ts is
 * invoked by the AWS Lambda runtime, not by `node dist/handler.js`, so there
 * is no long-running entrypoint to spawn against. The build assertions
 * (handler.js exists, deps install cleanly) are the only conformance gate
 * available without standing up Lambda emulation, which is out of scope for
 * this CI suite.
 *
 * Slow on purpose: real `npm install` per fixture, plus a server boot for
 * ECS, a few minutes wall-clock. Excluded from the default `npm test`; run
 * via `npm run test:fastify-build`.
 */
import { spawn, ChildProcess, execSync } from 'child_process'
import * as fs from 'fs'
import * as http from 'http'
import * as net from 'net'
import * as os from 'os'
import * as path from 'path'
import * as fastifyAdapter from '../../src/adapters/node/fastify'
import { ProductApiDNA, ProductCoreDNA } from '../../src/types'

interface HttpResponse {
  status: number
  headers: Record<string, string | string[] | undefined>
  body: string
}

function httpGet(url: string, opts: { followRedirect?: boolean } = {}): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8')
        const status = res.statusCode ?? 0
        if (
          opts.followRedirect &&
          [301, 302, 307, 308].includes(status) &&
          typeof res.headers.location === 'string'
        ) {
          // Resolve relative locations against the original URL
          const next = new URL(res.headers.location, url).toString()
          httpGet(next, opts).then(resolve, reject)
          return
        }
        resolve({ status, headers: res.headers, body })
      })
      res.on('error', reject)
    })
    req.on('error', reject)
    req.setTimeout(10_000, () => req.destroy(new Error(`request timeout: ${url}`)))
  })
}

const FIXTURES = path.resolve(__dirname)
const TIMEOUT_MS = 10 * 60 * 1000 // npm install + tsc can be slow under cold caches
const HEALTH_TIMEOUT_MS = 30 * 1000

interface Fixture {
  label: string
  dir: string
  expectMainJs: boolean
  expectHandlerJs: boolean
  runtime: boolean
}

function readFixture(name: string): {
  api: ProductApiDNA
  core: ProductCoreDNA
  adapterConfig: Record<string, unknown> | undefined
} {
  const dir = path.join(FIXTURES, name)
  const api = JSON.parse(fs.readFileSync(path.join(dir, 'product.api.json'), 'utf-8')) as ProductApiDNA
  const core = JSON.parse(fs.readFileSync(path.join(dir, 'product.core.json'), 'utf-8')) as ProductCoreDNA
  const technical = JSON.parse(fs.readFileSync(path.join(dir, 'technical.json'), 'utf-8'))
  const cell = technical.cells.find((c: any) => c.name === 'api')
  return { api, core, adapterConfig: cell?.adapter?.config }
}

function runBuild(outDir: string): void {
  // --no-audit/--no-fund: cut network noise and CI flake on the audit endpoint.
  // --prefer-offline: when a previous fixture warmed the npm cache, skip the
  // registry roundtrip for the second fixture. First fixture still goes online.
  execSync('npm install --no-audit --no-fund --prefer-offline', {
    cwd: outDir,
    stdio: 'inherit',
  })
  execSync('npm run build', { cwd: outDir, stdio: 'inherit' })
}

/**
 * Claim a free port from the OS by binding to :0 then closing the listener
 * before passing the port to the api. Race window between close() and the
 * api's listen() exists but is small enough that a CI flake here points at a
 * real OS-level port-exhaustion problem, not at this helper.
 */
function pickFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, () => {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      server.close(() => resolve(port))
    })
  })
}

async function waitForHealth(port: number, timeoutMs: number): Promise<void> {
  const start = Date.now()
  let lastErr: unknown
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await httpGet(`http://127.0.0.1:${port}/health`)
      if (res.status === 200) return
    } catch (e) {
      lastErr = e
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  const errMsg = lastErr instanceof Error ? lastErr.message : String(lastErr ?? 'n/a')
  throw new Error(`server did not become healthy on :${port} within ${timeoutMs}ms (last err: ${errMsg})`)
}

async function bootServer(outDir: string, port: number): Promise<ChildProcess> {
  // Empty DATABASE_URL forces the in-memory store path
  // (see store.ts: `const useDb = !!process.env.DATABASE_URL`). Don't rely on
  // the generated .env file alone — CI may have DATABASE_URL set globally.
  const proc = spawn('node', ['dist/main.js'], {
    cwd: outDir,
    env: { ...process.env, PORT: String(port), DATABASE_URL: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const captured: string[] = []
  proc.stdout?.on('data', (d) => captured.push(`[api stdout] ${d.toString()}`))
  proc.stderr?.on('data', (d) => captured.push(`[api stderr] ${d.toString()}`))
  try {
    await waitForHealth(port, HEALTH_TIMEOUT_MS)
  } catch (e) {
    // Surface server logs on boot failure so CI shows what went wrong.
    process.stderr.write(captured.join(''))
    throw e
  }
  return proc
}

async function stopServer(proc: ChildProcess | null): Promise<void> {
  if (!proc || proc.killed) return
  proc.kill('SIGTERM')
  await new Promise<void>((resolve) => {
    const t = setTimeout(() => {
      try {
        proc.kill('SIGKILL')
      } catch (_) {
        /* already gone */
      }
      resolve()
    }, 5000)
    proc.once('exit', () => {
      clearTimeout(t)
      resolve()
    })
  })
}

const fixtures: Fixture[] = [
  {
    label: 'fixture-ecs (default compute, no `compute` field set)',
    dir: 'fixture-ecs',
    expectMainJs: true,
    expectHandlerJs: false,
    runtime: true,
  },
  {
    label: 'fixture-lambda (`compute: "lambda"`)',
    dir: 'fixture-lambda',
    expectMainJs: true, // main.ts is also emitted in lambda for local dev
    expectHandlerJs: true,
    runtime: false, // see file-level comment for why lambda skips the runtime block
  },
]

describe.each(fixtures)('fastify build-conformance — $label', (f) => {
  let outDir: string
  let serverProc: ChildProcess | null = null
  let port = 0

  beforeAll(async () => {
    outDir = fs.mkdtempSync(path.join(os.tmpdir(), `fastify-conform-${f.dir}-`))
    const { api, core, adapterConfig } = readFixture(f.dir)
    fastifyAdapter.generate(api, core, outDir, undefined, adapterConfig as any)
    runBuild(outDir)
    if (f.runtime) {
      port = await pickFreePort()
      serverProc = await bootServer(outDir, port)
    }
  }, TIMEOUT_MS)

  afterAll(async () => {
    await stopServer(serverProc)
    if (outDir) fs.rmSync(outDir, { recursive: true, force: true })
  })

  test('generated directory builds cleanly', () => {
    expect(fs.existsSync(path.join(outDir, 'dist'))).toBe(true)
  })

  test('dist/main.js presence matches compute target', () => {
    expect(fs.existsSync(path.join(outDir, 'dist/main.js'))).toBe(f.expectMainJs)
  })

  test('dist/handler.js presence matches compute target', () => {
    expect(fs.existsSync(path.join(outDir, 'dist/handler.js'))).toBe(f.expectHandlerJs)
  })

  // ── Runtime assertions (ECS only) ────────────────────────────────────────
  ;(f.runtime ? test : test.skip)('GET /docs returns Redoc HTML', async () => {
    const res = await httpGet(`http://127.0.0.1:${port}/docs`)
    expect(res.status).toBe(200)
    // Two markers: the redoc custom element and the Redoc CDN bundle. Either
    // one alone could regress without breaking rendering visually; both
    // failing is the signal that the docs page lost its Redoc seam.
    expect(res.body).toContain("<redoc spec-url='/api-json'>")
    expect(res.body).toContain('redoc.standalone.js')
  })

  ;(f.runtime ? test : test.skip)('GET /api-json returns valid OpenAPI JSON', async () => {
    const res = await httpGet(`http://127.0.0.1:${port}/api-json`)
    expect(res.status).toBe(200)
    const spec = JSON.parse(res.body) as Record<string, unknown>
    // The conformance fixture deliberately ships an empty `endpoints` array,
    // so `paths` may be empty / missing. The version field is the regression
    // marker — its absence is what Swagger UI used to complain about, and
    // would still indicate a broken /api-json wiring.
    const hasOpenApi = typeof spec.openapi === 'string' && (spec.openapi as string).startsWith('3.')
    const hasSwagger = spec.swagger === '2.0'
    expect(hasOpenApi || hasSwagger).toBe(true)
  })

  ;(f.runtime ? test : test.skip)('GET / redirects to /docs', async () => {
    const res = await httpGet(`http://127.0.0.1:${port}/`)
    expect([301, 302, 307, 308]).toContain(res.status)
    expect(res.headers.location).toBe('/docs')
  })
})
