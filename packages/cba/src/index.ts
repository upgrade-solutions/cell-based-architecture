#!/usr/bin/env node
import { parseArgs, boolFlag } from './args'
import { helpFor, ROOT_HELP } from './help'
import { runDesign } from './design'
import { runDevelop } from './develop'
import { runDeliver } from './deliver'
import { runDiscover } from './discover'
import { runRun } from './run'
import { runValidate } from './validate'
import { listDomains, findRepoRoot } from './context'
import { emit } from './output'

function main(): void {
  const argv = process.argv.slice(2)
  const args = parseArgs(argv)

  // Find the phase (first positional arg)
  const [phase, ...rest] = args.positional

  // No phase → root help
  if (!phase || phase === 'help' && !rest[0]) {
    console.log(ROOT_HELP)
    return
  }

  // `cba help <phase>`
  if (phase === 'help') {
    console.log(helpFor(rest[0]))
    return
  }

  // `cba --help` anywhere at the top level
  if (boolFlag(args, 'help') && !rest.length) {
    console.log(helpFor(phase))
    return
  }

  switch (phase) {
    case 'discover':
      runDiscover(rest, args)
      return
    case 'design':
      runDesign(rest, args)
      return
    case 'develop':
      runDevelop(rest, args)
      return
    case 'deliver':
      runDeliver(rest, args)
      return
    case 'run':
      runRun(rest, args)
      return
    case 'validate':
      runValidate(rest, args)
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
      console.error(`Unknown phase: "${phase}"\n`)
      console.error(ROOT_HELP)
      process.exit(1)
  }
}

main()
