/**
 * Fastify build-conformance suite.
 *
 * What it asserts: for both compute targets the api-cell adapter ships, the
 * generated directory survives a clean `npm install && npm run build` from a
 * fresh tmpdir. ECS produces only `dist/main.js`; Lambda produces both
 * `dist/main.js` and `dist/handler.js`.
 *
 * Why it exists: the four fastify deps (`fastify`, `@fastify/cors`,
 * `@fastify/swagger`, `@fastify/swagger-ui`) carry strict peer-version
 * constraints — drift in any one re-introduces FST_ERR_PLUGIN_VERSION_MISMATCH
 * at startup. Unit tests on the generator can't catch that; only a real
 * install can. This suite is the regression net for adapter-template version
 * drift.
 *
 * Slow on purpose: real `npm install` per fixture, a few minutes wall-clock.
 * Excluded from the default `npm test`; run via `npm run test:fastify-build`.
 */
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as fastifyAdapter from '../../src/adapters/node/fastify'
import { ProductApiDNA, ProductCoreDNA } from '../../src/types'

const FIXTURES = path.resolve(__dirname)
const TIMEOUT_MS = 10 * 60 * 1000 // npm install + tsc can be slow under cold caches

interface Fixture {
  label: string
  dir: string
  expectMainJs: boolean
  expectHandlerJs: boolean
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

const fixtures: Fixture[] = [
  {
    label: 'fixture-ecs (default compute, no `compute` field set)',
    dir: 'fixture-ecs',
    expectMainJs: true,
    expectHandlerJs: false,
  },
  {
    label: 'fixture-lambda (`compute: "lambda"`)',
    dir: 'fixture-lambda',
    expectMainJs: true, // main.ts is also emitted in lambda for local dev
    expectHandlerJs: true,
  },
]

describe.each(fixtures)('fastify build-conformance — $label', (f) => {
  let outDir: string

  beforeAll(() => {
    outDir = fs.mkdtempSync(path.join(os.tmpdir(), `fastify-conform-${f.dir}-`))
    const { api, core, adapterConfig } = readFixture(f.dir)
    fastifyAdapter.generate(api, core, outDir, undefined, adapterConfig as any)
    runBuild(outDir)
  }, TIMEOUT_MS)

  afterAll(() => {
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
})
