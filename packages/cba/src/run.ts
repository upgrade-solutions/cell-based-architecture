import * as path from 'path'
import * as fs from 'fs'
import { spawn } from 'child_process'
import { findRepoRoot, resolveDomain, loadLayer } from './context'
import { ParsedArgs, flag, boolFlag } from './args'
import { emitError } from './output'
import { RUN_HELP } from './help'

interface AdapterRunSpec {
  dir: string
  cmd: string
  args: string[]
}

function resolveAdapter(domain: string, environment: string, adapter: string, root: string): AdapterRunSpec {
  const envDir = path.join(root, 'output', domain, environment)
  const conventions: Record<string, AdapterRunSpec> = {
    express: {
      dir: path.join(envDir, 'api'),
      cmd: 'npx',
      args: ['ts-node', 'src/main.ts'],
    },
    nestjs: {
      dir: path.join(envDir, 'api-nestjs'),
      cmd: 'npx',
      args: ['ts-node', '-r', 'tsconfig-paths/register', 'src/main.ts'],
    },
    vite: {
      dir: path.join(envDir, 'ui'),
      cmd: 'npx',
      args: ['vite'],
    },
  }
  const spec = conventions[adapter]
  if (!spec) {
    throw new Error(`Unknown adapter "${adapter}". Known: ${Object.keys(conventions).join(', ')}`)
  }
  if (!fs.existsSync(spec.dir)) {
    throw new Error(
      `Generated output not found at ${spec.dir}. Run 'cba develop ${domain} --env ${environment}' first.`,
    )
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
  const envArg = flag(args, 'env')
  if (!domain || !adapter) {
    emitError('Usage: cba run <domain> --adapter <name> [--env <environment>]', opts)
    process.exit(1)
  }

  let spec: AdapterRunSpec
  try {
    const paths = resolveDomain(domain)
    const technical = loadLayer(paths, 'technical')
    const envs = (technical.environments ?? []) as Array<{ name: string }>
    const environment = envArg ?? envs[0]?.name ?? 'dev'
    spec = resolveAdapter(domain, environment, adapter, findRepoRoot())
  } catch (err) {
    emitError((err as Error).message, opts)
    process.exit(1)
  }

  console.log(`→ ${adapter}  cwd=${path.relative(process.cwd(), spec.dir)}`)
  const child = spawn(spec.cmd, spec.args, { cwd: spec.dir, stdio: 'inherit' })
  child.on('exit', (code) => process.exit(code ?? 0))
}
