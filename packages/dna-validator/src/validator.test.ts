import { DnaValidator } from './validator'
import * as fs from 'fs'
import * as path from 'path'

const validator = new DnaValidator()

const loadDna = (relativePath: string) =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../', relativePath), 'utf-8'))

describe('DnaValidator — operational/noun', () => {
  it('validates a valid Noun document', () => {
    const doc = {
      name: 'Loan',
      description: 'A financial loan issued to a borrower.',
      domain: 'acme.finance.lending',
      attributes: [
        { name: 'amount', type: 'number', required: true },
        { name: 'status', type: 'enum', required: true, values: ['pending', 'active', 'repaid', 'defaulted'] }
      ],
      verbs: [{ name: 'Apply' }, { name: 'Approve' }]
    }
    const result = validator.validate(doc, 'operational/noun')
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects a Noun missing required name field', () => {
    const result = validator.validate({ domain: 'acme.finance' }, 'operational/noun')
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.params?.missingProperty === 'name')).toBe(true)
  })

  it('rejects an Attribute with enum type but no values', () => {
    const doc = {
      name: 'Order',
      attributes: [{ name: 'status', type: 'enum' }]
    }
    const result = validator.validate(doc, 'operational/noun')
    expect(result.valid).toBe(false)
  })
})

describe('DnaValidator — operational/capability', () => {
  it('validates a valid Capability', () => {
    const result = validator.validate({ noun: 'Loan', verb: 'Approve', name: 'Loan.Approve' }, 'operational/capability')
    expect(result.valid).toBe(true)
  })

  it('rejects a Capability missing verb', () => {
    const result = validator.validate({ noun: 'Loan' }, 'operational/capability')
    expect(result.valid).toBe(false)
  })
})

describe('DnaValidator — operational/lifecycle', () => {
  it('validates a valid Lifecycle', () => {
    const result = validator.validate({
      noun: 'Loan',
      steps: ['Loan.Apply', 'Loan.Approve', 'Loan.Disburse', 'Loan.Repay'],
      branches: [{ from: 'Loan.Disburse', to: 'Loan.Default' }]
    }, 'operational/lifecycle')
    expect(result.valid).toBe(true)
  })
})

describe('DnaValidator — product/core/resource', () => {
  it('validates a valid Resource document', () => {
    const result = validator.validate({
      name: 'Loan',
      noun: 'Loan',
      description: 'A financial loan.',
      fields: [
        { name: 'amount', type: 'number', label: 'Amount', required: true },
        { name: 'status', type: 'enum', label: 'Status', values: ['pending', 'active'] }
      ],
      actions: [{ name: 'Apply', verb: 'Apply' }]
    }, 'product/core/resource')
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects a Resource missing required name', () => {
    const result = validator.validate({ noun: 'Loan' }, 'product/core/resource')
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.params?.missingProperty === 'name')).toBe(true)
  })

  it('rejects a Field with enum type but no values', () => {
    const result = validator.validate({
      name: 'Loan',
      fields: [{ name: 'status', type: 'enum' }]
    }, 'product/core/resource')
    expect(result.valid).toBe(false)
  })
})

describe('DnaValidator — product/core/operation', () => {
  it('validates a valid Operation', () => {
    const result = validator.validate({
      resource: 'Loan',
      action: 'Approve',
      name: 'Loan.Approve',
      capability: 'Loan.Approve'
    }, 'product/core/operation')
    expect(result.valid).toBe(true)
  })

  it('rejects an Operation missing action', () => {
    const result = validator.validate({ resource: 'Loan' }, 'product/core/operation')
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.params?.missingProperty === 'action')).toBe(true)
  })
})

describe('DnaValidator — product/api/endpoint', () => {
  it('validates a valid Endpoint', () => {
    const result = validator.validate({
      method: 'POST',
      path: '/loans/:id/approve',
      operation: 'Loan.Approve',
      params: [{ name: 'loan_id', in: 'path', type: 'string', required: true }]
    }, 'product/api/endpoint')
    expect(result.valid).toBe(true)
  })

  it('rejects an Endpoint missing path', () => {
    const result = validator.validate({ method: 'GET', operation: 'Loan.View' }, 'product/api/endpoint')
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.params?.missingProperty === 'path')).toBe(true)
  })
})

describe('DnaValidator — product/web/page', () => {
  it('validates a valid Page', () => {
    const result = validator.validate({
      name: 'LoanDetail',
      resource: 'Loan',
      blocks: [{ name: 'LoanHeader', type: 'detail', operation: 'Loan.View' }]
    }, 'product/web/page')
    expect(result.valid).toBe(true)
  })
})

describe('DnaValidator — technical/construct', () => {
  it('validates a valid Construct', () => {
    const result = validator.validate({
      name: 'primary-db',
      category: 'storage',
      type: 'database',
      provider: 'aws',
      config: { engine: 'postgres', version: '15' }
    }, 'technical/construct')
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects a Construct missing type', () => {
    const result = validator.validate({ name: 'primary-db', category: 'storage' }, 'technical/construct')
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.params?.missingProperty === 'type')).toBe(true)
  })
})

describe('DnaValidator — technical/cell', () => {
  it('validates a valid Cell', () => {
    const result = validator.validate({
      name: 'api',
      dna: 'product/api',
      adapter: { type: 'nestjs', version: '10' },
      constructs: ['primary-db', 'auth-provider']
    }, 'technical/cell')
    expect(result.valid).toBe(true)
  })

  it('rejects a Cell missing adapter', () => {
    const result = validator.validate({ name: 'api', dna: 'product/api' }, 'technical/cell')
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.params?.missingProperty === 'adapter')).toBe(true)
  })

  it('validates a Cell with variables and outputs', () => {
    const result = validator.validate({
      name: 'db',
      dna: 'operational/loan',
      adapter: { type: 'postgres', version: '15' },
      constructs: ['primary-db'],
      variables: [{ name: 'DATABASE_URL', source: 'secret', value: 'arn:aws:secretsmanager:us-east-1:123:secret:db-url' }],
      outputs: [{ name: 'db.connection_string', cell: 'db', value: 'primary-db.connection_string' }]
    }, 'technical/cell')
    expect(result.valid).toBe(true)
  })
})

describe('DnaValidator — technical/environment', () => {
  it('validates a valid Environment', () => {
    const result = validator.validate({
      name: 'prod',
      description: 'Live production environment.',
      providers: [{ name: 'aws', type: 'cloud', region: 'us-east-1' }]
    }, 'technical/environment')
    expect(result.valid).toBe(true)
  })

  it('rejects an Environment with an invalid name', () => {
    const result = validator.validate({ name: 'local' }, 'technical/environment')
    expect(result.valid).toBe(false)
  })
})

describe('DnaValidator — operational/signal', () => {
  it('validates a valid Signal', () => {
    const result = validator.validate({
      name: 'lending.Loan.Disbursed',
      capability: 'Loan.Disburse',
      description: 'Published when funds are released.',
      payload: [
        { name: 'loan_id', type: 'string' },
        { name: 'amount', type: 'number' }
      ]
    }, 'operational/signal')
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects a Signal missing required payload', () => {
    const result = validator.validate({
      name: 'lending.Loan.Disbursed',
      capability: 'Loan.Disburse'
    }, 'operational/signal')
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.params?.missingProperty === 'payload')).toBe(true)
  })

  it('rejects a Signal with empty payload', () => {
    const result = validator.validate({
      name: 'lending.Loan.Disbursed',
      capability: 'Loan.Disburse',
      payload: []
    }, 'operational/signal')
    expect(result.valid).toBe(false)
  })

  it('rejects a Signal with invalid name pattern', () => {
    const result = validator.validate({
      name: 'LoanDisbursed',
      capability: 'Loan.Disburse',
      payload: [{ name: 'loan_id', type: 'string' }]
    }, 'operational/signal')
    expect(result.valid).toBe(false)
  })
})

describe('DnaValidator — operational/cause (signal source)', () => {
  it('validates a Cause with signal source', () => {
    const result = validator.validate({
      capability: 'PaymentSchedule.Create',
      source: 'signal',
      signal: 'lending.Loan.Disbursed',
      description: 'Triggered when a loan is disbursed.'
    }, 'operational/cause')
    expect(result.valid).toBe(true)
  })

  it('rejects a Cause with signal source but missing signal field', () => {
    const result = validator.validate({
      capability: 'PaymentSchedule.Create',
      source: 'signal'
    }, 'operational/cause')
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.params?.missingProperty === 'signal')).toBe(true)
  })
})

describe('DnaValidator — operational/outcome (emits)', () => {
  it('validates an Outcome with emits', () => {
    const result = validator.validate({
      capability: 'Loan.Disburse',
      changes: [{ attribute: 'loan.status', set: 'active' }],
      emits: ['lending.Loan.Disbursed']
    }, 'operational/outcome')
    expect(result.valid).toBe(true)
  })

  it('rejects an Outcome with invalid emits signal pattern', () => {
    const result = validator.validate({
      capability: 'Loan.Disburse',
      changes: [{ attribute: 'loan.status', set: 'active' }],
      emits: ['BadSignalName']
    }, 'operational/outcome')
    expect(result.valid).toBe(false)
  })
})

describe('DnaValidator — operational/relationship', () => {
  it('validates a valid Relationship', () => {
    const result = validator.validate({
      name: 'Loan.borrower',
      from: 'Loan',
      to: 'Borrower',
      cardinality: 'many-to-one',
      attribute: 'borrower_id',
      description: 'Each loan belongs to one borrower.',
      inverse: 'loans'
    }, 'operational/relationship')
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects a Relationship missing required fields', () => {
    const result = validator.validate({ name: 'Loan.borrower' }, 'operational/relationship')
    expect(result.valid).toBe(false)
  })

  it('rejects a Relationship with invalid cardinality', () => {
    const result = validator.validate({
      name: 'Loan.borrower',
      from: 'Loan',
      to: 'Borrower',
      cardinality: 'some-to-some',
      attribute: 'borrower_id'
    }, 'operational/relationship')
    expect(result.valid).toBe(false)
  })
})

describe('DnaValidator — composite: operational', () => {
  it('validates the lending operational DNA document', () => {
    const doc = loadDna('dna/lending/operational.json')
    const result = validator.validate(doc, 'operational')
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects an operational document missing domain', () => {
    const result = validator.validate({ capabilities: [] }, 'operational')
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.params?.missingProperty === 'domain')).toBe(true)
  })
})

describe('DnaValidator — composite: product/core', () => {
  it('validates a minimal product core document', () => {
    const doc = {
      domain: { name: 'lending', path: 'acme.finance.lending' },
      nouns: [
        {
          name: 'Loan',
          attributes: [
            { name: 'amount', type: 'number', required: true },
            { name: 'status', type: 'enum', values: ['pending', 'active'] }
          ],
          verbs: [{ name: 'Apply' }, { name: 'Approve' }]
        }
      ],
      capabilities: [
        { noun: 'Loan', verb: 'Apply', name: 'Loan.Apply' },
        { noun: 'Loan', verb: 'Approve', name: 'Loan.Approve' }
      ]
    }
    const result = validator.validate(doc, 'product/core')
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects a product core document missing domain', () => {
    const result = validator.validate({ nouns: [] }, 'product/core')
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.params?.missingProperty === 'domain')).toBe(true)
  })

  it('rejects a product core document missing nouns', () => {
    const result = validator.validate({
      domain: { name: 'lending', path: 'acme.finance.lending' }
    }, 'product/core')
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.params?.missingProperty === 'nouns')).toBe(true)
  })

  it('rejects unknown top-level properties', () => {
    const result = validator.validate({
      domain: { name: 'lending', path: 'acme.finance.lending' },
      nouns: [],
      bogus: true
    }, 'product/core')
    expect(result.valid).toBe(false)
  })
})

describe('DnaValidator — composite: product/api', () => {
  it('validates the lending product API DNA document', () => {
    const doc = loadDna('dna/lending/product.api.json')
    const result = validator.validate(doc, 'product/api')
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects a product/api document missing endpoints', () => {
    const result = validator.validate({
      namespace: { name: 'Lending', path: '/lending' }
    }, 'product/api')
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.params?.missingProperty === 'endpoints')).toBe(true)
  })
})

describe('DnaValidator — composite: product/ui', () => {
  it('validates the lending product UI DNA document', () => {
    const doc = loadDna('dna/lending/product.ui.json')
    const result = validator.validate(doc, 'product/ui')
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects a product/ui document missing routes', () => {
    const result = validator.validate({
      layout: { name: 'AppLayout', type: 'sidebar' },
      pages: [{ name: 'LoanList', resource: 'Loan' }]
    }, 'product/ui')
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.params?.missingProperty === 'routes')).toBe(true)
  })
})

describe('DnaValidator — composite: technical', () => {
  it('validates the lending technical DNA document', () => {
    const doc = loadDna('dna/lending/technical.json')
    const result = validator.validate(doc, 'technical')
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects a technical document missing cells', () => {
    const result = validator.validate({ providers: [] }, 'technical')
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.params?.missingProperty === 'cells')).toBe(true)
  })
})

describe('DnaValidator — availableSchemas', () => {
  it('lists all registered schemas', () => {
    const schemas = validator.availableSchemas()
    expect(schemas).toContain('operational/noun')
    expect(schemas).toContain('operational/verb')
    expect(schemas).toContain('operational/capability')
    expect(schemas).toContain('operational/attribute')
    expect(schemas).toContain('operational/domain')
    expect(schemas).toContain('operational/cause')
    expect(schemas).toContain('operational/rule')
    expect(schemas).toContain('operational/outcome')
    expect(schemas).toContain('operational/lifecycle')
    expect(schemas).toContain('operational/equation')
    expect(schemas).toContain('operational/signal')
    expect(schemas).toContain('operational/relationship')
    expect(schemas).toContain('product/core/resource')
    expect(schemas).toContain('product/core/action')
    expect(schemas).toContain('product/core/operation')
    expect(schemas).toContain('product/core/field')
    expect(schemas).toContain('product/api/endpoint')
    expect(schemas).toContain('product/api/namespace')
    expect(schemas).toContain('product/api/param')
    expect(schemas).toContain('product/api/schema')
    expect(schemas).toContain('product/web/page')
    expect(schemas).toContain('product/web/block')
    expect(schemas).toContain('product/web/layout')
    expect(schemas).toContain('product/web/route')
    expect(schemas).toContain('technical/construct')
    expect(schemas).toContain('technical/provider')
    expect(schemas).toContain('technical/variable')
    expect(schemas).toContain('technical/output')
    expect(schemas).toContain('technical/environment')
    expect(schemas).toContain('technical/cell')
    expect(schemas).toContain('operational')
    expect(schemas).toContain('product/api')
    expect(schemas).toContain('product/ui')
    expect(schemas).toContain('technical')
  })
})

// ── Cross-layer validation ─────────────────────────────────────────────────

describe('DnaValidator — cross-layer validation', () => {
  const operational = loadDna('dna/lending/operational.json')
  const productApi = loadDna('dna/lending/product.api.json')
  const productUi = loadDna('dna/lending/product.ui.json')
  const technical = loadDna('dna/lending/technical.json')

  it('passes for valid lending DNA', () => {
    const result = validator.validateCrossLayer({ operational, productApi, productUi, technical })
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('detects invalid resource noun reference', () => {
    const badApi = {
      ...productApi,
      resources: [{ name: 'Widget', noun: 'NonExistentNoun', fields: [], actions: [] }],
    }
    const result = validator.validateCrossLayer({ operational, productApi: badApi })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.message.includes('NonExistentNoun'))).toBe(true)
    expect(result.errors.some(e => e.layer === 'product/api')).toBe(true)
  })

  it('detects invalid action verb reference', () => {
    const badApi = {
      ...productApi,
      resources: [
        { name: 'Loan', noun: 'Loan', fields: [], actions: [{ name: 'Fly', verb: 'Fly' }] },
      ],
    }
    const result = validator.validateCrossLayer({ operational, productApi: badApi })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.message.includes('Verb "Fly"'))).toBe(true)
  })

  it('detects invalid operation capability reference', () => {
    const badApi = {
      ...productApi,
      operations: [
        { resource: 'Loan', action: 'Warp', name: 'Loan.Warp', capability: 'Loan.Warp' },
      ],
    }
    const result = validator.validateCrossLayer({ operational, productApi: badApi })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.message.includes('Capability "Loan.Warp"'))).toBe(true)
  })

  it('detects invalid endpoint operation reference', () => {
    const badApi = {
      ...productApi,
      endpoints: [{ method: 'GET', path: '/x', operation: 'Loan.Teleport' }],
    }
    const result = validator.validateCrossLayer({ operational, productApi: badApi })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.message.includes('Operation "Loan.Teleport"'))).toBe(true)
  })

  it('detects invalid page resource reference', () => {
    const badUi = {
      ...productUi,
      pages: [{ name: 'WidgetPage', resource: 'Widget', blocks: [] }],
    }
    const result = validator.validateCrossLayer({ operational, productApi, productUi: badUi })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.message.includes('Resource "Widget"'))).toBe(true)
    expect(result.errors.some(e => e.layer === 'product/ui')).toBe(true)
  })

  it('detects invalid block operation reference', () => {
    const badUi = {
      ...productUi,
      pages: [
        {
          name: 'LoanPage',
          resource: 'Loan',
          blocks: [{ name: 'BadBlock', operation: 'Loan.Levitate' }],
        },
      ],
    }
    const result = validator.validateCrossLayer({ operational, productApi, productUi: badUi })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.message.includes('Operation "Loan.Levitate"'))).toBe(true)
  })

  it('detects invalid route page reference', () => {
    const badUi = {
      pages: (productUi as any).pages,
      routes: [{ path: '/nowhere', page: 'GhostPage' }],
    }
    const result = validator.validateCrossLayer({ operational, productApi, productUi: badUi })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.message.includes('Page "GhostPage"'))).toBe(true)
  })

  it('detects invalid construct provider reference', () => {
    const badTech = {
      ...technical,
      constructs: [{ name: 'bad-db', type: 'database', category: 'storage', provider: 'gcp' }],
    }
    const result = validator.validateCrossLayer({ operational, technical: badTech })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.message.includes('Provider "gcp"'))).toBe(true)
    expect(result.errors.some(e => e.layer === 'technical')).toBe(true)
  })

  it('detects invalid cell construct reference', () => {
    const badTech = {
      ...technical,
      cells: [
        { name: 'test-cell', dna: 'lending/product.api', adapter: { type: 'node/express' }, constructs: ['phantom-db'] },
      ],
    }
    const result = validator.validateCrossLayer({ operational, technical: badTech })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.message.includes('Construct "phantom-db"'))).toBe(true)
  })

  it('works with partial layers (only operational + productApi)', () => {
    const result = validator.validateCrossLayer({ operational, productApi })
    expect(result.valid).toBe(true)
  })

  it('works with only technical layer', () => {
    const result = validator.validateCrossLayer({ technical })
    expect(result.valid).toBe(true)
  })

  it('detects invalid Signal capability reference', () => {
    const badOp = {
      ...operational,
      signals: [
        { name: 'lending.Loan.Teleported', capability: 'Loan.Teleport', payload: [{ name: 'id', type: 'string' }] }
      ]
    }
    const result = validator.validateCrossLayer({ operational: badOp })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.message.includes('Capability "Loan.Teleport"'))).toBe(true)
    expect(result.errors.some(e => e.layer === 'operational')).toBe(true)
  })

  it('detects invalid Outcome emits reference', () => {
    const badOp = {
      ...operational,
      outcomes: [
        ...operational.outcomes,
        { capability: 'Loan.Apply', changes: [{ attribute: 'loan.status', set: 'under_review' }], emits: ['lending.Loan.Vanished'] }
      ]
    }
    const result = validator.validateCrossLayer({ operational: badOp })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.message.includes('Signal "lending.Loan.Vanished"'))).toBe(true)
  })

  it('detects invalid Cause signal reference', () => {
    const badOp = {
      ...operational,
      causes: [
        ...operational.causes,
        { capability: 'Loan.Apply', source: 'signal', signal: 'payments.Payment.Ghosted' }
      ]
    }
    const result = validator.validateCrossLayer({ operational: badOp })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.message.includes('Signal "payments.Payment.Ghosted"'))).toBe(true)
  })

  it('passes signal validation for valid lending DNA with signals', () => {
    const result = validator.validateCrossLayer({ operational })
    expect(result.valid).toBe(true)
  })

  it('detects invalid Relationship from noun reference', () => {
    const badOp = {
      ...operational,
      relationships: [
        { name: 'Ghost.borrower', from: 'Ghost', to: 'Borrower', cardinality: 'many-to-one', attribute: 'borrower_id' }
      ]
    }
    const result = validator.validateCrossLayer({ operational: badOp })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.message.includes('Noun "Ghost"') && e.message.includes('(from)'))).toBe(true)
  })

  it('detects invalid Relationship to noun reference', () => {
    const badOp = {
      ...operational,
      relationships: [
        { name: 'Loan.phantom', from: 'Loan', to: 'Phantom', cardinality: 'many-to-one', attribute: 'borrower_id' }
      ]
    }
    const result = validator.validateCrossLayer({ operational: badOp })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.message.includes('Noun "Phantom"') && e.message.includes('(to)'))).toBe(true)
  })

  it('detects invalid Relationship attribute reference', () => {
    const badOp = {
      ...operational,
      relationships: [
        { name: 'Loan.borrower', from: 'Loan', to: 'Borrower', cardinality: 'many-to-one', attribute: 'ghost_id' }
      ]
    }
    const result = validator.validateCrossLayer({ operational: badOp })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.message.includes('Attribute "ghost_id"'))).toBe(true)
  })

  it('passes relationship validation for valid lending DNA', () => {
    const result = validator.validateCrossLayer({ operational })
    expect(result.valid).toBe(true)
  })
})

// ── Cross-layer: product.core ────────────────────────────────────────────────

describe('DnaValidator — cross-layer with product.core', () => {
  const operational = loadDna('dna/lending/operational.json')
  const productApi = loadDna('dna/lending/product.api.json')
  const productUi = loadDna('dna/lending/product.ui.json')
  const productCore = loadDna('dna/lending/product.core.json')

  it('passes when core is consistent with operational', () => {
    const result = validator.validateCrossLayer({ operational, productCore })
    expect(result.valid).toBe(true)
  })

  it('detects a Noun in product.core that is not in operational', () => {
    const badCore = {
      ...productCore,
      nouns: [...(productCore.nouns ?? []), { name: 'Phantom', attributes: [], verbs: [] }],
    }
    const result = validator.validateCrossLayer({ operational, productCore: badCore })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.layer === 'product/core' && e.message.includes('Phantom'))).toBe(true)
  })

  it('detects a Capability in product.core that is not in operational', () => {
    const badCore = {
      ...productCore,
      capabilities: [
        ...(productCore.capabilities ?? []),
        { noun: 'Loan', verb: 'Vanish', name: 'Loan.Vanish' },
      ],
    }
    const result = validator.validateCrossLayer({ operational, productCore: badCore })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.message.includes('Loan.Vanish'))).toBe(true)
  })

  it('resolves product.api noun refs against product.core when present', () => {
    // product.core has the same Noun set as operational, so valid api references
    // should still pass when only core is provided (no operational).
    const result = validator.validateCrossLayer({ productCore, productApi })
    expect(result.valid).toBe(true)
  })

  it('detects product.api references against product.core (not operational)', () => {
    const minimalCore = {
      domain: { name: 'lending', path: 'acme.finance.lending' },
      nouns: [{ name: 'Loan', verbs: [{ name: 'Apply' }] }],
    }
    const badApi = {
      ...productApi,
      resources: [{ name: 'Borrower', noun: 'Borrower', fields: [], actions: [] }],
    }
    const result = validator.validateCrossLayer({ productCore: minimalCore, productApi: badApi })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.message.includes('Borrower') && e.message.includes('Product Core'))).toBe(true)
  })

  it('falls back to operational when product.core is absent', () => {
    // With only operational (no core), cross-layer still works.
    const result = validator.validateCrossLayer({ operational, productApi, productUi })
    expect(result.valid).toBe(true)
  })
})
