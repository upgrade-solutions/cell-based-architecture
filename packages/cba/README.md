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

## CLI structure

The CLI is organized around the three DNA layers plus build/deploy:

```
cba operational ...     # Operational DNA (business logic, domain concepts)
cba product ...         # Product DNA — api or ui surface
cba technical ...       # Technical DNA (cells, constructs, infra)
cba develop ...         # DNA → generated code
cba deploy ...          # compose cells into a deployable topology
```

`run`, `validate`, and `domains` are cross-cutting utilities.

## Commands

### `cba operational <command> <domain>` — work with Operational DNA

Commands: `discover`, `list`, `show`, `add`, `remove`, `schema`, `validate`.

```bash
# Inspect
cba operational list lending
cba operational list lending --type Noun
cba operational show lending --type Noun --name Loan
cba operational schema Noun

# Mutate
cba operational add lending --type Noun --at acme.finance.lending --file loan.json
cba operational remove lending --type Noun --name OldNoun

# Discover — agent-driven stakeholder conversation
cba operational discover lending
cba operational discover lending --from notes.md
cba operational discover lending --continue
```

**Nested operational primitives** (Noun, Verb, Attribute) require `--at`:

- `Noun`: `--at <domain-path>` (e.g. `acme.finance.lending`)
- `Verb` / `Attribute`: `--at <domain-path>:<noun-name>` (e.g.
  `acme.finance.lending:Loan`)

Session artifacts from `discover` land in `.cba/sessions/` (transcript) and
`.cba/drafts/` (proposed DNA diff).

### `cba product <api|ui> <command> <domain>` — work with Product DNA

Sublayers: `api`, `ui`.
Commands: `list`, `show`, `add`, `remove`, `schema`, `validate`.

```bash
# API surface
cba product api list lending
cba product api show lending --type Endpoint --name "GET /loans"
cba product api add lending --type Endpoint --file create-loan.json
cba product api schema Resource

# UI surface
cba product ui list lending
cba product ui show lending --type Page --name LoanListPage
cba product ui schema Block
```

### `cba technical <command> <domain>` — work with Technical DNA

Commands: `list`, `show`, `add`, `remove`, `schema`, `validate`.

```bash
cba technical list lending
cba technical show lending --type Cell --name api-cell
cba technical add lending --type Variable --file new-var.json
cba technical remove lending --type Variable --name OLD_FLAG
cba technical schema Construct
```

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

### `cba deploy <domain> --env <env> [--adapter <name>]` — compose cells into a deployable topology

Reads Technical DNA for the target Environment, wires each Cell's generated
artifact to its declared Constructs, and writes deployment files via the
selected adapter. Fails loudly if `cba develop` hasn't been run first.

```bash
cba deploy lending --env dev                          # default: docker-compose
cba deploy lending --env dev --plan                   # preview without writing
cba deploy lending --env dev --adapter docker-compose
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
- `--help` — show help for the current command (also `cba help <command>`)

## Using cba from an agent

Agents should prefer `--json` on every call for parsable output. A typical
loop:

```bash
cba operational list lending --json                   # discover existing
cba operational schema Noun --json                    # learn the primitive shape
cba operational add lending --type Noun --at acme.finance.lending \
  --file /tmp/draft-noun.json --json                  # commit a draft
cba validate lending --json                           # catch cross-layer errors
cba develop lending --dry-run --json                  # preview generation
cba develop lending --json                            # commit the generation
```

The `--json` output always includes an `ok` field and a structured
`errors` array on failure.

## Package layout

```
packages/cba/
├── bin/cba              # bash entrypoint → ts-node src/index.ts
├── src/
│   ├── index.ts         # dispatcher
│   ├── help.ts          # help text for every command
│   ├── args.ts          # argv parser
│   ├── context.ts       # repo-root + domain path resolution
│   ├── primitives.ts    # primitive catalog (which primitives live where)
│   ├── output.ts        # --json / human output helpers
│   ├── operational.ts   # operational layer commands (incl. discover)
│   ├── product.ts       # product layer commands (api/ui dispatch)
│   ├── technical.ts     # technical layer commands
│   ├── design.ts        # shared list / show / add / remove / schema / validate
│   ├── develop.ts       # cell generation dispatch
│   ├── run.ts           # start generated output
│   ├── deliver/         # deployment: plan + adapters (docker-compose, ...)
│   ├── discover.ts      # discovery session scaffolding
│   └── validate.ts      # cross-layer validation
└── tsconfig.json
```

No build step — `bin/cba` runs via `ts-node`.
