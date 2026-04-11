/**
 * Marketing layout generator test — verifies the vite/react ui-cell adapter
 * emits a MarketingLayout component, wires it into the Layout dispatcher,
 * and accepts the marketing-specific DNA fields (brand, hero, footer).
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { DnaValidator } from '@cell/dna-validator'
import { generate } from './adapters/vite/react'
import { ProductUiDNA } from './types'

function withTempDir(fn: (dir: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-cell-marketing-'))
  try {
    fn(dir)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

// ── Minimal marketing product.ui.json fixture ────────────────────────────────

const marketingUi: ProductUiDNA = {
  layout: {
    name: 'MarshallFireLayout',
    type: 'marketing',
    description: 'Public marketing site for the Marshall Fire mass-tort intake.',
    brand: {
      name: 'Marshall Fire Claims',
      tagline: 'Help for Boulder County fire survivors',
      href: '/',
    },
    hero: {
      eyebrow: 'Marshall Fire Mass Tort',
      title: 'If you lost your home in the Marshall Fire, we can help.',
      subtitle:
        'Free case review for Superior, Louisville, and unincorporated Boulder County residents.',
      cta: { label: 'Start Intake', route: '/intake' },
      secondaryCta: { label: 'Eligibility', route: '/eligibility' },
    },
    footer: {
      text: '\u00a9 2026 Marshall Fire Claims Group',
      links: [
        { label: 'Privacy', href: '/privacy' },
        { label: 'Contact', href: 'mailto:hello@example.com' },
      ],
    },
  } as any,
  pages: [
    { name: 'Home', resource: 'Home', blocks: [] },
    { name: 'Eligibility', resource: 'Home', blocks: [] },
    { name: 'Intake', resource: 'Home', blocks: [] },
  ],
  routes: [
    { path: '/', page: 'Home' },
    { path: '/eligibility', page: 'Eligibility' },
    { path: '/intake', page: 'Intake' },
  ],
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('vite/react ui-cell — marketing layout', () => {
  it('schema accepts marketing layout with brand, hero, and footer', () => {
    const validator = new DnaValidator()
    const r = validator.validate(marketingUi.layout, 'product/web/layout')
    if (!r.valid) console.error(r.errors)
    expect(r.valid).toBe(true)
  })

  it('generates a MarketingLayout.tsx when the layout type is marketing', () => {
    withTempDir((dir) => {
      generate(marketingUi, dir)
      const marketingFile = path.join(dir, 'src/renderer/MarketingLayout.tsx')
      expect(fs.existsSync(marketingFile)).toBe(true)
      const content = fs.readFileSync(marketingFile, 'utf-8')
      // Spot-check the structural markers
      expect(content).toContain('export default function MarketingLayout')
      expect(content).toContain('layout.brand')
      expect(content).toContain('layout.hero')
      expect(content).toContain('layout.footer')
      expect(content).toContain('<Outlet />')
    })
  })

  it('Layout dispatcher routes marketing type to MarketingLayout', () => {
    withTempDir((dir) => {
      generate(marketingUi, dir)
      const layoutFile = path.join(dir, 'src/renderer/Layout.tsx')
      expect(fs.existsSync(layoutFile)).toBe(true)
      const content = fs.readFileSync(layoutFile, 'utf-8')
      expect(content).toContain("import MarketingLayout from './MarketingLayout'")
      expect(content).toContain("layout.type === 'marketing'")
      expect(content).toContain('<MarketingLayout layout={layout} routes={routes} />')
    })
  })

  it('MarketingLayout.tsx references all the DNA-configured chrome', () => {
    withTempDir((dir) => {
      generate(marketingUi, dir)
      const content = fs.readFileSync(
        path.join(dir, 'src/renderer/MarketingLayout.tsx'),
        'utf-8',
      )
      // Header CTA
      expect(content).toContain('headerCta')
      // Hero title + CTA + secondary CTA
      expect(content).toContain('hero.title')
      expect(content).toContain('hero.cta')
      expect(content).toContain('hero.secondaryCta')
      // Footer links
      expect(content).toContain('footer.links')
      // Hero only shows on root
      expect(content).toContain("location.pathname === '/'")
    })
  })

  it('generates a SurveyBlock and wires survey-core into package.json', () => {
    withTempDir((dir) => {
      generate(marketingUi, dir)

      // SurveyBlock.tsx exists and pulls from survey-core + survey-react-ui
      const surveyBlock = path.join(dir, 'src/renderer/blocks/SurveyBlock.tsx')
      expect(fs.existsSync(surveyBlock)).toBe(true)
      const content = fs.readFileSync(surveyBlock, 'utf-8')
      expect(content).toContain("from 'survey-core'")
      expect(content).toContain("from 'survey-react-ui'")
      expect(content).toContain('fieldToQuestion')
      expect(content).toContain('--sjs-primary-backcolor')
      expect(content).toContain('useApi(block.operation)')

      // Block dispatcher wires 'survey' case to SurveyBlock
      const blockFile = path.join(dir, 'src/renderer/Block.tsx')
      const blockContent = fs.readFileSync(blockFile, 'utf-8')
      expect(blockContent).toContain("import SurveyBlock from './blocks/SurveyBlock'")
      expect(blockContent).toContain("case 'survey':")

      // survey-core + survey-react-ui pinned in generated package.json
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8'))
      expect(pkg.dependencies['survey-core']).toBeDefined()
      expect(pkg.dependencies['survey-react-ui']).toBeDefined()
    })
  })
})
