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
    expect(schemas).toContain('operational/trigger')
    expect(schemas).toContain('operational/policy')
    expect(schemas).toContain('operational/rule')
    expect(schemas).toContain('operational/effect')
    expect(schemas).toContain('operational/flow')
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
