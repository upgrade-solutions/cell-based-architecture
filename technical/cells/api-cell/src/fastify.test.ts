/**
 * Fastify adapter generation tests — covers both compute targets (ECS + Lambda)
 * by invoking the generator directly on the lending DNA fixture.
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as fastifyAdapter from './adapters/node/fastify'
import { ProductApiDNA, ProductCoreDNA } from './types'

const repoRoot = path.resolve(__dirname, '../../../../')
const dnaBase = path.join(repoRoot, 'dna/lending')

function loadFixture(): { api: ProductApiDNA; core: ProductCoreDNA } {
  const api = JSON.parse(fs.readFileSync(path.join(dnaBase, 'product.api.json'), 'utf-8')) as ProductApiDNA
  const core = JSON.parse(fs.readFileSync(path.join(dnaBase, 'product.core.json'), 'utf-8')) as ProductCoreDNA
  return { api, core }
}

describe('fastify adapter — ECS compute (default)', () => {
  let outDir: string
  beforeAll(() => {
    outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fastify-ecs-'))
    const { api, core } = loadFixture()
    fastifyAdapter.generate(api, core, outDir)
  })

  afterAll(() => {
    fs.rmSync(outDir, { recursive: true, force: true })
  })

  test('emits src/main.ts (server listener)', () => {
    expect(fs.existsSync(path.join(outDir, 'src/main.ts'))).toBe(true)
  })

  test('does NOT emit src/handler.ts', () => {
    expect(fs.existsSync(path.join(outDir, 'src/handler.ts'))).toBe(false)
  })

  test('main.ts calls app.listen()', () => {
    const main = fs.readFileSync(path.join(outDir, 'src/main.ts'), 'utf-8')
    expect(main).toContain('app.listen(')
    expect(main).not.toContain('@fastify/aws-lambda')
  })

  test('emits Dockerfile and .dockerignore', () => {
    expect(fs.existsSync(path.join(outDir, 'Dockerfile'))).toBe(true)
    expect(fs.existsSync(path.join(outDir, '.dockerignore'))).toBe(true)
  })

  test('package.json depends on fastify but NOT @fastify/aws-lambda', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(outDir, 'package.json'), 'utf-8'))
    expect(pkg.dependencies.fastify).toBeDefined()
    expect(pkg.dependencies['@fastify/aws-lambda']).toBeUndefined()
  })

  test('package.json defines start + start:dev scripts', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(outDir, 'package.json'), 'utf-8'))
    expect(pkg.scripts.start).toBe('node dist/main.js')
    expect(pkg.scripts['start:dev']).toBe('ts-node src/main.ts')
    expect(pkg.scripts.package).toBeUndefined()
  })

  test('writes DNA into src/dna/', () => {
    expect(fs.existsSync(path.join(outDir, 'src/dna/api.json'))).toBe(true)
    expect(fs.existsSync(path.join(outDir, 'src/dna/product.core.json'))).toBe(true)
  })

  test('emits the Fastify route registrar', () => {
    const router = fs.readFileSync(path.join(outDir, 'src/interpreter/router.ts'), 'utf-8')
    expect(router).toContain('FastifyInstance')
    expect(router).toContain('app.route(')
    expect(router).toContain('preHandler:')
  })
})

describe('fastify adapter — Lambda compute', () => {
  let outDir: string
  beforeAll(() => {
    outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fastify-lambda-'))
    const { api, core } = loadFixture()
    fastifyAdapter.generate(api, core, outDir, undefined, { compute: 'lambda' })
  })

  afterAll(() => {
    fs.rmSync(outDir, { recursive: true, force: true })
  })

  test('emits src/handler.ts (Lambda entrypoint)', () => {
    expect(fs.existsSync(path.join(outDir, 'src/handler.ts'))).toBe(true)
  })

  test('also emits src/main.ts so contributors can run a local listener', () => {
    expect(fs.existsSync(path.join(outDir, 'src/main.ts'))).toBe(true)
  })

  test('handler imports @fastify/aws-lambda and uses streamifyResponse', () => {
    const handler = fs.readFileSync(path.join(outDir, 'src/handler.ts'), 'utf-8')
    expect(handler).toContain("from '@fastify/aws-lambda'")
    expect(handler).toContain('streamifyResponse')
  })

  test('handler does NOT call app.listen()', () => {
    const handler = fs.readFileSync(path.join(outDir, 'src/handler.ts'), 'utf-8')
    expect(handler).not.toContain('app.listen(')
  })

  test('does NOT emit Dockerfile (Lambda is zip-packaged)', () => {
    expect(fs.existsSync(path.join(outDir, 'Dockerfile'))).toBe(false)
  })

  test('package.json depends on @fastify/aws-lambda', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(outDir, 'package.json'), 'utf-8'))
    expect(pkg.dependencies['@fastify/aws-lambda']).toBeDefined()
  })

  test('package.json defines a package script (zip artifact) instead of start', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(outDir, 'package.json'), 'utf-8'))
    expect(pkg.scripts.package).toBeDefined()
    expect(pkg.scripts.package).toContain('zip')
    expect(pkg.scripts.start).toBeUndefined()
    expect(pkg.scripts['start:dev']).toBeUndefined()
  })

  test('seam: Lambda entrypoint reads product.api.json (until output-openapi ships)', () => {
    const handler = fs.readFileSync(path.join(outDir, 'src/handler.ts'), 'utf-8')
    expect(handler).toContain('dna/api.json')
    // SEAM marker present so the future migration is greppable
    expect(handler).toContain('SEAM')
    expect(handler).toContain('@dna-codes/output-openapi')
  })
})
