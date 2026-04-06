import { ParsedArgs, boolFlag } from './args'
import { runLayerCommand } from './design'
import { PRODUCT_HELP } from './help'
import { emitError } from './output'

export function runProduct(argv: string[], args: ParsedArgs): void {
  if (boolFlag(args, 'help') || argv.length === 0) {
    console.log(PRODUCT_HELP)
    return
  }

  const [sublayer, ...rest] = argv
  if (sublayer !== 'api' && sublayer !== 'ui') {
    const opts = { json: boolFlag(args, 'json') }
    emitError(`Unknown product layer: "${sublayer}". Valid: api, ui`, opts)
    process.exit(1)
  }

  const layer = sublayer === 'api' ? 'product.api' as const : 'product.ui' as const
  runLayerCommand(layer, rest, args)
}
