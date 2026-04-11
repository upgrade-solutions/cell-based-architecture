import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { run } from './run'

const TECHNICAL_PATH = path.resolve(__dirname, '../../../../dna/lending/technical.json')

function withTempDir(fn: (dir: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'event-bus-cell-'))
  try {
    fn(dir)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

describe('event-bus-cell — node/event-bus adapter', () => {
  it('generates all expected output files', () => {
    withTempDir(dir => {
      run(TECHNICAL_PATH, 'event-bus-cell', dir)

      expect(fs.existsSync(path.join(dir, 'package.json'))).toBe(true)
      expect(fs.existsSync(path.join(dir, 'tsconfig.json'))).toBe(true)
      expect(fs.existsSync(path.join(dir, 'src/schema-registry.ts'))).toBe(true)
      expect(fs.existsSync(path.join(dir, 'src/publishers.ts'))).toBe(true)
      expect(fs.existsSync(path.join(dir, 'src/routing.ts'))).toBe(true)
      expect(fs.existsSync(path.join(dir, 'src/subscriber.ts'))).toBe(true)
      expect(fs.existsSync(path.join(dir, 'src/client.ts'))).toBe(true)
      expect(fs.existsSync(path.join(dir, 'src/dna/product.core.json'))).toBe(true)
    })
  })

  it('generates schema registry with all lending signals', () => {
    withTempDir(dir => {
      run(TECHNICAL_PATH, 'event-bus-cell', dir)

      const registry = fs.readFileSync(path.join(dir, 'src/schema-registry.ts'), 'utf-8')
      expect(registry).toContain("'lending.Loan.Disbursed'")
      expect(registry).toContain("'lending.Loan.Defaulted'")
      expect(registry).toContain("capability: 'Loan.Disburse'")
      expect(registry).toContain("capability: 'Loan.Default'")
      expect(registry).toContain('SIGNAL_REGISTRY')
      expect(registry).toContain('SIGNAL_NAMES')
      expect(registry).toContain('SignalName')
    })
  })

  it('generates typed publisher functions per signal', () => {
    withTempDir(dir => {
      run(TECHNICAL_PATH, 'event-bus-cell', dir)

      const publishers = fs.readFileSync(path.join(dir, 'src/publishers.ts'), 'utf-8')
      expect(publishers).toContain('publishLoanDisbursed')
      expect(publishers).toContain('publishLoanDefaulted')
      expect(publishers).toContain('LoanDisbursedPayload')
      expect(publishers).toContain('LoanDefaultedPayload')
      expect(publishers).toContain('loan_id: string')
      expect(publishers).toContain('amount: number')
    })
  })

  it('generates routing config mapping signals to subscribers', () => {
    withTempDir(dir => {
      run(TECHNICAL_PATH, 'event-bus-cell', dir)

      const routing = fs.readFileSync(path.join(dir, 'src/routing.ts'), 'utf-8')
      expect(routing).toContain('SIGNAL_ROUTES')
      expect(routing).toContain("'lending.Loan.Disbursed'")
      expect(routing).toContain("'lending.Loan.Defaulted'")
    })
  })

  it('generates client with configured engine', () => {
    withTempDir(dir => {
      run(TECHNICAL_PATH, 'event-bus-cell', dir)

      const client = fs.readFileSync(path.join(dir, 'src/client.ts'), 'utf-8')
      expect(client).toContain('Engine: rabbitmq')
      expect(client).toContain('EVENT_BUS_URL')
      expect(client).toContain('publish')
      expect(client).toContain('subscribe')
    })
  })

  it('generates valid package.json', () => {
    withTempDir(dir => {
      run(TECHNICAL_PATH, 'event-bus-cell', dir)

      const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8'))
      expect(pkg.name).toBe('lending-event-bus')
      expect(pkg.scripts.start).toBeDefined()
    })
  })

  it('throws on unknown cell name', () => {
    withTempDir(dir => {
      expect(() => run(TECHNICAL_PATH, 'nonexistent-cell', dir)).toThrow('not found')
    })
  })
})
