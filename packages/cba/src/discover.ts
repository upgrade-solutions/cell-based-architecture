import * as fs from 'fs'
import * as path from 'path'
import { findRepoRoot, resolveDomain } from './context'
import { ParsedArgs, flag, boolFlag } from './args'
import { emit, emitError } from './output'
import { DISCOVER_HELP } from './help'

/* Re-export for use as a subcommand of `cba operational` */

interface DiscoverSession {
  domain: string
  timestamp: string
  transcriptPath: string
  draftPath: string
  sources: string[]
}

export function runDiscover(argv: string[], args: ParsedArgs): void {
  const opts = { json: boolFlag(args, 'json') }

  if (boolFlag(args, 'help')) {
    console.log(DISCOVER_HELP)
    return
  }

  const [domain] = argv
  if (!domain) {
    emitError('Usage: cba operational discover <domain> [--from <file>] [--continue]', opts)
    process.exit(1)
  }

  // Verify the domain exists (or offer to create a new one)
  const root = findRepoRoot()
  const domainExists = fs.existsSync(path.join(root, 'dna', domain))

  // Collect --from sources (can repeat)
  const sources: string[] = []
  const fromFlag = flag(args, 'from')
  if (fromFlag) sources.push(fromFlag)

  const cba = path.join(root, '.cba')
  const sessionsDir = path.join(cba, 'sessions')
  const draftsDir = path.join(cba, 'drafts')
  fs.mkdirSync(sessionsDir, { recursive: true })
  fs.mkdirSync(draftsDir, { recursive: true })

  if (boolFlag(args, 'continue')) {
    const recent = mostRecentSession(sessionsDir, domain)
    if (!recent) {
      emitError(`No previous session found for domain "${domain}"`, opts)
      process.exit(1)
    }
    emit({ resumed: true, session: recent }, opts, () =>
      [`→ Resuming session: ${recent.transcriptPath}`, `  draft: ${recent.draftPath}`].join('\n'),
    )
    return
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
  const transcriptPath = path.join(sessionsDir, `${domain}-${timestamp}.md`)
  const draftPath = path.join(draftsDir, `${domain}-${timestamp}.json`)
  // Nested domains (e.g. torts/marshall) need their parent dirs created
  fs.mkdirSync(path.dirname(transcriptPath), { recursive: true })
  fs.mkdirSync(path.dirname(draftPath), { recursive: true })

  const header = [
    `# Discovery session — ${domain}`,
    ``,
    `**Started:** ${new Date().toISOString()}`,
    `**Domain exists:** ${domainExists ? 'yes' : 'no (new domain)'}`,
    sources.length ? `**Sources:** ${sources.join(', ')}` : '',
    ``,
    `---`,
    ``,
    `## Conversation`,
    ``,
    `_(agent transcript goes here)_`,
    ``,
  ]
    .filter(Boolean)
    .join('\n')

  fs.writeFileSync(transcriptPath, header)
  fs.writeFileSync(
    draftPath,
    JSON.stringify(
      {
        domain,
        startedAt: new Date().toISOString(),
        sources,
        proposals: {
          operational: { add: [], update: [], remove: [] },
          'product.api': { add: [], update: [], remove: [] },
          'product.ui': { add: [], update: [], remove: [] },
          technical: { add: [], update: [], remove: [] },
        },
      },
      null,
      2,
    ) + '\n',
  )

  const session: DiscoverSession = {
    domain,
    timestamp,
    transcriptPath,
    draftPath,
    sources,
  }

  const nextSteps = [
    `cba operational list ${domain}`,
    `cba operational schema Resource`,
    `cba product api list ${domain}`,
    `cba validate ${domain} --json`,
  ]

  emit({ session, domainExists, nextSteps }, opts, () =>
    [
      `✓ Discovery session started for "${domain}"`,
      ``,
      `  transcript : ${path.relative(process.cwd(), transcriptPath)}`,
      `  draft      : ${path.relative(process.cwd(), draftPath)}`,
      `  domain     : ${domainExists ? 'exists' : 'new (dna/' + domain + '/ will be created)'}`,
      sources.length ? `  sources    : ${sources.join(', ')}` : '',
      ``,
      `An agent should now take over, using these commands to ground itself:`,
      ...nextSteps.map((s) => `  $ ${s}`),
      ``,
      `The agent accumulates proposals in the draft file, then you review`,
      `and apply them with 'cba design ... add'.`,
    ]
      .filter(Boolean)
      .join('\n'),
  )

  // Also try to resolve/validate the domain if it exists, so errors surface early
  if (domainExists) {
    try {
      resolveDomain(domain, root)
    } catch {
      /* ignore — agent can still proceed */
    }
  }
}

function mostRecentSession(sessionsDir: string, domain: string): DiscoverSession | undefined {
  if (!fs.existsSync(sessionsDir)) return undefined
  const files = fs
    .readdirSync(sessionsDir)
    .filter((f) => f.startsWith(`${domain}-`) && f.endsWith('.md'))
    .sort()
    .reverse()
  if (files.length === 0) return undefined
  const transcriptPath = path.join(sessionsDir, files[0])
  const timestamp = files[0].replace(`${domain}-`, '').replace('.md', '')
  const draftPath = path.join(path.dirname(sessionsDir), 'drafts', `${domain}-${timestamp}.json`)
  return { domain, timestamp, transcriptPath, draftPath, sources: [] }
}
