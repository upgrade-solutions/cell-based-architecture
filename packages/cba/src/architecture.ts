import { ParsedArgs, boolFlag } from './args'
import { runLayerCommand } from './design'
import { ARCHITECTURE_HELP } from './help'

export function runArchitecture(argv: string[], args: ParsedArgs): void {
  if (boolFlag(args, 'help') || argv.length === 0) {
    console.log(ARCHITECTURE_HELP)
    return
  }

  runLayerCommand('architecture', argv, args)
}
