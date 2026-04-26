import { materializeProductCore } from './product-core'
import { DnaValidator } from '@dna-codes/core'
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

    expect(core.domain).toBeDefined()
    expect(core.domain.path).toContain('lending')
    expect(core.resources?.length ?? 0).toBeGreaterThan(0)
    expect(core.resources?.some((r) => r.name === 'Loan')).toBe(true)

    const validator = new DnaValidator()
    const r = validator.validate(core, 'product/core')
    if (!r.valid) console.error('validation errors:', r.errors)
    expect(r.valid).toBe(true)
  })

  it('falls back to all resources when no surfaces are provided', () => {
    const operational = loadDna('dna/lending/operational.json')
    const core = materializeProductCore(operational)
    expect(core.resources?.length ?? 0).toBeGreaterThan(0)
  })

  it('emits operations only for surfaced resources', () => {
    const operational = {
      domain: {
        name: 'test',
        path: 'test',
        resources: [
          {
            name: 'Included',
            attributes: [{ name: 'id', type: 'string' }],
            actions: [{ name: 'Create', type: 'write' }],
          },
          {
            name: 'Excluded',
            attributes: [{ name: 'id', type: 'string' }],
            actions: [{ name: 'Create', type: 'write' }],
          },
        ],
      },
      operations: [
        { name: 'Included.Create', target: 'Included', action: 'Create' },
        { name: 'Excluded.Create', target: 'Excluded', action: 'Create' },
      ],
    }
    const api = { resources: [{ name: 'Included', resource: 'Included' }] }

    const core = materializeProductCore(operational, api)
    expect(core.resources?.map((r) => r.name)).toEqual(['Included'])
    expect(core.operations?.map((o: any) => o.name)).toEqual(['Included.Create'])
  })

  it('includes transitively related resources via relationships', () => {
    const operational = {
      domain: {
        name: 'test',
        path: 'test',
        resources: [
          { name: 'Order', attributes: [{ name: 'customer_id', type: 'string' }], actions: [] },
          { name: 'Customer', attributes: [{ name: 'id', type: 'string' }], actions: [] },
          { name: 'Unrelated', attributes: [{ name: 'id', type: 'string' }], actions: [] },
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
    const api = { resources: [{ name: 'Order', resource: 'Order' }] }

    const core = materializeProductCore(operational, api)
    const resourceNames = (core.resources ?? []).map((r) => r.name).sort()
    expect(resourceNames).toEqual(['Customer', 'Order'])
    expect(core.relationships?.length).toBe(1)
  })
})
