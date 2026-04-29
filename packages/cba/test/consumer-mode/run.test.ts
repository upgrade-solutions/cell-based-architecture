/**
 * Consumer-mode regression test.
 *
 * Stages a fixture project that depends on @dna-codes/cells via a file: ref into a
 * tmp dir, runs `npm install` then `npx cba develop`, and asserts that cell
 * artifacts land where they should. This is the missing safety net for the
 * "cba works in its own monorepo but breaks under a downstream consumer"
 * class of bugs (see openspec/changes/fix-develop-spawn-from-consumer/).
 *
 * Slow — invokes a real `npm install`. Excluded from the default `npm test`
 * script; run with `npm run test:consumer-mode`.
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { execFileSync } from 'child_process'

const FIXTURE_DIR = path.resolve(__dirname, 'fixture')
const CBA_PACKAGE_DIR = path.resolve(__dirname, '..', '..')
const DOMAIN = 'lending'
const ENVIRONMENT = 'dev'

function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name)
    const d = path.join(dest, entry.name)
    if (entry.isDirectory()) copyDir(s, d)
    else if (entry.isFile()) fs.copyFileSync(s, d)
  }
}

function rewritePackageJson(tmpDir: string): void {
  const pkgPath = path.join(tmpDir, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  pkg.dependencies = pkg.dependencies ?? {}
  pkg.dependencies['@dna-codes/cells'] = `file:${CBA_PACKAGE_DIR}`
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8')
}

describe('cba develop from a downstream consumer', () => {
  let tmpDir: string

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cba-consumer-mode-'))
    copyDir(FIXTURE_DIR, tmpDir)
    rewritePackageJson(tmpDir)

    // Build cba so the installed copy has a fresh dist/. The bin/cba wrapper
    // prefers dist/index.js when present; without it the consumer falls back
    // to ts-node-from-cwd, which isn't the path we're regression-testing.
    execFileSync('npm', ['run', 'build'], { cwd: CBA_PACKAGE_DIR, stdio: 'inherit' })

    // npm install — pulls in @dna-codes/cells via the absolute file: ref. The flags
    // keep the install quiet and avoid hitting the registry for audit/fund.
    execFileSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: tmpDir, stdio: 'inherit' })
  }, 5 * 60 * 1000)

  afterAll(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('generates cell output into <consumer>/output/<domain>/<env>/<cell>/', () => {
    execFileSync(
      'npx',
      ['--no-install', 'cba', 'develop', DOMAIN, '--env', ENVIRONMENT, '--cell', 'api-cell'],
      { cwd: tmpDir, stdio: 'inherit' },
    )

    const cellOutputPkg = path.join(tmpDir, 'output', DOMAIN, ENVIRONMENT, 'api', 'package.json')
    expect(fs.existsSync(cellOutputPkg)).toBe(true)
  }, 5 * 60 * 1000)
})
