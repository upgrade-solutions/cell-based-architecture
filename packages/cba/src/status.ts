import * as fs from 'fs'
import * as path from 'path'
import { ParsedArgs, flag, boolFlag } from './args'
import { emitError } from './output'
import { STATUS_HELP } from './help'
import { buildPlan } from './deliver/plan'
import {
  DELIVERY_ADAPTERS,
  DeliveryAdapterId,
  isDeliveryAdapterId,
  statusWith,
} from './deliver/registry'
import { LaunchContext } from './deliver/adapters/types'

const DEFAULT_ADAPTER: DeliveryAdapterId = 'docker-compose'

/**
 * `cba status` — show the running state of a deployed topology.
 *
 * docker-compose: `docker compose ps` in the deploy dir
 * terraform/aws : `terraform show` + targeted AWS resource summary
 */
export function runStatus(argv: string[], args: ParsedArgs): void {
  const opts = { json: boolFlag(args, 'json') }

  if (boolFlag(args, 'help')) {
    console.log(STATUS_HELP)
    return
  }

  const [domain] = argv
  if (!domain) {
    emitError('Usage: cba status <domain> --env <environment> [--adapter <name>]', opts)
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
    const action = adapterId === 'docker-compose' ? 'docker compose ps' : 'terraform show + AWS resources'
    console.log(`→ status (${action}) in ${path.relative(process.cwd(), deployDir)}`)
  }

  const ctx: LaunchContext = { deployDir, env: {}, flags: {} }

  statusWith(adapterId, ctx)
    .then((code) => process.exit(code))
    .catch((err) => {
      emitError((err as Error).message, opts)
      process.exit(1)
    })
}
