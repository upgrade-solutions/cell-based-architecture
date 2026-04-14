/**
 * Flag-aware render + click guard tests.
 *
 * Verifies that each ui-cell adapter (vite/react, vite/vue, next/react):
 *   - emits a flags-context module with a FlagProvider / provideFlags seam
 *   - emits a rules module with evaluateRule + missingFlagsForEntry helpers
 *   - copies operational.json into public/dna/ alongside the other DNA files
 *   - wires operational + rule.allow[].flags into the ActionsBlock guard path
 *   - injects the flag source into the scaffold entry point
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { generate as generateViteReact } from './adapters/vite/react'
import { generate as generateViteVue } from './adapters/vite/vue'
import { generate as generateNextReact } from './adapters/next/react'
import { ProductUiDNA, ProductCoreDNA, UiCellContext } from './types'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const minimalUi: ProductUiDNA = {
  layout: { name: 'FlagTest', type: 'sidebar' },
  pages: [{ name: 'LoansPage', resource: 'loans', blocks: [] }],
  routes: [{ path: '/loans', page: 'LoansPage' }],
}

const minimalCore: ProductCoreDNA = {
  domain: { name: 'demo', path: 'demo' },
  nouns: [],
}

// Sibling operational.json with a mix of rules — including one that uses the
// new flags field — to drive the generator's copy + wire path end-to-end.
const operational = {
  capabilities: [
    { noun: 'Loan', verb: 'Approve', name: 'Loan.Approve' },
    { noun: 'Loan', verb: 'Reject', name: 'Loan.Reject' },
  ],
  rules: [
    {
      capability: 'Loan.Approve',
      type: 'access',
      allow: [
        { role: 'underwriter', flags: ['new_approval_flow'] },
        { role: 'senior_underwriter' },
      ],
    },
    {
      capability: 'Loan.Reject',
      type: 'access',
      allow: [{ role: 'underwriter' }],
    },
  ],
}

function withDnaDir(fn: (dnaDir: string, ctx: UiCellContext) => void): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-cell-flag-'))
  const dnaDir = path.join(root, 'dna', 'demo')
  fs.mkdirSync(dnaDir, { recursive: true })
  fs.writeFileSync(path.join(dnaDir, 'product.ui.json'), JSON.stringify(minimalUi))
  fs.writeFileSync(path.join(dnaDir, 'product.core.json'), JSON.stringify(minimalCore))
  fs.writeFileSync(path.join(dnaDir, 'operational.json'), JSON.stringify(operational))
  const ctx: UiCellContext = {
    uiFetchPath: '/dna/demo/product.ui.json',
    coreFetchPath: '/dna/demo/product.core.json',
    operationalFetchPath: '/dna/demo/operational.json',
    apiBase: 'http://localhost:3000',
    dnaSourceDir: path.join(root, 'dna'),
    vendorComponents: false,
  }
  try {
    fn(dnaDir, ctx)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}

function withOutputDir(fn: (outputDir: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-cell-flag-out-'))
  try {
    fn(dir)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

// ── Test suite ───────────────────────────────────────────────────────────────

type AdapterEntry = {
  name: string
  generate: (ui: ProductUiDNA, outputDir: string, core?: ProductCoreDNA, ctx?: UiCellContext) => void
  flagsContextRelPath: string
  rulesRelPath: string
  actionButtonRelPath: string
  scaffoldEntryRelPath: string
}

const ADAPTERS: AdapterEntry[] = [
  {
    name: 'vite/react',
    generate: generateViteReact,
    flagsContextRelPath: 'src/renderer/flags-context.tsx',
    rulesRelPath: 'src/renderer/rules.ts',
    actionButtonRelPath: 'src/renderer/blocks/ActionsBlock.tsx',
    scaffoldEntryRelPath: 'src/renderer/App.tsx',
  },
  {
    name: 'vite/vue',
    generate: generateViteVue,
    flagsContextRelPath: 'src/renderer/flags-context.ts',
    rulesRelPath: 'src/renderer/rules.ts',
    actionButtonRelPath: 'src/renderer/blocks/ActionButton.vue',
    scaffoldEntryRelPath: 'src/renderer/App.vue',
  },
  {
    name: 'next/react',
    generate: generateNextReact,
    flagsContextRelPath: 'src/renderer/flags-context.tsx',
    rulesRelPath: 'src/renderer/rules.ts',
    actionButtonRelPath: 'src/renderer/blocks/ActionsBlock.tsx',
    scaffoldEntryRelPath: 'src/renderer/DnaProvider.tsx',
  },
]

describe.each(ADAPTERS)('flag-aware guards — $name', adapter => {
  test('emits a flags-context module', () => {
    withDnaDir((_dnaDir, ctx) => {
      withOutputDir(outputDir => {
        adapter.generate(minimalUi, outputDir, minimalCore, ctx)
        const file = path.join(outputDir, adapter.flagsContextRelPath)
        expect(fs.existsSync(file)).toBe(true)
        const contents = fs.readFileSync(file, 'utf-8')
        // Provider seam — React: FlagProvider; Vue: provideFlags
        expect(contents).toMatch(/FlagProvider|provideFlags/)
        // Hook seam for render-time guards
        expect(contents).toContain('useFlags')
        // Module-level snapshot for click-time guards
        expect(contents).toContain('readFlagSnapshotSync')
        // Fail-closed default
        expect(contents).toMatch(/EMPTY|{}/)
        // Default endpoint
        expect(contents).toContain('/api/flags')
      })
    })
  })

  test('emits a rules module with evaluateRule + missingFlagsForEntry', () => {
    withDnaDir((_dnaDir, ctx) => {
      withOutputDir(outputDir => {
        adapter.generate(minimalUi, outputDir, minimalCore, ctx)
        const file = path.join(outputDir, adapter.rulesRelPath)
        expect(fs.existsSync(file)).toBe(true)
        const contents = fs.readFileSync(file, 'utf-8')
        expect(contents).toContain('evaluateRule')
        expect(contents).toContain('missingFlagsForEntry')
        expect(contents).toContain('findAccessRule')
        // Undefined rule → allowed (API is authoritative)
        expect(contents).toMatch(/if \(!rule\) return true/)
        // Empty allow → blocked
        expect(contents).toMatch(/allow\.length === 0/)
      })
    })
  })

  test('copies operational.json into public/dna/ alongside the other DNA files', () => {
    withDnaDir((_dnaDir, ctx) => {
      withOutputDir(outputDir => {
        adapter.generate(minimalUi, outputDir, minimalCore, ctx)
        const copied = path.join(outputDir, 'public/dna/demo/operational.json')
        expect(fs.existsSync(copied)).toBe(true)
        const parsed = JSON.parse(fs.readFileSync(copied, 'utf-8'))
        // Flag survived the copy — the generator doesn't mangle the DNA.
        const approve = parsed.rules.find(
          (r: { capability: string; type?: string }) =>
            r.capability === 'Loan.Approve' && r.type === 'access',
        )
        expect(approve).toBeDefined()
        expect(approve.allow[0].flags).toEqual(['new_approval_flow'])
      })
    })
  })

  test('config.json points at the operational fetch path', () => {
    withDnaDir((_dnaDir, ctx) => {
      withOutputDir(outputDir => {
        adapter.generate(minimalUi, outputDir, minimalCore, ctx)
        const config = JSON.parse(
          fs.readFileSync(path.join(outputDir, 'public/config.json'), 'utf-8'),
        )
        expect(config.operational).toBe('/dna/demo/operational.json')
      })
    })
  })

  test('ActionsBlock wires the flag + rule evaluator into the render-time guard', () => {
    withDnaDir((_dnaDir, ctx) => {
      withOutputDir(outputDir => {
        adapter.generate(minimalUi, outputDir, minimalCore, ctx)
        const contents = fs.readFileSync(
          path.join(outputDir, adapter.actionButtonRelPath),
          'utf-8',
        )
        // Imports the flag hook + rule evaluator
        expect(contents).toContain('useFlags')
        expect(contents).toContain('findAccessRule')
        expect(contents).toContain('evaluateRule')
        expect(contents).toContain('missingFlagsForEntry')
        // Disable-with-tooltip path for flag-only failures
        expect(contents).toContain('blockedByFlagOnly')
        expect(contents).toMatch(/Requires feature/)
        // Click-time fast-path re-read of the live snapshot
        expect(contents).toContain('readFlagSnapshotSync')
      })
    })
  })

  test('scaffold entry wires the flag provider', () => {
    withDnaDir((_dnaDir, ctx) => {
      withOutputDir(outputDir => {
        adapter.generate(minimalUi, outputDir, minimalCore, ctx)
        const contents = fs.readFileSync(
          path.join(outputDir, adapter.scaffoldEntryRelPath),
          'utf-8',
        )
        // React adapters wrap with <FlagProvider>; Vue calls provideFlags().
        expect(contents).toMatch(/FlagProvider|provideFlags/)
      })
    })
  })
})
