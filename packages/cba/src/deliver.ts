import { ParsedArgs, boolFlag } from './args'
import { emit, emitError } from './output'
import { DELIVER_HELP } from './help'

export function runDeliver(argv: string[], args: ParsedArgs): void {
  const opts = { json: boolFlag(args, 'json') }

  if (boolFlag(args, 'help')) {
    console.log(DELIVER_HELP)
    return
  }

  emit(
    {
      status: 'not_implemented',
      message: 'cba deliver is a v1 stub — requires infra-cell (Phase 3 roadmap item).',
      argv,
    },
    opts,
    () =>
      [
        '⚠  cba deliver is not yet implemented.',
        '',
        '   Delivery requires infra-cell, which generates IaC from Technical DNA',
        '   Constructs, Providers, and Environments. See ROADMAP.md → Phase 3.',
        '',
        '   For now, use `cba develop` to generate cells and deploy manually.',
      ].join('\n'),
  )
}
