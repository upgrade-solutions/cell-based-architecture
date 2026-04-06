import * as fs from 'fs'
import * as path from 'path'
import { ParsedArgs, flag, boolFlag } from '../args'
import { emit, emitError, emitOk } from '../output'
import { DEPLOY_HELP } from '../help'
import { buildPlan, checkArtifacts, resolveProfile, EnvironmentPlan } from './plan'
import { generateDockerCompose } from './adapters/docker-compose'
import { generateTerraformAws } from './adapters/terraform-aws'

const DEFAULT_ADAPTER = 'docker-compose'
const SUPPORTED_ADAPTERS = ['docker-compose', 'terraform/aws']

export function runDeliver(argv: string[], args: ParsedArgs): void {
  const opts = { json: boolFlag(args, 'json') }

  if (boolFlag(args, 'help')) {
    console.log(DEPLOY_HELP)
    return
  }

  const [domain] = argv
  if (!domain) {
    emitError('Usage: cba deploy <domain> --env <environment> [--adapter <name>] [--plan]', opts)
    process.exit(1)
  }

  const environment = flag(args, 'env')
  if (!environment) {
    emitError('Missing required flag --env <environment>', opts)
    process.exit(1)
  }

  const adapter = flag(args, 'adapter') ?? DEFAULT_ADAPTER
  if (!SUPPORTED_ADAPTERS.includes(adapter)) {
    emitError(
      `Unsupported delivery adapter "${adapter}". Supported: ${SUPPORTED_ADAPTERS.join(', ')}`,
      opts,
    )
    process.exit(1)
  }

  const cellsFlag = flag(args, 'cells')
  const profileFlag = flag(args, 'profile')
  if (cellsFlag && profileFlag) {
    emitError('Cannot use both --cells and --profile. Pick one.', opts)
    process.exit(1)
  }

  const planOnly = boolFlag(args, 'plan')

  let plan: EnvironmentPlan
  try {
    plan = buildPlan(domain, environment)
  } catch (err) {
    emitError((err as Error).message, opts)
    process.exit(1)
  }

  // Filter cells by --cells or --profile
  if (cellsFlag || profileFlag) {
    let selectedCells: string[]
    if (cellsFlag) {
      selectedCells = cellsFlag.split(',').map((c) => c.trim())
    } else {
      const resolved = resolveProfile(domain, profileFlag!)
      if (!resolved) {
        emitError(
          `Profile "${profileFlag}" not found in technical DNA. Use \`cba technical show ${domain} --type Profile\` to list available profiles.`,
          opts,
        )
        process.exit(1)
      }
      selectedCells = resolved
    }

    const allCellNames = plan.cells.map((c) => c.name)
    const unknown = selectedCells.filter((c) => !allCellNames.includes(c))
    if (unknown.length) {
      emitError(
        `Unknown cell(s): ${unknown.join(', ')}. Available: ${allCellNames.join(', ')}`,
        opts,
      )
      process.exit(1)
    }

    plan.cells = plan.cells.filter((c) => selectedCells.includes(c.name))
  }

  // Verify cell artifacts exist (fail loudly — don't auto-develop)
  const missing = checkArtifacts(plan)
  if (missing.length) {
    emitError(
      `Missing generated artifacts for cells: ${missing.join(', ')}. Run \`cba develop ${domain}\` first.`,
      opts,
      { missing },
    )
    process.exit(1)
  }

  if (adapter === 'docker-compose') {
    const result = generateDockerCompose(plan)

    if (planOnly) {
      emit(
        {
          domain,
          environment,
          adapter,
          deployDir: plan.deployDir,
          services: result.services,
          skipped: result.skipped,
          files: result.files.map((f) => path.relative(process.cwd(), f.path)),
        },
        opts,
        () => {
          const lines = [
            `cba deploy ${domain} --env ${environment} --adapter ${adapter} — plan`,
            ``,
            `  deploy dir : ${path.relative(process.cwd(), plan.deployDir)}`,
            `  services   : ${result.services.length}`,
            ...result.services.map((s) => `    · ${s}`),
          ]
          if (result.skipped.length) {
            lines.push(``, `  skipped    : ${result.skipped.length}`)
            for (const s of result.skipped) {
              lines.push(`    · ${s.name} (${s.kind}) — ${s.reason}`)
            }
          }
          return lines.join('\n')
        },
      )
      return
    }

    // Write files
    fs.mkdirSync(plan.deployDir, { recursive: true })
    for (const file of result.files) {
      fs.mkdirSync(path.dirname(file.path), { recursive: true })
      fs.writeFileSync(file.path, file.content, 'utf-8')
    }

    emitOk(
      {
        domain,
        environment,
        adapter,
        deployDir: plan.deployDir,
        services: result.services,
        skipped: result.skipped,
        files: result.files.map((f) => path.relative(process.cwd(), f.path)),
      },
      opts,
      () => {
        const lines = [
          `✓ Deployed ${domain}/${environment} → ${path.relative(process.cwd(), plan.deployDir)}`,
          ``,
          `  ${result.services.length} service(s): ${result.services.join(', ')}`,
        ]
        if (result.skipped.length) {
          lines.push(`  ${result.skipped.length} skipped construct(s)`)
        }
        lines.push(
          ``,
          `  Next: cd ${path.relative(process.cwd(), plan.deployDir)} && docker compose up -d`,
        )
        return lines.join('\n')
      },
    )
  }

  if (adapter === 'terraform/aws') {
    const result = generateTerraformAws(plan)

    if (planOnly) {
      emit(
        {
          domain,
          environment,
          adapter,
          deployDir: plan.deployDir,
          resources: result.resources,
          skipped: result.skipped,
          files: result.files.map((f) => path.relative(process.cwd(), f.path)),
        },
        opts,
        () => {
          const lines = [
            `cba deploy ${domain} --env ${environment} --adapter ${adapter} — plan`,
            ``,
            `  deploy dir : ${path.relative(process.cwd(), plan.deployDir)}`,
            `  resources  : ${result.resources.length}`,
            ...result.resources.map((r) => `    · ${r}`),
          ]
          if (result.skipped.length) {
            lines.push(``, `  skipped    : ${result.skipped.length}`)
            for (const s of result.skipped) {
              lines.push(`    · ${s.name} (${s.kind}) — ${s.reason}`)
            }
          }
          return lines.join('\n')
        },
      )
      return
    }

    // Write files
    fs.mkdirSync(plan.deployDir, { recursive: true })
    for (const file of result.files) {
      fs.mkdirSync(path.dirname(file.path), { recursive: true })
      fs.writeFileSync(file.path, file.content, 'utf-8')
    }

    emitOk(
      {
        domain,
        environment,
        adapter,
        deployDir: plan.deployDir,
        resources: result.resources,
        skipped: result.skipped,
        files: result.files.map((f) => path.relative(process.cwd(), f.path)),
      },
      opts,
      () => {
        const lines = [
          `✓ Deployed ${domain}/${environment} → ${path.relative(process.cwd(), plan.deployDir)}`,
          ``,
          `  ${result.resources.length} resource(s): ${result.resources.join(', ')}`,
        ]
        if (result.skipped.length) {
          lines.push(`  ${result.skipped.length} skipped construct(s)`)
        }
        lines.push(
          ``,
          `  Next: cd ${path.relative(process.cwd(), plan.deployDir)} && terraform init && terraform plan`,
        )
        return lines.join('\n')
      },
    )
  }
}
