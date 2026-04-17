import { materializeProductCore } from './product-core'
import { DnaValidator } from '@dna/validator'
import * as fs from 'fs'
import * as path from 'path'

const loadDna = (relativePath: string) =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../', relativePath), 'utf-8'))

describe('materializeProductCore', () => {
  it('produces a valid product/core document from lending DNA', () => {
    const operational = loadDna('dna/lending/operational.json')
    const api = loadDna('dna/lending/product.api.json')
    const ui = loadDna('dna/lending/product.ui.json')

    const core = materializeProductCore(operational, api, ui)

    // Shape checks
    expect(core.domain).toBeDefined()
    expect(core.domain.path).toContain('lending')
    expect(core.nouns.length).toBeGreaterThan(0)
    expect(core.nouns.some((n) => n.name === 'Loan')).toBe(true)

    // Must validate against the product.core schema
    const validator = new DnaValidator()
    const r = validator.validate(core, 'product/core')
    if (!r.valid) {
      console.error('validation errors:', r.errors)
    }
    expect(r.valid).toBe(true)
  })

  it('falls back to all nouns when no surfaces are provided', () => {
    const operational = loadDna('dna/lending/operational.json')
    const core = materializeProductCore(operational)
    expect(core.nouns.length).toBeGreaterThan(0)
  })

  it('emits capabilities only for referenced nouns', () => {
    const operational = {
      domain: {
        name: 'test',
        path: 'test',
        nouns: [
          {
            name: 'Included',
            attributes: [{ name: 'id', type: 'string' }],
            verbs: [{ name: 'Create' }],
          },
          {
            name: 'Excluded',
            attributes: [{ name: 'id', type: 'string' }],
            verbs: [{ name: 'Create' }],
          },
        ],
      },
      capabilities: [
        { noun: 'Included', verb: 'Create', name: 'Included.Create' },
        { noun: 'Excluded', verb: 'Create', name: 'Excluded.Create' },
      ],
    }
    const api = { resources: [{ name: 'Included', noun: 'Included' }] }

    const core = materializeProductCore(operational, api)
    expect(core.nouns.map((n) => n.name)).toEqual(['Included'])
    expect(core.capabilities?.map((c: any) => c.name)).toEqual(['Included.Create'])
  })

  it('includes transitively related nouns via relationships', () => {
    const operational = {
      domain: {
        name: 'test',
        path: 'test',
        nouns: [
          { name: 'Order', attributes: [{ name: 'customer_id', type: 'string' }], verbs: [] },
          { name: 'Customer', attributes: [{ name: 'id', type: 'string' }], verbs: [] },
          { name: 'Unrelated', attributes: [{ name: 'id', type: 'string' }], verbs: [] },
        ],
      },
      relationships: [
        {
          name: 'order_belongs_to_customer',
          from: 'Order',
          to: 'Customer',
          attribute: 'customer_id',
          cardinality: 'many-to-one',
        },
      ],
    }
    const api = { resources: [{ name: 'Order', noun: 'Order' }] }

    const core = materializeProductCore(operational, api)
    const nounNames = core.nouns.map((n) => n.name).sort()
    expect(nounNames).toEqual(['Customer', 'Order'])
    expect(core.relationships?.length).toBe(1)
  })

  it('includes signals emitted by surfaced capability outcomes', () => {
    const operational = {
      domain: {
        name: 'lending',
        path: 'acme.finance.lending',
        nouns: [{ name: 'Loan', attributes: [], verbs: [{ name: 'Approve' }] }],
      },
      capabilities: [{ noun: 'Loan', verb: 'Approve', name: 'Loan.Approve' }],
      outcomes: [{ capability: 'Loan.Approve', emits: ['lending.Loan.Disbursed'] }],
      signals: [
        {
          name: 'lending.Loan.Disbursed',
          capability: 'Loan.Approve',
          description: '',
          payload: [{ name: 'id', type: 'string', required: true }],
        },
      ],
    }
    const api = { resources: [{ name: 'Loan', noun: 'Loan' }] }

    const core = materializeProductCore(operational, api)
    expect(core.signals?.map((s: any) => s.name)).toEqual(['lending.Loan.Disbursed'])
  })
})
