export const ROOT_HELP = `cba — unified CLI for the cell-based architecture lifecycle

USAGE
  cba <command> [args] [--flags]

DNA LAYERS
  operational    Nouns, Verbs, Capabilities, Causes, Rules, Outcomes, Lifecycles, discover
  product        Product surface — api (Resources, Endpoints) or ui (Pages, Routes, Blocks)
  technical      Environments, Constructs, Cells, Variables, Providers, Views

BUILD + DEPLOY
  develop        Run cells: DNA -> generated code                    (per domain, per cell)
  deploy         Compose generated cells into a deployable topology  (infra provisioning)

UTILITIES
  run            Run generated output locally (dev servers)
  validate       Validate DNA across all layers + cross-layer refs
  domains        List domains found under dna/
  help           Show this help, or help for a specific command

GLOBAL FLAGS
  --json         Emit machine-readable JSON (available on every command)
  --help         Show help for the current command

EXAMPLES
  cba domains                                    # list available domains
  cba operational list lending                   # list operational primitives
  cba operational discover lending               # start a discovery session
  cba product api list lending                   # list API primitives
  cba product ui list lending                    # list UI primitives
  cba technical show lending --type Cell --name api-cell
  cba validate lending                           # validate all layers
  cba develop lending --cell api-cell            # run just the api-cell
  cba deploy lending --env dev                   # compose into docker-compose
  cba deploy lending --env dev --profile python-stack  # deploy a named profile
  cba technical list lending --type View              # list architecture views

See 'cba help <command>' for details.
`

export const OPERATIONAL_HELP = `cba operational — work with Operational DNA

USAGE
  cba operational <command> <domain> [args]

Operational DNA captures pure business logic: domain concepts, processes,
rules, and lifecycle. It is technology-agnostic and owned by the business.

COMMANDS
  discover       Launch or resume an agent-driven discovery session
  list           List primitives (Nouns, Verbs, Capabilities, etc.)
  show           Show a single primitive as JSON
  add            Append a primitive (from a JSON file)
  remove         Remove a primitive by name
  schema         Show the JSON schema for a primitive type
  validate       Validate the operational layer

PRIMITIVES
  Noun, Verb, Attribute, Capability, Cause, Rule, Outcome, Lifecycle, Equation

EXAMPLES
  cba operational list lending
  cba operational list lending --type Noun
  cba operational show lending --type Noun --name Loan
  cba operational schema Rule
  cba operational add lending --type Noun --at acme.finance.lending --file loan.json
  cba operational add lending --type Verb --at acme.finance.lending:Loan --file approve.json
  cba operational remove lending --type Noun --name OldNoun
  cba operational discover lending
  cba operational discover lending --from notes.md
  cba operational discover lending --continue

FLAGS (vary by command)
  --type <T>        Primitive type (Noun, Verb, Capability, etc.)
  --name <N>        Primitive name
  --file <path>     JSON file containing the primitive (for add)
  --at <domain>     Domain path for nested operational primitives
  --from <file>     Ingest notes/transcripts (for discover)
  --continue        Resume most recent session (for discover)
  --json            Machine-readable output
`

export const PRODUCT_HELP = `cba product — work with Product DNA

USAGE
  cba product <api|ui> <command> <domain> [args]

Product DNA translates Operational DNA into the concrete surface of a product:
the screens a user sees (UI) and the API a developer calls (API).

SUBLAYERS
  api             Resources, Operations, Endpoints, Schemas, Namespace
  ui              Layout, Pages, Routes, Blocks

COMMANDS
  list            List primitives in the sublayer
  show            Show a single primitive as JSON
  add             Append a primitive (from a JSON file)
  remove          Remove a primitive by name
  schema          Show the JSON schema for a primitive type
  validate        Validate the sublayer

EXAMPLES
  cba product api list lending
  cba product api show lending --type Endpoint --name "GET /loans"
  cba product api add lending --type Endpoint --file new-endpoint.json
  cba product api schema Resource

  cba product ui list lending
  cba product ui show lending --type Page --name LoanListPage
  cba product ui schema Block

FLAGS (vary by command)
  --type <T>        Primitive type (Resource, Endpoint, Page, etc.)
  --name <N>        Primitive name
  --file <path>     JSON file containing the primitive (for add)
  --json            Machine-readable output
`

export const TECHNICAL_HELP = `cba technical — work with Technical DNA

USAGE
  cba technical <command> <domain> [args]

Technical DNA turns Product DNA into running code and deployable infrastructure.
It is composable and owned by engineering.

COMMANDS
  list            List primitives (Cells, Constructs, Variables, etc.)
  show            Show a single primitive as JSON
  add             Append a primitive (from a JSON file)
  remove          Remove a primitive by name
  schema          Show the JSON schema for a primitive type
  validate        Validate the technical layer

PRIMITIVES
  Environment, Provider, Construct, Variable, Cell, Output, Script,
  View, Node, Connection, Zone

EXAMPLES
  cba technical list lending
  cba technical show lending --type Cell --name api-cell
  cba technical list lending --type View
  cba technical show lending --type View --name deployment
  cba technical add lending --type Variable --file new-var.json
  cba technical remove lending --type Variable --name OLD_FLAG
  cba technical schema Construct
  cba technical schema Node

FLAGS (vary by command)
  --type <T>        Primitive type (Cell, Construct, Variable, etc.)
  --name <N>        Primitive name
  --file <path>     JSON file containing the primitive (for add)
  --json            Machine-readable output
`

export const DEVELOP_HELP = `cba develop — run cells: DNA -> generated code

USAGE
  cba develop <domain> [--cell <name>] [--dry-run]

Reads the domain's technical DNA to find declared cells, then invokes each
cell's generator. By default runs ALL cells defined for the domain.

EXAMPLES
  cba develop lending                        # run all cells for lending
  cba develop lending --cell api-cell        # run only api-cell
  cba develop lending --cell db-cell
  cba develop lending --dry-run              # show what would be generated

FLAGS
  --cell <name>     Run only the named cell (as declared in technical DNA)
  --dry-run         Print plan without generating (shows cell, adapter, output path)
  --json            Machine-readable output
`

export const DEPLOY_HELP = `cba deploy — compose generated cells into a deployable topology

USAGE
  cba deploy <domain> --env <environment> [--adapter <name>] [--cells <list>] [--profile <name>] [--plan]

Reads technical DNA for the target Environment (Constructs, Cells, Variables),
wires each cell's generated artifact to its declared Constructs, and writes
a deployable topology via the selected delivery adapter.

Requires that \`cba develop <domain>\` has been run — deployment composes
existing artifacts; it does not regenerate them.

CELL TARGETING
  By default all cells declared in technical DNA are included in the topology.
  Use --cells or --profile to deploy a subset.

  --cells     Comma-separated list of cell names to include
  --profile   Named profile declared in the technical DNA "profiles" map

  These flags are mutually exclusive.

DEPLOYMENT ADAPTERS
  docker-compose    Local multi-cell orchestration (default)
  terraform/aws     AWS IaC (VPC, RDS, ECS Fargate, ALB, S3+CloudFront)
  aws-sam           AWS serverless — planned

EXAMPLES
  cba deploy lending --env dev                                      # all cells, docker-compose
  cba deploy lending --env dev --cells api-cell,db-cell,ui-cell     # specific cells
  cba deploy lending --env dev --profile python-stack               # named profile
  cba deploy lending --env dev --plan                               # preview without writing
  cba deploy lending --env prod --adapter terraform/aws
  cba deploy lending --env prod --adapter terraform/aws --profile node-stack

FLAGS
  --env <name>        Target environment (must exist in technical DNA)
  --adapter <name>    Deployment adapter (default: docker-compose)
  --cells <list>      Comma-separated cell names to include
  --profile <name>    Named profile from technical DNA "profiles" section
  --plan              Preview changes without writing files
  --json              Machine-readable output

OUTPUT
  output/<domain>-deploy/    # compose file, README, deployment manifests
`

export const RUN_HELP = `cba run — run generated output locally

USAGE
  cba run <domain> --adapter <name> [--watch]

Starts a generated cell's output locally. Useful for dev-testing after
'cba develop'.

EXAMPLES
  cba run lending --adapter express          # start Express API on :3001
  cba run lending --adapter nestjs           # start NestJS API on :3000
  cba run lending --adapter vite             # start Vite dev server
  cba run lending --adapter express --watch  # hot-reload on DNA changes

FLAGS
  --adapter <name>  Which adapter's output to run (express|nestjs|vite|...)
  --watch           Hot-reload when DNA changes (where supported)
`

export const VALIDATE_HELP = `cba validate — validate DNA across all layers

USAGE
  cba validate <domain> [--layer <layer>]

Validates each layer against its JSON schema and checks cross-layer
references (e.g. product Resources -> operational Nouns).

EXAMPLES
  cba validate lending                       # all layers + cross-layer
  cba validate lending --layer operational   # single layer only

FLAGS
  --layer <name>    Limit to operational|product.api|product.ui|technical
  --json            Machine-readable output (structured errors)
`

export const DISCOVER_HELP = `cba operational discover — stakeholder conversation -> draft DNA

Launches or resumes an agent-driven discovery session. The agent converses
with stakeholders (or ingests existing notes/transcripts), proposes DNA
changes, and saves drafts into .cba/drafts/ for review before committing.

USAGE
  cba operational discover <domain>                     # start or resume a session
  cba operational discover <domain> --from <file>       # ingest notes/transcripts
  cba operational discover <domain> --continue          # resume most recent session

DURING A SESSION, THE AGENT USES:
  cba operational list|show|schema ...     # to ground itself in existing DNA
  cba product api|ui list|show ...         # to inspect product DNA
  cba validate <domain>                    # to check before committing

OUTPUTS
  .cba/sessions/<domain>-<timestamp>.md     # transcript
  .cba/drafts/<domain>-<timestamp>.json     # proposed DNA diff

FLAGS
  --from <file>     Ingest existing notes/transcripts (can repeat)
  --continue        Resume the most recent session for this domain
  --json            Machine-readable output

NOTE
  v1 scaffolds the session directories and prints what the agent would do.
  The conversational agent itself is launched by the caller (e.g. Claude
  Code) and uses the other cba commands as its tools.
`

export function helpFor(command?: string): string {
  switch (command) {
    case 'operational':
      return OPERATIONAL_HELP
    case 'product':
      return PRODUCT_HELP
    case 'technical':
      return TECHNICAL_HELP
    case 'develop':
      return DEVELOP_HELP
    case 'deploy':
      return DEPLOY_HELP
    case 'run':
      return RUN_HELP
    case 'validate':
      return VALIDATE_HELP
    case 'discover':
      return DISCOVER_HELP
    default:
      return ROOT_HELP
  }
}
