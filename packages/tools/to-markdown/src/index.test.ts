import { render } from './index'
import { bookshopInput } from './fixtures'

describe('@dna/to-markdown', () => {
  describe('render() — document scaffolding', () => {
    it('renders every default section', () => {
      const md = render(bookshopInput)
      expect(md).toContain('# shop.books')
      expect(md).toContain('## Summary')
      expect(md).toContain('## Domain Model')
      expect(md).toContain('## Capabilities')
      expect(md).toContain('## SOPs')
      expect(md).toContain('## Process Flows')
    })

    it('honors an explicit sections list and drops the rest', () => {
      const md = render(bookshopInput, { sections: ['summary'] })
      expect(md).toContain('## Summary')
      expect(md).not.toContain('## Domain Model')
      expect(md).not.toContain('## Capabilities')
      expect(md).not.toContain('## SOPs')
      expect(md).not.toContain('## Process Flows')
    })

    it('supports a custom title override', () => {
      const md = render(bookshopInput, { title: 'Bookshop Handbook' })
      expect(md).toContain('# Bookshop Handbook')
      expect(md).not.toContain('# shop.books')
    })

    it('falls back to domain.name when path is missing', () => {
      const noPath = {
        operational: {
          ...bookshopInput.operational!,
          domain: { ...bookshopInput.operational!.domain, path: undefined },
        },
      }
      expect(render(noPath)).toContain('# shop')
    })

    it('shifts heading levels with headingLevel: 2', () => {
      const md = render(bookshopInput, {
        sections: ['summary'],
        headingLevel: 2,
      })
      expect(md).toContain('## shop.books')
      expect(md).toContain('### Summary')
    })

    it('emits the empty string when DNA is empty', () => {
      expect(render({})).toBe('')
    })
  })

  describe('section: summary', () => {
    it('lists primitive counts for populated collections only', () => {
      const md = render(bookshopInput, { sections: ['summary'] })
      expect(md).toContain('- Nouns: 1')
      expect(md).toContain('- Capabilities: 2')
      expect(md).toContain('- Rules: 2')
      expect(md).toContain('- Processes: 1')
      // Equations are absent in the fixture
      expect(md).not.toContain('Equations:')
    })

    it('names top-level nouns', () => {
      const md = render(bookshopInput, { sections: ['summary'] })
      expect(md).toContain('**Top-level nouns:** `Book`')
    })
  })

  describe('section: domain-model', () => {
    it('renders a noun with attribute table, verbs, and relationships', () => {
      const md = render(bookshopInput, { sections: ['domain-model'] })
      expect(md).toContain('### Book')
      expect(md).toContain('| Attribute | Type | Required | Description |')
      expect(md).toContain('| `id` | string | yes |')
      expect(md).toContain('**Verbs:** `Publish`, `Retire`')
      expect(md).toContain('`Book.author`')
      expect(md).toContain('many-to-one → `Author`')
    })
  })

  describe('section: capabilities', () => {
    it('renders triggers, access rules, condition rules, outcomes, and signals', () => {
      const md = render(bookshopInput, { sections: ['capabilities'] })
      expect(md).toContain('### Book.Publish')
      expect(md).toContain('**Triggered by:**')
      expect(md).toContain('- user')
      expect(md).toContain('*Access:* role `editor`')
      expect(md).toContain('*Condition:* book.status == "draft"')
      expect(md).toContain('Sets `book.status`')
      expect(md).toContain('Emits `shop.Book.Published`')
      expect(md).toContain('**Signals published:**')
      expect(md).toContain('`book_id`: string (required)')
    })
  })

  describe('section: sops', () => {
    it('renders numbered steps that resolve task → position + capability', () => {
      const md = render(bookshopInput, { sections: ['sops'] })
      expect(md).toContain('### PublishFlow')
      expect(md).toContain('**Operator:** `Editor`')
      expect(md).toContain('1. **review** — `Editor` does `Book.Publish`')
      expect(md).toContain('(when: passed)')
      expect(md).toContain('(else)')
      expect(md).toContain('after: `review`')
    })
  })

  describe('section: process-flow', () => {
    it('renders an ASCII outline with branch markers and dep arrows', () => {
      const md = render(bookshopInput, { sections: ['process-flow'] })
      expect(md).toContain('### PublishFlow')
      expect(md).toContain('```')
      expect(md).toContain('├── review: ReviewBook')
      expect(md).toContain('├── approve: ApproveBook [when: passed] ← review')
      expect(md).toContain('└── reject: RejectBook [else] ← review')
    })
  })
})
