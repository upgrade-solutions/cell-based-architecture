export const ROOT_HELP = `cba — unified CLI for the cell-based architecture lifecycle

USAGE
  cba <command> [args] [--flags]

DNA LAYERS
  operational    Resources/Persons/Roles/Groups (+ Memberships), Operations, Triggers, Rules, Tasks, Processes, Relationships
  product        core (Resources, Operations) | api (Endpoints, Schemas) | ui (Pages, Routes, Blocks)
  technical      Environments, Constructs, Cells, Variables, Providers, Views

BUILD + DEPLOY
  develop        Run cells: DNA -> generated code                    (per domain, per cell)
  deploy         Compose generated cells into a deployable topology  (infra provisioning)
  up             Full pipeline: validate -> develop -> deploy -> launch the stack
  down           Tear down a deployed stack (docker compose down / terraform destroy)
  status         Show what's running (docker compose ps / terraform show + AWS summary)

UTILITIES
  run            Run generated output locally (dev servers)
  validate       Validate DNA across all layers + cross-layer refs
  domains        List domains found under dna/
  views          Derive architecture graph JSON from technical DNA (for cba-viz)
  agent          Find and show AGENTS.md contracts for layer/cell agents
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
  cba up lending --env dev --seed --build        # validate + develop + deploy + launch
  cba down lending --env dev                     # docker compose down -v
  cba status lending --env dev                   # docker compose ps
  cba status lending --env prod --adapter terraform/aws  # terraform show + AWS summary
  cba technical list lending --type View              # list architecture views

See 'cba help <command>' for details.
`

export const OPERATIONAL_HELP = `cba operational — work with Operational DNA

USAGE
  cba operational <command> <domain> [args]

Operational DNA captures pure business logic: domain concepts, processes,
rules, and SOPs. It is technology-agnostic and owned by the business.

COMMANDS
  discover       Launch or resume an agent-driven discovery session
  list           List primitives (Resources, Operations, Triggers, etc.)
  show           Show a single primitive as JSON
  add            Append a primitive (from a JSON file)
  remove         Remove a primitive by name
  schema         Show the JSON schema for a primitive type
  validate       Validate the operational layer

PRIMITIVES (sourced from @dna-codes/schemas)
  People       — Person, Role, Group, Membership
  Entities     — Resource, Attribute, Relationship
  Activities   — Operation, Task, Step (inside Process), Process, Trigger, Rule
  Container    — Domain (recursive)
  Action       — child of any noun primitive (Resource/Person/Role/Group)

EXAMPLES
  cba operational list lending
  cba operational list lending --type Resource
  cba operational show lending --type Resource --name Loan
  cba operational schema Rule
  cba operational add lending --type Resource --at acme.finance.lending --file loan.json
  cba operational add lending --type Action --at acme.finance.lending:Loan --file approve.json
  cba operational remove lending --type Resource --name OldResource
  cba operational discover lending
  cba operational discover lending --from notes.md
  cba operational discover lending --continue

FLAGS (vary by command)
  --type <T>        Primitive type (Resource, Operation, Trigger, etc.)
  --name <N>        Primitive name
  --file <path>     JSON file containing the primitive (for add)
  --at <domain>     Domain path for noun primitives, or <domain>:<noun> for Action/Attribute
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
  cba develop <domain> [--env <environment>] [--cell <name>] [--dry-run]

Reads the domain's technical DNA to find declared cells, then invokes each
cell's generator. By default runs ALL cells defined for the domain.

Generation is environment-scoped: each cell is written to
\`output/<domain>/<env>/<cell-suffix>/\`. Cells, constructs, variables, and
scripts with an \`environment\` field override the default entry of the same
name — so dev can generate against SQLite + RabbitMQ while prod generates
against Postgres + EventBridge from the same technical.json. When --env is
omitted, the first environment declared in technical.json is used.

EXAMPLES
  cba develop lending --env dev              # run all cells for lending/dev
  cba develop lending --env prod             # run all cells for lending/prod
  cba develop lending --cell api-cell        # run only api-cell (default env)
  cba develop lending --cell db-cell
  cba develop lending --dry-run              # show what would be generated

FLAGS
  --env <name>      Target environment (defaults to first in technical DNA)
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
  output/<domain>/<env>/deploy/    # compose file, README, deployment manifests
`

export const UP_HELP = `cba up — validate, develop, deploy, and launch the stack

USAGE
  cba up <domain> --env <environment> [--adapter <name>] [flags]

Runs the whole pipeline end-to-end:

  1. cba validate <domain>             — bail on broken DNA
  2. cba develop <domain>              — regenerate cells (skippable)
  3. cba deploy <domain> --env <env>   — compose the deploy topology
  4. adapter.launch                    — bring the stack up

This is the single command for "go from Operational DNA to a running stack".
Each step is the same in-process function as the standalone commands, so
failures abort the pipeline exactly like running them by hand.

DEPLOYMENT ADAPTERS
  docker-compose    Local multi-cell orchestration (default)
                    launch   → \`docker compose up -d\` in the deploy dir
                    teardown → \`docker compose down -v\`

  terraform/aws     AWS IaC (VPC, RDS, ECS Fargate, ALB, S3+CloudFront)
                    launch   → \`terraform init\` + \`terraform plan\`
                               (apply only when --auto-approve is set)
                    teardown → \`terraform destroy\` (--auto-approve required)

COMMON FLAGS
  --env <name>        Target environment (must exist in technical DNA)
  --adapter <name>    docker-compose | terraform/aws (default: docker-compose)
  --cell <name>       Develop only the named cell
  --cells <list>      Deploy only these cells (comma-separated)
  --profile <name>    Deploy a named profile from technical DNA
  --skip-develop      Skip regeneration — use already-generated cell artifacts
  --plan              Stop after generating the deploy topology (no launch)
  --json              Machine-readable output

DOCKER FLAGS
  --seed              Set SEED_EXAMPLES=true in the child env (load DNA examples)
  --attach            Run \`docker compose up\` in foreground (stream logs)
  --build             Pass --build to \`docker compose up\`
  --force-recreate    Pass --force-recreate to \`docker compose up\`

TERRAFORM FLAGS
  --auto-approve      Actually apply the plan. Without this, \`cba up\` stops
                      after \`terraform plan\` so you can review the diff.

EXAMPLES
  cba up torts --env dev --seed --build                          # local demo
  cba up torts --env dev --skip-develop --attach                 # rerun, stream logs
  cba up torts --env dev --cell api-cell --build --force-recreate
  cba up torts --env prod --adapter terraform/aws                # plan only
  cba up torts --env prod --adapter terraform/aws --auto-approve # actually apply
`

export const DOWN_HELP = `cba down — tear down a deployed stack

USAGE
  cba down <domain> --env <environment> [--adapter <name>] [flags]

Runs the delivery adapter's teardown hook against the existing deploy dir.
No regeneration, no deploy rewrite.

DEPLOYMENT ADAPTERS
  docker-compose    \`docker compose down -v\` (drops volumes by default)
  terraform/aws     \`terraform destroy\` — requires --auto-approve

FLAGS
  --env <name>        Target environment (must exist in technical DNA)
  --adapter <name>    docker-compose | terraform/aws (default: docker-compose)
  --keep-volumes      docker only — keep named volumes instead of dropping them
  --auto-approve      terraform only — required (destroys real AWS resources)
  --json              Machine-readable output

EXAMPLES
  cba down torts --env dev                            # compose down -v
  cba down torts --env dev --keep-volumes             # keep postgres data
  cba down torts --env prod --adapter terraform/aws --auto-approve
`

export const STATUS_HELP = `cba status — show what's running for a deployed topology

USAGE
  cba status <domain> --env <environment> [--adapter <name>]

Shows the current state of a deployed stack. The output depends on the
delivery adapter:

DEPLOYMENT ADAPTERS
  docker-compose    \`docker compose ps\` — container names, state, and ports
  terraform/aws     \`terraform show\` (if state exists) + a grouped AWS
                    resource count: Networking (VPC, subnets, NAT, IGW,
                    SGs, ALB, TGs), Compute (ECS, ECR, EC2), Storage
                    (RDS, S3, SNS, SQS), CDN (CloudFront), IAM

FLAGS
  --env <name>        Target environment (must exist in technical DNA)
  --adapter <name>    docker-compose | terraform/aws (default: docker-compose)
  --json              Machine-readable output

EXAMPLES
  cba status torts/marshall --env dev                              # docker compose ps
  cba status torts/marshall --env prod --adapter terraform/aws     # terraform + AWS summary
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
references (e.g. product Resources -> operational Resources).

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

export const VIEWS_HELP = `cba views — derive architecture graph JSON from technical DNA

USAGE
  cba views <domain> [--env <environment>] [--json]

The graph is auto-derived from the \`cells\`, \`constructs\`, and \`providers\`
arrays in the domain's technical.json (with environment overlay applied).
The \`views[]\` section of technical.json is treated as a layout overlay:
each entry's \`id\` + saved \`position\` + \`size\` is merged onto the derived
node of the same id.

This means:
  - Adding a cell/construct/provider to technical DNA makes it appear in the graph
  - Removing one removes it from the graph automatically
  - Manual position edits persist across DNA changes

OUTPUT
  Prints a JSON document: { "views": [ { name, nodes, connections, zones } ] }

CONSUMED BY
  cba-viz fetches this endpoint at /api/load-views/:domain?env=<env>.

EXAMPLES
  cba views lending --env dev
  cba views torts/marshall --env prod --json
`

export const AGENT_HELP = `cba agent — find and describe AGENTS.md contracts

Each concern boundary in the repo (operational layer, product layer,
technical layer, each cell, each domain) has an AGENTS.md file that
defines the prompt-level contract for a sub-agent that owns that scope.
This command resolves those contracts so an orchestrating agent can
load the right prompt and dispatch the right subagent type.

USAGE
  cba agent list                     # list every AGENTS.md in the repo
  cba agent <concern>                # show the contract for a concern
  cba agent <path-to-AGENTS.md>      # show a contract by explicit path

CONCERN SHORTHANDS
  operational                        → operational/AGENTS.md
  product                            → product/AGENTS.md
  technical                          → technical/AGENTS.md
  dna                                → dna/AGENTS.md (DNA generator meta-agent)
  api-cell | ui-cell | db-cell       → technical/cells/<name>/AGENTS.md

EXAMPLES
  cba agent list                            # see every contract in the repo
  cba agent operational                     # operational layer agent
  cba agent product                         # product layer (3 sub-agents)
  cba agent api-cell                        # api-cell per-adapter contract
  cba agent dna                             # top-level DNA generator

NOTE
  This command does NOT spawn a sub-agent itself. It resolves the contract
  file so the caller (Claude Code, a custom orchestrator, etc.) knows what
  prompt to load and which subagent type to dispatch.

FLAGS
  --json            Machine-readable output (includes full file content)
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
    case 'up':
      return UP_HELP
    case 'down':
      return DOWN_HELP
    case 'status':
      return STATUS_HELP
    case 'run':
      return RUN_HELP
    case 'validate':
      return VALIDATE_HELP
    case 'discover':
      return DISCOVER_HELP
    case 'agent':
      return AGENT_HELP
    case 'views':
      return VIEWS_HELP
    default:
      return ROOT_HELP
  }
}
