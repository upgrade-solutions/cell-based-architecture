/**
 * Astro adapter — generation tests for both flavors.
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as astroAdapter from './adapters/astro'
import { ProductUiDNA, UiCellContext } from './types'

function fixtureUi(): ProductUiDNA {
  return {
    layout: { name: 'Lending', type: 'sidebar' },
    pages: [
      {
        name: 'Loans',
        resource: 'loan',
        description: 'Browse and review loans',
        blocks: [
          {
            name: 'LoansTable',
            type: 'table',
            description: 'All loans',
            fields: [
              { name: 'borrower', label: 'Borrower', type: 'string' },
              { name: 'amount', label: 'Amount', type: 'number', required: true },
            ],
          },
          {
            name: 'NewLoanForm',
            type: 'form',
            description: 'Create a loan',
            operation: 'Loan.Create',
            fields: [
              { name: 'amount', label: 'Amount', type: 'number', required: true },
              { name: 'term', label: 'Term', type: 'number' },
            ],
          },
        ],
      },
      {
        name: 'About',
        resource: 'site',
        description: 'About this lender',
        blocks: [
          {
            name: 'AboutCopy',
            type: 'detail',
            description: 'Mission + team',
          },
        ],
      },
    ],
    routes: [
      { path: '/', page: 'Loans' },
      { path: '/about', page: 'About' },
    ],
  }
}

function ctxWith(adapterConfig: Record<string, unknown>): UiCellContext {
  return {
    uiFetchPath: '/dna/lending/product.ui.json',
    dnaSourceDir: '/tmp/none',
    adapterConfig,
  }
}

describe('astro adapter — marketing flavor (default)', () => {
  let outDir: string

  beforeAll(() => {
    outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-marketing-'))
    astroAdapter.generate(fixtureUi(), outDir, undefined, ctxWith({}))
  })

  afterAll(() => {
    fs.rmSync(outDir, { recursive: true, force: true })
  })

  test('emits package.json with astro dependency, no Starlight', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(outDir, 'package.json'), 'utf-8'))
    expect(pkg.dependencies.astro).toBeDefined()
    expect(pkg.dependencies['@astrojs/starlight']).toBeUndefined()
    expect(pkg.scripts.build).toBe('astro build')
  })

  test('emits astro.config.mjs (plain Astro, no integrations)', () => {
    const config = fs.readFileSync(path.join(outDir, 'astro.config.mjs'), 'utf-8')
    expect(config).toContain("import { defineConfig } from 'astro/config'")
    expect(config).not.toContain('starlight')
  })

  test('emits one Site layout', () => {
    expect(fs.existsSync(path.join(outDir, 'src/layouts/Site.astro'))).toBe(true)
    const layout = fs.readFileSync(path.join(outDir, 'src/layouts/Site.astro'), 'utf-8')
    expect(layout).toContain('layout-sidebar')
    expect(layout).toContain('<slot />')
  })

  test('emits an Astro page per route', () => {
    expect(fs.existsSync(path.join(outDir, 'src/pages/index.astro'))).toBe(true)
    expect(fs.existsSync(path.join(outDir, 'src/pages/about.astro'))).toBe(true)
  })

  test('routes with :id params become Astro [param] segments', () => {
    expect(astroAdapter.routeToAstroFilename('/loans/:id')).toBe('loans/[id].astro')
    expect(astroAdapter.routeToAstroFilename('/')).toBe('index.astro')
  })

  test('emits a Block component per unique block name', () => {
    expect(fs.existsSync(path.join(outDir, 'src/components/BlockLoansTable.astro'))).toBe(true)
    expect(fs.existsSync(path.join(outDir, 'src/components/BlockNewLoanForm.astro'))).toBe(true)
    expect(fs.existsSync(path.join(outDir, 'src/components/BlockAboutCopy.astro'))).toBe(true)
  })

  test('a page imports each of its blocks', () => {
    const indexPage = fs.readFileSync(path.join(outDir, 'src/pages/index.astro'), 'utf-8')
    expect(indexPage).toContain("import BlockLoansTable from '../components/BlockLoansTable.astro'")
    expect(indexPage).toContain("import BlockNewLoanForm from '../components/BlockNewLoanForm.astro'")
    expect(indexPage).toContain('<BlockLoansTable />')
    expect(indexPage).toContain('<Site title="Loans">')
  })

  test('does NOT emit Starlight content collection files', () => {
    expect(fs.existsSync(path.join(outDir, 'src/content/docs'))).toBe(false)
    expect(fs.existsSync(path.join(outDir, 'src/content.config.ts'))).toBe(false)
  })
})

describe('astro adapter — starlight flavor', () => {
  let outDir: string

  beforeAll(() => {
    outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-starlight-'))
    astroAdapter.generate(fixtureUi(), outDir, undefined, ctxWith({
      flavor: 'starlight',
      siteTitle: 'Lending Docs',
      openapiPath: './openapi.json',
    }))
  })

  afterAll(() => {
    fs.rmSync(outDir, { recursive: true, force: true })
  })

  test('package.json adds @astrojs/starlight + starlight-openapi', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(outDir, 'package.json'), 'utf-8'))
    expect(pkg.dependencies['@astrojs/starlight']).toBeDefined()
    expect(pkg.dependencies['starlight-openapi']).toBeDefined()
  })

  test('astro.config.mjs registers Starlight + the openapi plugin', () => {
    const config = fs.readFileSync(path.join(outDir, 'astro.config.mjs'), 'utf-8')
    expect(config).toContain("import starlight from '@astrojs/starlight'")
    expect(config).toContain('starlightOpenAPI')
    expect(config).toContain("schema: './openapi.json'")
    expect(config).toContain("title: 'Lending Docs'")
  })

  test('emits a content config + one Markdown entry per Page', () => {
    expect(fs.existsSync(path.join(outDir, 'src/content.config.ts'))).toBe(true)
    expect(fs.existsSync(path.join(outDir, 'src/content/docs/loans.md'))).toBe(true)
    expect(fs.existsSync(path.join(outDir, 'src/content/docs/about.md'))).toBe(true)
  })

  test('Markdown entries include each block as a section', () => {
    const md = fs.readFileSync(path.join(outDir, 'src/content/docs/loans.md'), 'utf-8')
    expect(md).toContain('title: Loans')
    expect(md).toContain('## All loans')
    expect(md).toContain('## Create a loan')
    expect(md).toContain('| Field | Type | Required |')
  })

  test('does NOT emit Astro pages or block components (Starlight owns rendering)', () => {
    expect(fs.existsSync(path.join(outDir, 'src/pages/index.astro'))).toBe(false)
    expect(fs.existsSync(path.join(outDir, 'src/components'))).toBe(false)
    expect(fs.existsSync(path.join(outDir, 'src/layouts'))).toBe(false)
  })

  test('starlight flavor without openapiPath skips the plugin import', () => {
    const noOpenApiDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-starlight-no-openapi-'))
    astroAdapter.generate(fixtureUi(), noOpenApiDir, undefined, ctxWith({
      flavor: 'starlight',
    }))
    const config = fs.readFileSync(path.join(noOpenApiDir, 'astro.config.mjs'), 'utf-8')
    expect(config).toContain("import starlight from '@astrojs/starlight'")
    expect(config).not.toContain('starlight-openapi')
    fs.rmSync(noOpenApiDir, { recursive: true, force: true })
  })
})
