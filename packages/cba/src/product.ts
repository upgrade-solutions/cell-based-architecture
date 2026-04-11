import * as path from 'path'
import { ParsedArgs, boolFlag } from './args'
import { runLayerCommand } from './design'
import { PRODUCT_HELP } from './help'
import { emitError, emitOk } from './output'
import { resolveDomain } from './context'
import { materializeAndSaveProductCore } from './product-core'

export function runProduct(argv: string[], args: ParsedArgs): void {
  if (boolFlag(args, 'help') || argv.length === 0) {
    console.log(PRODUCT_HELP)
    return
  }

  const [sublayer, ...rest] = argv
  const opts = { json: boolFlag(args, 'json') }

  if (sublayer === 'core') {
    runCore(rest, args, opts)
    return
  }

  if (sublayer !== 'api' && sublayer !== 'ui') {
    emitError(`Unknown product layer: "${sublayer}". Valid: core, api, ui`, opts)
    process.exit(1)
  }

  const layer = sublayer === 'api' ? 'product.api' as const : 'product.ui' as const
  runLayerCommand(layer, rest, args)
}

/**
 * cba product core materialize <domain>
 *   Reads operational.json + product.api.json + product.ui.json for the domain
 *   and writes the materialized product.core.json. Called automatically by
 *   cba develop; this is the manual trigger.
 */
function runCore(argv: string[], _args: ParsedArgs, opts: { json: boolean }): void {
  const [sub, domain] = argv
  if (sub !== 'materialize' || !domain) {
    emitError('Usage: cba product core materialize <domain>', opts)
    process.exit(1)
  }

  let paths: ReturnType<typeof resolveDomain>
  try {
    paths = resolveDomain(domain)
  } catch (err) {
    emitError((err as Error).message, opts)
    process.exit(1)
  }

  try {
    const core = materializeAndSaveProductCore(paths)
    emitOk(
      {
        domain,
        file: paths.files['product.core'],
        nouns: core.nouns.length,
        capabilities: core.capabilities?.length ?? 0,
        signals: core.signals?.length ?? 0,
      },
      opts,
      () =>
        `✓ materialized ${path.relative(process.cwd(), paths.files['product.core'])} — ${core.nouns.length} noun(s), ${
          core.capabilities?.length ?? 0
        } capability(ies), ${core.signals?.length ?? 0} signal(s)`,
    )
  } catch (err) {
    emitError((err as Error).message, opts)
    process.exit(1)
  }
}
