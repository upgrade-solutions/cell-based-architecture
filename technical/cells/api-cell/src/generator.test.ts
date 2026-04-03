import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { toKebabCase, toTableName, toCamelCase, toFileName, collectNouns } from './utils'
import { generateDrizzleSchema } from './adapters/node/nestjs/generators/schema'
import { generateDto, dtoClassName, dtoFileName } from './adapters/node/nestjs/generators/dto'
import { generateController } from './adapters/node/nestjs/generators/controller'
import { generateService } from './adapters/node/nestjs/generators/service'
import { generateModule } from './adapters/node/nestjs/generators/module'
import { generateDockerfile, generateDockerIgnore } from './adapters/node/docker'
import { run } from './run'
import { Noun, Resource, Endpoint, Namespace } from './types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const loanNoun: Noun = {
  name: 'Loan',
  description: 'A financial loan.',
  attributes: [
    { name: 'id', type: 'string', required: true },
    { name: 'amount', type: 'number', required: true },
    { name: 'status', type: 'enum', required: true, values: ['pending', 'active', 'repaid'] },
    { name: 'due_date', type: 'date' },
    { name: 'approved_at', type: 'datetime' },
  ],
}

const loanResource: Resource = {
  name: 'Loan',
  noun: 'Loan',
  fields: [],
  actions: [{ name: 'Apply', verb: 'Apply' }, { name: 'Approve', verb: 'Approve' }],
}

const namespace: Namespace = { name: 'Lending', path: '/lending', resources: ['Loan'] }

const applyEndpoint: Endpoint = {
  method: 'POST',
  path: '/lending/loans',
  operation: 'Loan.Apply',
  description: 'Submit a loan application.',
  request: {
    name: 'ApplyLoanRequest',
    fields: [
      { name: 'amount', label: 'Amount', type: 'number', required: true },
      { name: 'term_months', label: 'Term', type: 'number', required: true },
      { name: 'purpose', label: 'Purpose', type: 'string' },
    ],
  },
}

const approveEndpoint: Endpoint = {
  method: 'PATCH',
  path: '/lending/loans/:id/approve',
  operation: 'Loan.Approve',
  description: 'Approve a loan.',
  params: [{ name: 'id', in: 'path', type: 'string', required: true }],
  request: {
    name: 'ApproveLoanRequest',
    fields: [
      { name: 'interest_rate', label: 'Interest Rate', type: 'number', required: true },
      { name: 'due_date', label: 'Due Date', type: 'date', required: true },
    ],
  },
}

const viewEndpoint: Endpoint = {
  method: 'GET',
  path: '/lending/loans/:id',
  operation: 'Loan.View',
  params: [{ name: 'id', in: 'path', type: 'string', required: true }],
}

const listEndpoint: Endpoint = {
  method: 'GET',
  path: '/lending/loans',
  operation: 'Loan.List',
  params: [
    { name: 'status', in: 'query', type: 'string' },
    { name: 'borrower_id', in: 'query', type: 'string' },
  ],
}

// ── utils ─────────────────────────────────────────────────────────────────────

describe('utils', () => {
  test('toKebabCase', () => {
    expect(toKebabCase('Loan')).toBe('loan')
    expect(toKebabCase('LoanApplication')).toBe('loan-application')
    expect(toKebabCase('BorrowerProfile')).toBe('borrower-profile')
  })

  test('toTableName', () => {
    expect(toTableName('Loan')).toBe('loans')
    expect(toTableName('Borrower')).toBe('borrowers')
    expect(toTableName('LoanApplication')).toBe('loan_applications')
  })

  test('toCamelCase', () => {
    expect(toCamelCase('Approve')).toBe('approve')
    expect(toCamelCase('Apply')).toBe('apply')
    expect(toCamelCase('LoanApply')).toBe('loanApply')
  })

  test('toFileName', () => {
    expect(toFileName('Loan')).toBe('loans')
    expect(toFileName('Borrower')).toBe('borrowers')
  })

  test('collectNouns from nested domain', () => {
    const nouns = collectNouns({
      name: 'acme',
      domains: [{
        name: 'finance',
        domains: [{ name: 'lending', nouns: [{ name: 'Borrower' }, { name: 'Loan' }] }],
      }],
    })
    expect(nouns).toHaveLength(2)
    expect(nouns.map(n => n.name)).toEqual(['Borrower', 'Loan'])
  })
})

// ── Drizzle schema ────────────────────────────────────────────────────────────

describe('generateDrizzleSchema', () => {
  const sql = generateDrizzleSchema([loanNoun])

  test('imports from drizzle-orm/pg-core', () => {
    expect(sql).toContain("from 'drizzle-orm/pg-core'")
  })

  test('exports a pgTable for the noun', () => {
    expect(sql).toContain("export const loans = pgTable('loans'")
  })

  test('maps id to primaryKey', () => {
    expect(sql).toContain("text('id').primaryKey().notNull()")
  })

  test('maps number to numeric', () => {
    expect(sql).toContain("numeric('amount').notNull()")
  })

  test('maps enum to text with comment', () => {
    expect(sql).toContain("text('status').notNull()")
    expect(sql).toContain('// pending | active | repaid')
  })

  test('maps date to date', () => {
    expect(sql).toContain("date('due_date')")
  })

  test('maps datetime to timestamp with timezone', () => {
    expect(sql).toContain("timestamp('approved_at', { withTimezone: true })")
  })

  test('always includes created_at and updated_at', () => {
    expect(sql).toContain("timestamp('created_at', { withTimezone: true }).notNull().defaultNow()")
    expect(sql).toContain("timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()")
  })
})

// ── DTO ───────────────────────────────────────────────────────────────────────

describe('generateDto', () => {
  test('dtoClassName', () => {
    expect(dtoClassName('Apply', 'Loan')).toBe('ApplyLoanDto')
    expect(dtoClassName('Approve', 'Loan')).toBe('ApproveLoanDto')
  })

  test('dtoFileName', () => {
    expect(dtoFileName('Apply', 'Loan')).toBe('apply-loan.dto')
    expect(dtoFileName('Approve', 'Loan')).toBe('approve-loan.dto')
  })

  test('generates DTO class with correct name', () => {
    const dto = generateDto(applyEndpoint, 'Loan')!
    expect(dto).toContain('export class ApplyLoanDto')
  })

  test('required fields have validators without @IsOptional', () => {
    const dto = generateDto(applyEndpoint, 'Loan')!
    expect(dto).toContain('@IsNumber()')
    expect(dto).not.toMatch(/@IsOptional\(\)\s+@IsNumber\(\)\s+amount/)
  })

  test('optional fields have @IsOptional', () => {
    const dto = generateDto(applyEndpoint, 'Loan')!
    expect(dto).toContain('@IsOptional()')
    expect(dto).toContain('purpose?: string')
  })

  test('returns null for endpoints without request body', () => {
    expect(generateDto(viewEndpoint, 'Loan')).toBeNull()
    expect(generateDto(listEndpoint, 'Loan')).toBeNull()
  })

  test('imports from class-validator', () => {
    const dto = generateDto(applyEndpoint, 'Loan')!
    expect(dto).toContain("from 'class-validator'")
  })
})

// ── Controller ────────────────────────────────────────────────────────────────

describe('generateController', () => {
  const endpoints = [applyEndpoint, viewEndpoint, listEndpoint, approveEndpoint]
  const policies = [
    { capability: 'Loan.Apply', allow: [{ role: 'borrower' }] },
    { capability: 'Loan.Approve', allow: [{ role: 'underwriter' }] },
  ]
  const ctrl = generateController(loanResource, endpoints, [], policies, namespace)

  test('declares @Controller with correct base path', () => {
    expect(ctrl).toContain("@Controller('lending/loans')")
  })

  test('imports from @nestjs/common', () => {
    expect(ctrl).toContain("from '@nestjs/common'")
  })

  test('has @Post() for apply', () => {
    expect(ctrl).toContain('@Post()')
  })

  test('has @Patch with relative sub-path for approve', () => {
    expect(ctrl).toContain("@Patch(':id/approve')")
  })

  test('has @Get with :id for view', () => {
    expect(ctrl).toContain("@Get(':id')")
  })

  test('has @Roles for operations with policies', () => {
    expect(ctrl).toContain("@Roles('borrower')")
    expect(ctrl).toContain("@Roles('underwriter')")
  })

  test('uses @UseGuards(AuthGuard)', () => {
    expect(ctrl).toContain('@UseGuards(AuthGuard)')
  })

  test('has @Param for path params', () => {
    expect(ctrl).toContain("@Param('id') id: string")
  })

  test('has @Query for query params', () => {
    expect(ctrl).toContain("@Query('status') status?: string")
  })
})

// ── Service ───────────────────────────────────────────────────────────────────

describe('generateService', () => {
  const endpoints = [applyEndpoint, approveEndpoint, viewEndpoint]
  const policies = [{ capability: 'Loan.Apply', allow: [{ role: 'borrower' }] }]
  const rules = [{
    capability: 'Loan.Apply',
    conditions: [{ attribute: 'loan.amount', operator: 'gt', value: 0 }],
  }]
  const effects = [{
    capability: 'Loan.Apply',
    changes: [{ attribute: 'loan.status', set: 'under_review' }],
  }]

  const svc = generateService(loanResource, endpoints, [], policies, rules, effects)

  test('is an @Injectable() class', () => {
    expect(svc).toContain('@Injectable()')
    expect(svc).toContain('export class LoansService')
  })

  test('has method stubs that throw', () => {
    expect(svc).toContain("throw new Error('not implemented')")
  })

  test('annotates capability operations with Policy/Rules/Effects', () => {
    expect(svc).toContain('// Policy:')
    expect(svc).toContain('// Rules:')
    expect(svc).toContain('// Effects:')
  })

  test('includes DTO in method signature for endpoints with request body', () => {
    expect(svc).toContain('ApplyLoanDto')
    expect(svc).toContain('ApproveLoanDto')
  })
})

// ── Module ────────────────────────────────────────────────────────────────────

describe('generateModule', () => {
  const mod = generateModule(loanResource)

  test('declares @Module', () => {
    expect(mod).toContain('@Module(')
  })

  test('wires controller and service', () => {
    expect(mod).toContain('LoansController')
    expect(mod).toContain('LoansService')
  })

  test('exports the service', () => {
    expect(mod).toContain('exports: [LoansService]')
  })
})

// ── Docker ────────────────────────────────────────────────────────────────────

describe('docker generators', () => {
  test('Dockerfile uses multi-stage build', () => {
    const df = generateDockerfile(3000)
    expect(df).toContain('AS builder')
    expect(df).toContain('AS runner')
    expect(df).toContain('EXPOSE 3000')
    expect(df).toContain('CMD ["node", "dist/main"]')
  })

  test('.dockerignore excludes node_modules and dist', () => {
    const di = generateDockerIgnore()
    expect(di).toContain('node_modules')
    expect(di).toContain('dist')
  })
})

// ── Integration ───────────────────────────────────────────────────────────────

describe('api-cell integration', () => {
  const repoRoot = path.resolve(__dirname, '../../../../')
  const technicalPath = path.join(repoRoot, 'dna/lending/technical.json')
  let outputDir: string

  beforeAll(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'api-cell-test-'))
    run(technicalPath, 'api-cell', outputDir)
  })

  afterAll(() => {
    fs.rmSync(outputDir, { recursive: true, force: true })
  })

  const expectFile = (relPath: string) =>
    expect(fs.existsSync(path.join(outputDir, relPath))).toBe(true)

  test('generates Dockerfile and .dockerignore', () => {
    expectFile('Dockerfile')
    expectFile('.dockerignore')
  })

  test('generates scaffold files', () => {
    expectFile('package.json')
    expectFile('tsconfig.json')
    expectFile('tsconfig.build.json')
    expectFile('drizzle.config.ts')
  })

  test('generates Drizzle schema from Operational DNA', () => {
    expectFile('src/db/schema.ts')
    const schema = fs.readFileSync(path.join(outputDir, 'src/db/schema.ts'), 'utf-8')
    expect(schema).toContain("export const borrowers = pgTable('borrowers'")
    expect(schema).toContain("export const loans = pgTable('loans'")
  })

  test('generates auth files', () => {
    expectFile('src/auth/auth.guard.ts')
    expectFile('src/auth/roles.decorator.ts')
  })

  test('generates app.module.ts and main.ts', () => {
    expectFile('src/app.module.ts')
    expectFile('src/main.ts')
  })

  test('generates borrower resource files', () => {
    expectFile('src/borrowers/borrowers.controller.ts')
    expectFile('src/borrowers/borrowers.service.ts')
    expectFile('src/borrowers/borrowers.module.ts')
    expectFile('src/borrowers/dto/register-borrower.dto.ts')
  })

  test('generates loan resource files', () => {
    expectFile('src/loans/loans.controller.ts')
    expectFile('src/loans/loans.service.ts')
    expectFile('src/loans/loans.module.ts')
  })

  test('loans controller has correct decorators', () => {
    const ctrl = fs.readFileSync(path.join(outputDir, 'src/loans/loans.controller.ts'), 'utf-8')
    expect(ctrl).toContain("@Controller('lending/loans')")
    expect(ctrl).toContain("@Roles('borrower')")
    expect(ctrl).toContain("@Roles('underwriter')")
    expect(ctrl).toContain("@Patch(':id/approve')")
    expect(ctrl).toContain("@Patch(':id/reject')")
    expect(ctrl).toContain("@Post(':id/repayments')")
  })

  test('loans service has annotated stubs', () => {
    const svc = fs.readFileSync(path.join(outputDir, 'src/loans/loans.service.ts'), 'utf-8')
    expect(svc).toContain('// Policy:')
    expect(svc).toContain('// Rules:')
    expect(svc).toContain('// Effects:')
    expect(svc).toContain("throw new Error('not implemented')")
  })

  test('loan DTOs exist for operations with request bodies', () => {
    expectFile('src/loans/dto/apply-loan.dto.ts')
    expectFile('src/loans/dto/approve-loan.dto.ts')
    expectFile('src/loans/dto/repay-loan.dto.ts')
  })
})
