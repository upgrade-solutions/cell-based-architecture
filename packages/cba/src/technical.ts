import { ParsedArgs, boolFlag } from './args'
import { runLayerCommand } from './design'
import { TECHNICAL_HELP } from './help'

export function runTechnical(argv: string[], args: ParsedArgs): void {
  if (boolFlag(args, 'help') || argv.length === 0) {
    console.log(TECHNICAL_HELP)
    return
  }

  runLayerCommand('technical', argv, args)
}
