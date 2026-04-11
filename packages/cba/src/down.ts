import * as fs from 'fs'
import * as path from 'path'
import { ParsedArgs, flag, boolFlag } from './args'
import { emitError } from './output'
import { DOWN_HELP } from './help'
import { buildPlan } from './deliver/plan'
import {
  DELIVERY_ADAPTERS,
  DeliveryAdapterId,
  isDeliveryAdapterId,
  teardownWith,
} from './deliver/registry'
import { LaunchContext, LaunchFlags } from './deliver/adapters/types'

const DEFAULT_ADAPTER: DeliveryAdapterId = 'docker-compose'

/**
 * `cba down` — tear down a deployed topology. No regen, no plan rewrite; just
 * invokes the delivery adapter's teardown hook against the existing deploy dir.
 *
 * docker-compose: `docker compose down -v` (or without -v if --keep-volumes)
 * terraform/aws : `terraform destroy` — requires --auto-approve (will destroy AWS resources)
 */
export function runDown(argv: string[], args: ParsedArgs): void {
  const opts = { json: boolFlag(args, 'json') }

  if (boolFlag(args, 'help')) {
    console.log(DOWN_HELP)
    return
  }

  const [domain] = argv
  if (!domain) {
    emitError('Usage: cba down <domain> --env <environment> [--adapter <name>]', opts)
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

  const flags: LaunchFlags = {
    keepVolumes: boolFlag(args, 'keep-volumes'),
    autoApprove: boolFlag(args, 'auto-approve'),
  }

  let deployDir: string
  try {
    deployDir = buildPlan(domain, environment).deployDir
  } catch (err) {
    emitError((err as Error).message, opts)
    process.exit(1)
  }

  if (!fs.existsSync(deployDir)) {
    emitError(
      `No deploy dir at ${path.relative(process.cwd(), deployDir)}. Run \`cba up ${domain} --env ${environment}\` first.`,
      opts,
    )
    process.exit(1)
  }

  if (!opts.json) {
    const action = adapterId === 'docker-compose' ? 'docker compose down' : 'terraform destroy'
    console.log(`→ teardown (${action}) in ${path.relative(process.cwd(), deployDir)}`)
  }

  const ctx: LaunchContext = { deployDir, env: {}, flags }

  teardownWith(adapterId, ctx)
    .then((code) => process.exit(code))
    .catch((err) => {
      emitError((err as Error).message, opts)
      process.exit(1)
    })
}
