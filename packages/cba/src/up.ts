import * as path from 'path'
import { ParsedArgs, flag, boolFlag } from './args'
import { emit, emitError } from './output'
import { UP_HELP } from './help'
import { runValidate } from './validate'
import { runDevelop } from './develop'
import { runDeliver } from './deliver/index'
import { buildPlan } from './deliver/plan'
import {
  DELIVERY_ADAPTERS,
  DeliveryAdapterId,
  isDeliveryAdapterId,
  launchWith,
} from './deliver/registry'
import { LaunchContext, LaunchFlags } from './deliver/adapters/types'

const DEFAULT_ADAPTER: DeliveryAdapterId = 'docker-compose'

/**
 * `cba up` — the full pipeline from DNA to running topology:
 *   validate → develop → deliver → adapter.launch
 *
 * Each step reuses the existing in-process command function; only the final
 * launch step shells out (to `docker compose` or `terraform`). If any step
 * fails it exits non-zero — the same behavior as running the commands by hand.
 */
export function runUp(argv: string[], args: ParsedArgs): void {
  const opts = { json: boolFlag(args, 'json') }

  if (boolFlag(args, 'help')) {
    console.log(UP_HELP)
    return
  }

  const [domain] = argv
  if (!domain) {
    emitError('Usage: cba up <domain> --env <environment> [--adapter <name>]', opts)
    process.exit(1)
  }

  const environment = flag(args, 'env')
  if (!environment) {
    emitError('Missing required flag --env <environment>', opts)
    process.exit(1)
  }

  const adapterId = flag(args, 'adapter') ?? DEFAULT_ADAPTER
  if (!isDeliveryAdapterId(adapterId)) {
    emitError(
      `Unsupported delivery adapter "${adapterId}". Supported: ${DELIVERY_ADAPTERS.join(', ')}`,
      opts,
    )
    process.exit(1)
  }

  const skipDevelop = boolFlag(args, 'skip-develop')
  const planOnly = boolFlag(args, 'plan')
  const seed = boolFlag(args, 'seed')

  const launchFlags: LaunchFlags = {
    attach: boolFlag(args, 'attach'),
    build: boolFlag(args, 'build'),
    forceRecreate: boolFlag(args, 'force-recreate'),
    autoApprove: boolFlag(args, 'auto-approve'),
  }

  // ── Step 1: validate ────────────────────────────────────────────────────────
  if (!opts.json) console.log(`→ validate ${domain}`)
  runValidate([domain], { positional: [domain], flags: opts.json ? { json: true } : {} })

  // ── Step 2: develop ────────────────────────────────────────────────────────
  if (!skipDevelop) {
    if (!opts.json) console.log(`→ develop ${domain}`)
    const cellFilter = flag(args, 'cell')
    const developArgs: ParsedArgs = {
      positional: [domain],
      flags: {
        ...(cellFilter ? { cell: cellFilter } : {}),
        ...(opts.json ? { json: true } : {}),
      },
    }
    runDevelop([domain], developArgs)
  } else if (!opts.json) {
    console.log(`→ develop (skipped)`)
  }

  // ── Step 3: deliver ────────────────────────────────────────────────────────
  if (!opts.json) console.log(`→ deploy ${domain} --env ${environment} --adapter ${adapterId}`)
  const deliverArgs: ParsedArgs = {
    positional: [domain],
    flags: {
      env: environment,
      adapter: adapterId,
      ...(flag(args, 'cells') ? { cells: flag(args, 'cells')! } : {}),
      ...(flag(args, 'profile') ? { profile: flag(args, 'profile')! } : {}),
      ...(opts.json ? { json: true } : {}),
      // Suppress the trailing "Next: cd … && docker compose up -d" hint —
      // `cba up` launches immediately after this step, so the hint is noise.
      'no-next-hint': true,
    },
  }
  runDeliver([domain], deliverArgs)

  // Resolve the deploy dir the same way deliver does — reuse buildPlan so the
  // path convention can't drift between deliver and up.
  const deployDirResolved = buildPlan(domain, environment).deployDir

  if (planOnly) {
    if (!opts.json) {
      console.log('')
      console.log(`→ plan only — topology written to ${path.relative(process.cwd(), deployDirResolved)}`)
      console.log(`  Drop --plan to launch the stack.`)
    } else {
      emit({ ok: true, domain, environment, adapter: adapterId, planOnly: true, deployDir: deployDirResolved }, opts, () => '')
    }
    return
  }

  // ── Step 4: launch ──────────────────────────────────────────────────────────
  const launchCtx: LaunchContext = {
    deployDir: deployDirResolved,
    env: seed ? { SEED_EXAMPLES: 'true' } : {},
    flags: launchFlags,
  }

  if (!opts.json) {
    const action = adapterId === 'docker-compose' ? 'docker compose up' : 'terraform apply'
    console.log(`→ launch (${action}) in ${path.relative(process.cwd(), deployDirResolved)}`)
  }

  launchWith(adapterId, launchCtx)
    .then((code) => process.exit(code))
    .catch((err) => {
      emitError((err as Error).message, opts)
      process.exit(1)
    })
}
