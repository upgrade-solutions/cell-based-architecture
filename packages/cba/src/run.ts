import * as path from 'path'
import * as fs from 'fs'
import { spawn } from 'child_process'
import { findRepoRoot } from './context'
import { ParsedArgs, flag, boolFlag } from './args'
import { emitError } from './output'
import { RUN_HELP } from './help'

interface AdapterRunSpec {
  dir: string
  cmd: string
  args: string[]
}

function resolveAdapter(domain: string, adapter: string, root: string): AdapterRunSpec {
  const conventions: Record<string, AdapterRunSpec> = {
    express: {
      dir: path.join(root, 'output', `${domain}-api`),
      cmd: 'npx',
      args: ['ts-node', 'src/main.ts'],
    },
    nestjs: {
      dir: path.join(root, 'output', `${domain}-api-nestjs`),
      cmd: 'npx',
      args: ['ts-node', '-r', 'tsconfig-paths/register', 'src/main.ts'],
    },
    vite: {
      dir: path.join(root, 'output', `${domain}-ui`),
      cmd: 'npx',
      args: ['vite'],
    },
  }
  const spec = conventions[adapter]
  if (!spec) {
    throw new Error(`Unknown adapter "${adapter}". Known: ${Object.keys(conventions).join(', ')}`)
  }
  if (!fs.existsSync(spec.dir)) {
    throw new Error(`Generated output not found at ${spec.dir}. Run 'cba develop ${domain}' first.`)
  }
  return spec
}

export function runRun(argv: string[], args: ParsedArgs): void {
  const opts = { json: boolFlag(args, 'json') }

  if (boolFlag(args, 'help')) {
    console.log(RUN_HELP)
    return
  }

  const [domain] = argv
  const adapter = flag(args, 'adapter')
  if (!domain || !adapter) {
    emitError('Usage: cba run <domain> --adapter <name>', opts)
    process.exit(1)
  }

  let spec: AdapterRunSpec
  try {
    spec = resolveAdapter(domain, adapter, findRepoRoot())
  } catch (err) {
    emitError((err as Error).message, opts)
    process.exit(1)
  }

  console.log(`→ ${adapter}  cwd=${path.relative(process.cwd(), spec.dir)}`)
  const child = spawn(spec.cmd, spec.args, { cwd: spec.dir, stdio: 'inherit' })
  child.on('exit', (code) => process.exit(code ?? 0))
}
