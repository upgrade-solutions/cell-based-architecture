# @cell/cba

Unified CLI for the cell-based architecture lifecycle.

## Install

The CLI is a workspace package. `npm install` at the repo root symlinks
`cba` into `node_modules/.bin/cba`:

```bash
npm install
npx cba --help
# or: ./node_modules/.bin/cba --help
```

## The D-D-D-D lifecycle

```
Discover  →  conversation / research         [agent + stakeholder]
Design    →  author DNA                      [cba design ...]
Develop   →  DNA → generated code            [cba develop ...]
Deliver   →  deploy cells to an environment  [cba deliver ...]
```

Each phase is a top-level command. `run` and `validate` are utilities that
don't belong to a single phase.

## Commands

### `cba discover <domain>` — stakeholder conversation → draft DNA

Launches (or resumes, or ingests notes into) an agent-driven discovery
session. The agent converses with stakeholders and proposes DNA changes,
using the other `cba` commands to ground itself and draft proposals.

```bash
cba discover lending                       # start a new session
cba discover lending --from notes.md       # ingest existing notes
cba discover lending --continue            # resume most recent session
```

Session artifacts land in `.cba/sessions/` (transcript) and `.cba/drafts/`
(proposed DNA diff). You review and commit the draft with `cba design
... add`.

### `cba design <layer> <command> <domain>` — author DNA

Layers: `operational`, `product.api`, `product.ui`, `technical`.
Commands: `list`, `show`, `add`, `remove`, `schema`, `validate`.

```bash
# Inspect
cba design operational list lending
cba design operational list lending --type Noun
cba design operational show lending --type Noun --name Loan
cba design operational schema Noun

# Mutate
cba design operational add lending --type Noun --at acme.finance.lending --file loan.json
cba design product.api add lending --type Endpoint --file create-loan.json
cba design technical remove lending --type Variable --name OLD_FLAG
```

**Nested operational primitives** (Noun, Verb, Attribute) require `--at`:

- `Noun`: `--at <domain-path>` (e.g. `acme.finance.lending`)
- `Verb` / `Attribute`: `--at <domain-path>:<noun-name>` (e.g.
  `acme.finance.lending:Loan`)

### `cba develop <domain>` — run cells (DNA → code)

Reads the domain's technical DNA to find declared cells, then invokes each
cell's generator.

```bash
cba develop lending                        # run all cells
cba develop lending --cell api-cell        # run just one
cba develop lending --dry-run              # print plan, don't generate
```

Output convention: `output/<domain>-<suffix>/` where suffix is the cell
name with `-cell` stripped (`api-cell` → `<domain>-api`, `api-cell-nestjs`
→ `<domain>-api-nestjs`, `db-cell` → `<domain>-db`, `ui-cell` →
`<domain>-ui`).

### `cba deliver <domain> --env <env> [--adapter <name>]` — compose cells into a deployable topology

Reads Technical DNA for the target Environment, wires each Cell's generated
artifact to its declared Constructs, and writes delivery files via the
selected adapter. Fails loudly if `cba develop` hasn't been run first.

```bash
cba deliver lending --env dev                          # default: docker-compose
cba deliver lending --env dev --plan                   # preview without writing
cba deliver lending --env dev --adapter docker-compose
```

**Supported adapters:**

| Adapter | Status | Output |
|---------|--------|--------|
| `docker-compose` | built | `output/<domain>-deploy/docker-compose.yml` + README |
| `terraform/aws` | planned | AWS IaC |
| `aws-sam` | planned | AWS serverless |

The `docker-compose` adapter maps storage Constructs (postgres, redis) to
standard images, builds node/vite cells from their output dirs, and wires
`DATABASE_URL`/`REDIS_URL`/output-reference env vars to compose-internal
service URLs. External providers and network Constructs are reported under
`skipped`.

### `cba run <domain> --adapter <name>` — run generated output locally

```bash
cba run lending --adapter express          # Express API on :3001
cba run lending --adapter nestjs           # NestJS API on :3000
cba run lending --adapter vite             # Vite dev server
```

### `cba validate <domain>` — validate DNA

Validates each layer's JSON schema and checks cross-layer references.

```bash
cba validate lending
cba validate lending --layer operational
cba validate lending --json                # structured errors
```

### `cba domains` — list domains

Lists all domains under `dna/`.

## Global flags

Every command supports:

- `--json` — emit machine-readable JSON (for agents and scripts)
- `--help` — show help for the current command (also `cba help <phase>`)

## Using cba from an agent

Agents should prefer `--json` on every call for parsable output. A typical
loop:

```bash
cba design operational list lending --json          # discover existing
cba design operational schema Noun --json           # learn the primitive shape
cba design operational add lending --type Noun --at acme.finance.lending \
  --file /tmp/draft-noun.json --json                # commit a draft
cba validate lending --json                         # catch cross-layer errors
cba develop lending --dry-run --json                # preview generation
cba develop lending --json                          # commit the generation
```

The `--json` output always includes an `ok` field and a structured
`errors` array on failure.

## Package layout

```
packages/cba/
├── bin/cba            # bash entrypoint → ts-node src/index.ts
├── src/
│   ├── index.ts       # dispatcher
│   ├── help.ts        # help text for every command
│   ├── args.ts        # argv parser
│   ├── context.ts     # repo-root + domain path resolution
│   ├── primitives.ts  # primitive catalog (which primitives live where)
│   ├── output.ts      # --json / human output helpers
│   ├── design.ts      # list / show / add / remove / schema / validate
│   ├── develop.ts     # cell generation dispatch
│   ├── run.ts         # start generated output
│   ├── deliver/       # delivery: plan + adapters (docker-compose, ...)
│   ├── discover.ts    # session scaffolding
│   └── validate.ts    # cross-layer validation
└── tsconfig.json
```

No build step — `bin/cba` runs via `ts-node`.
