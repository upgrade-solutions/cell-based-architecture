import { ParsedArgs, boolFlag } from './args'
import { runLayerCommand } from './design'
import { runDiscover } from './discover'
import { OPERATIONAL_HELP } from './help'

export function runOperational(argv: string[], args: ParsedArgs): void {
  if (boolFlag(args, 'help') || argv.length === 0) {
    console.log(OPERATIONAL_HELP)
    return
  }

  const [command] = argv
  if (command === 'discover') {
    runDiscover(argv.slice(1), args)
    return
  }

  runLayerCommand('operational', argv, args)
}
