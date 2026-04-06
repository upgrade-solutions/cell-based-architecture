/**
 * UI-cell adapter conformance tests — verify all ui-cell adapters produce the
 * same DNA-driven surface from the same Product UI DNA input.
 *
 * Each adapter generates into a temp dir. We verify:
 *   - Same DNA files bundled (ui, api, operational)
 *   - Same block types supported (form, table, detail, actions, empty-state)
 *   - Same config structure
 *   - Dockerfile present
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { run } from './run'

// ── Helpers ──────────────────────────────────────────────────────────────────

function listFilesRecursive(dir: string, base = ''): string[] {
  const result: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      result.push(...listFilesRecursive(path.join(dir, entry.name), rel))
    } else {
      result.push(rel)
    }
  }
  return result
}

// ── Test suite ───────────────────────────────────────────────────────────────

describe('ui-cell adapter conformance', () => {
  const repoRoot = path.resolve(__dirname, '../../../../')
  const technicalPath = path.join(repoRoot, 'dna/lending/technical.json')

  let viteReactDir: string
  let viteVueDir: string
  let nextReactDir: string

  beforeAll(() => {
    viteReactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-conform-vite-react-'))
    viteVueDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-conform-vite-vue-'))
    nextReactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-conform-next-react-'))

    run(technicalPath, 'ui-cell', viteReactDir)
    run(technicalPath, 'vue-ui-cell', viteVueDir)
    run(technicalPath, 'ui-cell-next', nextReactDir)
  })

  afterAll(() => {
    fs.rmSync(viteReactDir, { recursive: true, force: true })
    fs.rmSync(viteVueDir, { recursive: true, force: true })
    fs.rmSync(nextReactDir, { recursive: true, force: true })
  })

  // ── DNA bundling conformance ─────────────────────────────────────────────

  test('all adapters bundle the Product UI DNA', () => {
    for (const dir of [viteReactDir, viteVueDir, nextReactDir]) {
      const files = listFilesRecursive(dir)
      expect(files.some(f => f.includes('dna/') && f.endsWith('.json') && f.includes('ui'))).toBe(true)
    }
  })

  test('all adapters bundle the Product API DNA', () => {
    for (const dir of [viteReactDir, viteVueDir, nextReactDir]) {
      const files = listFilesRecursive(dir)
      expect(files.some(f => f.includes('dna/') && f.endsWith('.json') && f.includes('api'))).toBe(true)
    }
  })

  test('all adapters bundle the Operational DNA', () => {
    for (const dir of [viteReactDir, viteVueDir, nextReactDir]) {
      const files = listFilesRecursive(dir)
      expect(files.some(f => f.includes('dna/') && f.endsWith('.json') && f.includes('operational'))).toBe(true)
    }
  })

  test('bundled UI DNA is identical across adapters', () => {
    // Find the UI DNA file in each output
    const findDnaFile = (dir: string, pattern: string) => {
      const files = listFilesRecursive(dir)
      const match = files.find(f => f.includes('dna/') && f.includes(pattern) && f.endsWith('.json'))
      return match ? fs.readFileSync(path.join(dir, match), 'utf-8') : null
    }

    const viteReactUi = findDnaFile(viteReactDir, 'ui')
    const viteVueUi = findDnaFile(viteVueDir, 'ui')
    const nextReactUi = findDnaFile(nextReactDir, 'ui')

    expect(viteReactUi).not.toBeNull()
    expect(viteReactUi).toBe(viteVueUi)
    expect(viteReactUi).toBe(nextReactUi)
  })

  // ── Block types conformance ──────────────────────────────────────────────

  const REQUIRED_BLOCK_TYPES = ['form', 'table', 'detail', 'actions', 'empty-state']

  test('vite/react supports all required block types', () => {
    const files = listFilesRecursive(viteReactDir)
    const blockFiles = files.filter(f => f.includes('blocks/'))
    expect(blockFiles.some(f => /form/i.test(f))).toBe(true)
    expect(blockFiles.some(f => /table/i.test(f))).toBe(true)
    expect(blockFiles.some(f => /detail/i.test(f))).toBe(true)
    expect(blockFiles.some(f => /action/i.test(f))).toBe(true)
    expect(blockFiles.some(f => /empty/i.test(f))).toBe(true)
  })

  test('vite/vue supports all required block types', () => {
    const files = listFilesRecursive(viteVueDir)
    const blockFiles = files.filter(f => f.includes('blocks/'))
    expect(blockFiles.some(f => /form/i.test(f))).toBe(true)
    expect(blockFiles.some(f => /table/i.test(f))).toBe(true)
    expect(blockFiles.some(f => /detail/i.test(f))).toBe(true)
    expect(blockFiles.some(f => /action/i.test(f))).toBe(true)
    expect(blockFiles.some(f => /empty/i.test(f))).toBe(true)
  })

  test('next/react supports all required block types', () => {
    const files = listFilesRecursive(nextReactDir)
    const blockFiles = files.filter(f => f.includes('blocks/'))
    expect(blockFiles.some(f => /form/i.test(f))).toBe(true)
    expect(blockFiles.some(f => /table/i.test(f))).toBe(true)
    expect(blockFiles.some(f => /detail/i.test(f))).toBe(true)
    expect(blockFiles.some(f => /action/i.test(f))).toBe(true)
    expect(blockFiles.some(f => /empty/i.test(f))).toBe(true)
  })

  // ── Config conformance ───────────────────────────────────────────────────

  test('all adapters generate a config.json with DNA fetch paths', () => {
    for (const dir of [viteReactDir, viteVueDir, nextReactDir]) {
      const configPath = path.join(dir, 'public/config.json')
      expect(fs.existsSync(configPath)).toBe(true)
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      expect(config.ui).toBeDefined()
      expect(config.api).toBeDefined()
      expect(config.operational).toBeDefined()
    }
  })

  test('config.json DNA fetch paths are consistent across adapters', () => {
    const configs = [viteReactDir, viteVueDir, nextReactDir].map(dir => {
      return JSON.parse(fs.readFileSync(path.join(dir, 'public/config.json'), 'utf-8'))
    })
    expect(configs[0].ui).toEqual(configs[1].ui)
    expect(configs[0].ui).toEqual(configs[2].ui)
    expect(configs[0].api).toEqual(configs[1].api)
    expect(configs[0].api).toEqual(configs[2].api)
  })

  // ── Scaffold conformance ─────────────────────────────────────────────────

  test('all adapters generate a Dockerfile', () => {
    expect(fs.existsSync(path.join(viteReactDir, 'Dockerfile'))).toBe(true)
    expect(fs.existsSync(path.join(viteVueDir, 'Dockerfile'))).toBe(true)
    expect(fs.existsSync(path.join(nextReactDir, 'Dockerfile'))).toBe(true)
  })

  test('all adapters generate a package.json', () => {
    expect(fs.existsSync(path.join(viteReactDir, 'package.json'))).toBe(true)
    expect(fs.existsSync(path.join(viteVueDir, 'package.json'))).toBe(true)
    expect(fs.existsSync(path.join(nextReactDir, 'package.json'))).toBe(true)
  })

  test('all adapters generate a tsconfig.json', () => {
    expect(fs.existsSync(path.join(viteReactDir, 'tsconfig.json'))).toBe(true)
    expect(fs.existsSync(path.join(viteVueDir, 'tsconfig.json'))).toBe(true)
    expect(fs.existsSync(path.join(nextReactDir, 'tsconfig.json'))).toBe(true)
  })

  // ── Renderer engine conformance ──────────────────────────────────────────

  test('all adapters generate a DNA loader', () => {
    for (const dir of [viteReactDir, viteVueDir, nextReactDir]) {
      const files = listFilesRecursive(dir)
      expect(files.some(f => f.includes('dna-loader'))).toBe(true)
    }
  })

  test('all adapters generate an API hook/composable', () => {
    for (const dir of [viteReactDir, viteVueDir, nextReactDir]) {
      const files = listFilesRecursive(dir)
      expect(files.some(f => f.includes('useApi'))).toBe(true)
    }
  })
})
