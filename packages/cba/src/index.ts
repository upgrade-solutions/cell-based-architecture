#!/usr/bin/env node
import { parseArgs, boolFlag } from './args'
import { helpFor, ROOT_HELP } from './help'
import { runOperational } from './operational'
import { runProduct } from './product'
import { runTechnical } from './technical'
import { runDevelop } from './develop'
import { runDeliver } from './deliver/index'
import { runUp } from './up'
import { runDown } from './down'
import { runStatus } from './status'
import { runRun } from './run'
import { runValidate } from './validate'
import { runAgent } from './agent'
import { runViews } from './views'
import { listDomains, findRepoRoot } from './context'
import { emit } from './output'

function main(): void {
  const argv = process.argv.slice(2)
  const args = parseArgs(argv)

  // Find the command (first positional arg)
  const [command, ...rest] = args.positional

  // No command → root help
  if (!command || command === 'help' && !rest[0]) {
    console.log(ROOT_HELP)
    return
  }

  // `cba help <command>`
  if (command === 'help') {
    console.log(helpFor(rest[0]))
    return
  }

  // `cba --help` anywhere at the top level
  if (boolFlag(args, 'help') && !rest.length) {
    console.log(helpFor(command))
    return
  }

  switch (command) {
    case 'operational':
      runOperational(rest, args)
      return
    case 'product':
      runProduct(rest, args)
      return
    case 'technical':
      runTechnical(rest, args)
      return
    case 'develop':
      runDevelop(rest, args)
      return
    case 'deploy':
      runDeliver(rest, args)
      return
    case 'up':
      runUp(rest, args)
      return
    case 'down':
      runDown(rest, args)
      return
    case 'status':
      runStatus(rest, args)
      return
    case 'run':
      runRun(rest, args)
      return
    case 'validate':
      runValidate(rest, args)
      return
    case 'agent':
      runAgent(rest, args)
      return
    case 'views':
      runViews(rest, args)
      return
    case 'domains': {
      const opts = { json: boolFlag(args, 'json') }
      const domains = listDomains(findRepoRoot())
      emit({ domains }, opts, () =>
        domains.length ? domains.map((d) => `  · ${d}`).join('\n') : '(no domains found)',
      )
      return
    }
    default:
      console.error(`Unknown command: "${command}"\n`)
      console.error(ROOT_HELP)
      process.exit(1)
  }
}

main()
