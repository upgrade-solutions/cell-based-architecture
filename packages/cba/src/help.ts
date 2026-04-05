export const ROOT_HELP = `cba — unified CLI for the cell-based architecture lifecycle

USAGE
  cba <phase> <command> [args] [--flags]

LIFECYCLE (D-D-D-D)
  discover   Launch or ingest a conversation → propose DNA       (stakeholder research)
  design     Author and validate DNA                             (operational / product / technical)
  develop    Run cells: DNA → generated code                     (per domain, per cell)
  deliver    Deploy generated cells to an environment            (infra provisioning)

UTILITIES
  run        Run generated output locally (dev servers)
  validate   Validate DNA across all layers + cross-layer refs
  domains    List domains found under dna/
  help       Show this help, or help for a specific phase

GLOBAL FLAGS
  --json     Emit machine-readable JSON (available on every command)
  --help     Show help for the current command

EXAMPLES
  cba domains                                    # list available domains
  cba design operational list lending            # list operational primitives
  cba design operational schema Noun             # show JSON schema for Noun
  cba validate lending                           # validate all layers of the lending domain
  cba develop lending --cell api-cell            # run just the api-cell for lending
  cba run lending --adapter express              # start generated Express API

See 'cba help <phase>' for details on each phase.
`

export const DISCOVER_HELP = `cba discover — stakeholder conversation → draft DNA

Launches or resumes an agent-driven discovery session. The agent converses
with stakeholders (or ingests existing notes/transcripts), proposes DNA
changes, and saves drafts into .cba/drafts/ for review before committing.

USAGE
  cba discover <domain>                     # start or resume a session
  cba discover <domain> --from <file>       # ingest notes/transcripts
  cba discover <domain> --continue          # resume most recent session

DURING A SESSION, THE AGENT USES:
  cba design ... list|show|schema           # to ground itself in existing DNA
  cba design ... add|update|remove          # to draft proposals
  cba validate <domain>                     # to check before committing

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

export const DESIGN_HELP = `cba design — author and validate DNA

USAGE
  cba design <layer> <command> <domain> [args]

LAYERS
  operational       Nouns, Verbs, Rules, Policies, Flows, etc. (domain language)
  product.api       Resources, Endpoints, Operations (API surface)
  product.ui        Layouts, Pages, Routes, Blocks (UI surface)
  technical         Environments, Constructs, Cells, Variables (deployment)

COMMANDS
  list              List primitives in a layer
  show              Show a single primitive as JSON
  add               Append a primitive (from a JSON file)
  remove            Remove a primitive by name
  schema            Show the JSON schema for a primitive type
  validate          Validate a single layer (see 'cba validate' for cross-layer)

EXAMPLES
  cba design operational list lending
  cba design operational list lending --type Noun
  cba design operational show lending --type Noun --name Loan
  cba design operational schema Rule

  cba design product.api list lending
  cba design product.api add lending --type Endpoint --file new-endpoint.json

  cba design technical show lending --type Cell --name api-cell
  cba design technical remove lending --type Variable --name OLD_FLAG

FLAGS (vary by command)
  --type <T>        Primitive type (Noun, Endpoint, Cell, etc.)
  --name <N>        Primitive name
  --file <path>     JSON file containing the primitive (for add)
  --at <domain>     Domain path for nested operational primitives
                    (e.g. --at acme.finance.lending)
  --json            Machine-readable output
`

export const DEVELOP_HELP = `cba develop — run cells: DNA → generated code

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

export const DELIVER_HELP = `cba deliver — deploy generated cells to an environment

USAGE
  cba deliver <domain> --env <environment> [--plan]

Reads technical DNA for Environments, Providers, and Constructs, then
(via infra-cell) provisions and deploys.

EXAMPLES
  cba deliver lending --env staging --plan   # preview (like terraform plan)
  cba deliver lending --env staging
  cba deliver lending --env prod

FLAGS
  --env <name>      Target environment (must exist in technical DNA)
  --plan            Preview changes without applying
  --json            Machine-readable output

STATUS
  v1 stub — requires infra-cell (Phase 3 roadmap item).
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
references (e.g. product Resources → operational Nouns).

EXAMPLES
  cba validate lending                       # all layers + cross-layer
  cba validate lending --layer operational   # single layer only

FLAGS
  --layer <name>    Limit to operational|product.api|product.ui|technical
  --json            Machine-readable output (structured errors)
`

export function helpFor(phase?: string): string {
  switch (phase) {
    case 'discover':
      return DISCOVER_HELP
    case 'design':
      return DESIGN_HELP
    case 'develop':
      return DEVELOP_HELP
    case 'deliver':
      return DELIVER_HELP
    case 'run':
      return RUN_HELP
    case 'validate':
      return VALIDATE_HELP
    default:
      return ROOT_HELP
  }
}
