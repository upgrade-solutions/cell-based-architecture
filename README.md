# Cell-based Architecture

Cell-based architecture is a philosophy for building applications by injecting **DNA** into **cells** — infrastructure shells that read DNA and produce working software (API endpoints, UIs, database schemas, etc.).

- **DNA** — a JSON description language expressing a domain at three distinct layers (see below)
- **Cell** — a TypeScript package/engine that accepts one layer of DNA as input and produces code or deployable infrastructure

The relationship: DNA describes *what* the business is and does; cells decide *how* to implement it.

# The Three Layers of DNA

## 1. Operational DNA
> *"What the business does"* — analogous to Domain-Driven Design

Operational DNA captures pure business logic: domain concepts, processes, rules, and lifecycle. It is technology-agnostic and owned by the business, not engineering.

**Structure primitives:**

| Primitive | Description |
|-----------|-------------|
| `Noun` | A business entity (e.g. `Loan`, `Order`, `User`) |
| `Verb` | A business action (e.g. `Approve`, `Ship`, `Terminate`) |
| `Capability` | A Noun:Verb pair — the atomic unit of business activity (e.g. `Loan.Approve`) |
| `Attribute` | A property on a Noun (name, type, constraints) |
| `Domain` | Dot-separated hierarchy grouping Nouns into bounded contexts (e.g. `acme.finance.lending`) |

**Behavior primitives** — evaluated in order:
```
Cause → Rule → [Capability executes] → Outcome → Lifecycle
```

| Primitive | Description |
|-----------|-------------|
| `Cause` | What initiates a Capability (user action, webhook, schedule, chained Capability) |
| `Rule` | A constraint on a Capability — who may perform it (`type: access`) or what conditions must be met (`type: condition`) |
| `Outcome` | State changes and side effects after execution |
| `Lifecycle` | The valid sequence of Capabilities across the life of a Noun |
| `Equation` | A named, technology-agnostic computation — pure function with typed inputs and output. Implemented concretely by a Script in Technical DNA |

Schemas live in `../dna/schemas/`. Reference: `../dna` or https://github.com/upgrade-solutions/dna

---

## 2. Product DNA
> *"What gets built"* — analogous to Atomic Design (UI) + OpenAPI Specification (API)

Product DNA translates Operational DNA into the concrete surface of a product: the screens a user sees and the API a developer calls. It is owned by product/design and engineering together.

**Core primitives** (span both UI and API):

| Primitive | Maps from Operational | Description |
|-----------|----------------------|-------------|
| `Resource` | `Noun` | The product-level entity — realized as a Page in UI and a REST resource in API |
| `Action` | `Verb` | A product-level operation — realized as a UI trigger and an API endpoint action |
| `Operation` | `Capability` | A Resource:Action pair at the product level — the unit of user/system interaction |

**UI primitives:**

| Primitive | Maps from Product Core | Description |
|-----------|----------------------|-------------|
| `Layout` | — | Structural shell a set of Pages lives within (sidebar, full-width, etc.) |
| `Page` | `Resource` | A discrete screen representing a product Resource |
| `Route` | `Resource` | The URL pattern that resolves to a Page (e.g. `/loans/:id`) |
| `Block` | `Operation` | A named, reusable section within a Page (list, detail, form, etc.) |
| `Field` | `Attribute` | An input or display element tied to an Attribute |

**API primitives:**

| Primitive | Maps from Product Core | Description |
|-----------|----------------------|-------------|
| `Namespace` | `Domain` | A grouping of Resources under a shared API path prefix (e.g. `/finance/loans`) |
| `Endpoint` | `Operation` | A single HTTP operation: method + path + request + response |
| `Schema` | `Resource` + `Attribute`s | A named request/response data shape |
| `Param` | `Attribute` | A path, query, or header parameter |

---

## 3. Technical DNA
> *"How it gets built"* — analogous to Terraform / AWS SAM

Technical DNA turns Product DNA into running code and deployable infrastructure. It is owned by engineering. It is composable — a Technical DNA document can cover a single cell or an entire application.

DNA is a JSON DSL with support for **adapters**. An adapter is a framework- or platform-specific plugin (e.g. a Rails adapter, a NestJS adapter, a Next.js adapter). The adapter reads the DNA and the cell engine uses it to build or deploy the app. Adapter config is embedded inside the `Cell` primitive.

**Primitives:**

| Primitive | Description |
|-----------|-------------|
| `Environment` | A named deployment context (dev, staging, prod) — all primitives can be scoped to one |
| `Cell` | A deployed unit: DNA + Adapter + wired Constructs. The concrete embodiment of cell-based architecture |
| `Construct` | A named infrastructure component with a category and type (see below) |
| `Provider` | A named external platform that backs Constructs (aws, gcp, auth0, stripe, etc.) |
| `Variable` | An environment variable or secret reference |
| `Output` | An exported value from one Cell that other Cells can reference |
| `Script` | The concrete implementation of an Operational Equation — maps it to a deployed compute Construct (e.g. a Lambda) with a runtime and handler |

**Construct categories and types:**

| Category | Types |
|----------|-------|
| Compute | `function`, `container`, `server`, `worker` |
| Storage | `database`, `cache`, `filestore`, `queue` |
| Network | `gateway`, `loadbalancer`, `cdn` |

A `Cell` definition embeds its adapter config and references named `Construct`s:
```json
{
  "name": "api-cell",
  "dna": "lending/product.api",
  "adapter": { "type": "node/nestjs", "version": "10" },
  "constructs": ["primary-db", "auth-provider"]
}
```

Adapter types are namespaced by runtime — `node/nestjs`, `node/express`, `ruby/rails`, etc. — making the execution environment explicit in the DNA.

Constructs are declared once and referenced by multiple Cells — e.g. a `database` Construct shared by both an `api` Cell and a `workflow` Cell.

---

# Primitive Vocabulary by Layer

| Layer | Primitives |
|-------|-----------|
| Operational | `Noun`, `Verb`, `Capability`, `Attribute`, `Domain`, `Cause`, `Rule`, `Outcome`, `Lifecycle`, `Equation` |
| Product | `Resource`, `Action`, `Operation`, `Layout`, `Page`, `Route`, `Block`, `Field`, `Namespace`, `Endpoint`, `Schema`, `Param` |
| Technical | `Environment`, `Cell`, `Construct`, `Provider`, `Variable`, `Output`, `Script` |

No primitive name is shared across layers.

---

# DNA Layer Relationships

```mermaid
flowchart LR
    subgraph Layers["DNA — Source of Truth (JSON)"]
        direction TB
        OP["Operational DNA\nNouns · Verbs · Capabilities\nCauses · Rules · Outcomes · Lifecycles · Equations"]
        PROD["Product DNA\nResources · Actions · Operations\nPages · Routes · Endpoints · Schemas"]
        TECH["Technical DNA\nCells · Constructs · Providers\nEnvironments · Variables · Scripts"]
        OP -->|"maps to"| PROD
        PROD -->|"configures"| TECH
    end

    subgraph CellRuntime["Cell Runtime"]
        direction TB
        CELL["Cell\nTypeScript engine"]
        ADAPTER["Adapter\ne.g. node/nestjs · node/express\nruby/rails · react · vue"]
        SUBADAPTER["Sub-adapter\ne.g. drizzle ORM · auth0 · stripe"]
        CELL -->|"dispatches to"| ADAPTER
        ADAPTER -->|"optional plugin"| SUBADAPTER
    end

    TECH -->|"cell definition +\nconstructs + providers"| CELL
    PROD -->|"API or UI DNA"| CELL
    OP -.->|"secondary input\n(e.g. schema generation)"| CELL

    subgraph Artifacts["Output Artifacts"]
        API["REST API"]
        UI["UI App"]
        DB["DB Schema"]
        INFRA["Infrastructure"]
    end

    ADAPTER --> Artifacts
    SUBADAPTER --> Artifacts
```

Operational DNA has no cell — it is validated JSON injected into Product and Technical cells as input.

---

# Cells

A cell is a **TypeScript package** that:
1. Accepts a DNA document (at the appropriate layer) as input
2. Reads an adapter to determine framework/runtime behavior
3. Produces deterministic output: generated code, a running server, or deployed infrastructure

## Cell Types

| Cell | DNA Layer | Input | Output | Status |
|------|-----------|-------|--------|--------|
| `api-cell` | Product → Technical | API Product DNA + adapter config | REST API (NestJS, Express, etc.) | **Built** — `technical/cells/api-cell/` |
| `ui-cell` | Product → Technical | UI Product DNA + adapter config | UI app (React, Vue, etc.) | **Built** — `technical/cells/ui-cell/` |
| `db-cell` | Technical | Construct config (infra-only — no application schema) | Database provisioning (Docker, roles, permissions) | **Built** — `technical/cells/db-cell/` |
| `workflow-cell` | Technical | Causes, Lifecycles, Outcomes, Constructs | Event-driven workflows | Planned |

### `api-cell` adapters

The `api-cell` supports two `node/` adapters that produce the same API surface from the same DNA:

| Adapter | Approach | Port | Output |
|---------|----------|------|--------|
| `node/nestjs` | Static code generation — typed controllers, services, DTOs | 3000 | `output/lending-api-nestjs/` |
| `node/express` | Dynamic runtime interpreter — reads DNA at startup, hot-reloads on DNA file changes | 3001 | `output/lending-api/` |

Both expose identical Swagger UI (`/api`), Redoc (`/docs`), and raw OpenAPI JSON (`/api-json`).

The Express adapter watches `src/dna/api.json` and `src/dna/operational.json` at runtime. When either file changes, routes and the OpenAPI spec are rebuilt in-process — no restart needed. Edit the DNA, the API updates immediately.

**Dual-mode storage**: The Express adapter supports both in-memory and PostgreSQL (Drizzle ORM) storage. Without `DATABASE_URL`, it runs with in-memory Maps seeded from Operational DNA examples. With `DATABASE_URL`, it connects to Postgres, runs migrations on startup, and seeds from DNA.

**Authentication and authorization**: Both adapters generate IDP-agnostic JWT verification using JWKS (JSON Web Key Sets). The auth middleware:

1. Fetches and caches public keys from `https://{domain}/.well-known/jwks.json`
2. Verifies JWT signatures (RS256), audience, and issuer claims
3. Enforces role-based access from Operational DNA Rules (type: `access`)
4. Flags ownership-required operations for handler-level enforcement

Auth config comes from the Technical DNA `auth` provider — `domain`, `audience`, and `roleClaim`. Swapping IDPs (Auth0, Clerk, Okta, Keycloak, Cognito) is a DNA-only change:

```json
{
  "name": "auth0",
  "type": "auth",
  "config": {
    "domain": "acme.auth0.com",
    "audience": "https://api.acme.finance",
    "roleClaim": "https://acme.finance/roles"
  }
}
```

#### Generate and run

```bash
# Generate both outputs from DNA
npm run generate:lending          # Express → output/lending-api/
npm run generate:lending-nestjs   # NestJS  → output/lending-api-nestjs/

# Install deps (first time or after regeneration)
npm install --prefix output/lending-api
npm install --prefix output/lending-api-nestjs

# Run side-by-side (in separate terminals)
npm run start:nestjs    # http://localhost:3000/api
npm run start:express   # http://localhost:3001/api
```

#### Using Postgres (via db-cell)

The `db-cell` provisions the database + app role. The `api-cell` owns migrations, seeds, and queries via drizzle, connecting as the app role.

```bash
# 1. Generate and start the database (provisioning only — no app tables yet)
npx cba develop lending --cell db-cell
cd output/lending-db
docker compose up -d         # Postgres on port 5433, creates lending DB + lending_app role

# 2. Generate drizzle migrations from api-cell's schema, apply, and seed
cd ../lending-api
npm install
npm run db:generate          # Generate drizzle migration SQL from DNA-derived schema
DATABASE_URL=postgresql://lending_app:lending_app@localhost:5433/lending npm run db:migrate
DATABASE_URL=postgresql://lending_app:lending_app@localhost:5433/lending npm run db:seed

# 3. Run the API against Postgres
DATABASE_URL=postgresql://lending_app:lending_app@localhost:5433/lending npm run start:dev
# Starts with [store] using postgres — data persists across restarts
```

Or — use `cba deliver` to run the whole stack as one compose file (see Delivery section below). In that flow, db-cell's init.sql is mounted into the postgres service and api-cell's migrations run automatically on startup.

### `ui-cell` adapter

| Adapter | Approach | Port | Output |
|---------|----------|------|--------|
| `vite/react` | DNA-driven React app — loads UI, API, and Operational DNA at runtime | 5173 | `output/lending-ui/` |

The UI renderer fetches all three DNA layers at startup through a `DnaLoader` abstraction (currently `StaticFetchLoader`; designed for future API/SSE delivery). Blocks use their `operation` field to resolve API endpoints from the Product API DNA and the `useApi` hook handles data fetching, form submission, and action dispatch.

#### Generate and run

```bash
# Generate UI from DNA
cd technical/cells/ui-cell && npx ts-node -r tsconfig-paths/register src/index.ts \
  ../../../dna/lending/technical.json ui-cell ../../../output/lending-ui

# Install deps and run (requires Express API on port 3001)
npm install --prefix output/lending-ui
cd output/lending-ui && npx vite    # http://localhost:5173
```

---

### `db-cell` adapter

| Adapter | Approach | Output |
|---------|----------|--------|
| `postgres` | Generates Docker Compose + init SQL (DB, roles, permissions) | `output/lending-db/` |

The `db-cell` is **infrastructure-only** — it provisions the database itself: the Postgres instance, the application role, and permissions. It does *not* own application tables. Schema migrations, seeds, and queries are owned by `api-cell` via drizzle, connecting as the app role created by db-cell.

This keeps superuser operations (role creation, grants) separate from application-level schema evolution, and lets multiple consumers share a single db-cell-provisioned database.

```json
{
  "name": "db-cell",
  "dna": "lending/operational",
  "adapter": {
    "type": "postgres",
    "config": {
      "construct": "primary-db",
      "database": "lending",
      "app_role": "lending_app"
    }
  }
}
```

## Cell Interface Contract

- **Input**: a DNA document conforming to the relevant layer's JSON schema
- **Adapter**: embedded in the Cell's Technical DNA — framework/runtime that interprets the DNA
- **Sub-adapters**: optional plugins inside an adapter's `config` (e.g. ORM, auth library, test framework)
- **Output**: deterministic, reproducible artifacts (code, schema, running process)

---

# The `cba` CLI

`cba` is the unified CLI for the cell-based architecture lifecycle, modeled on a four-phase flow — **Discover, Design, Develop, Deliver**. It ships as the `@cell/cba` workspace package and is the primary interface for both humans and agents operating on DNA and cells.

```bash
npx cba --help                                      # root help
npx cba help design                                 # per-phase help
npx cba domains                                     # list domains under dna/
```

## The lifecycle

| Phase | Command | What it does |
|-------|---------|--------------|
| **Discover** | `cba discover <domain>` | Launches or resumes an agent-driven conversation → proposes DNA. Outputs land in `.cba/sessions/` and `.cba/drafts/`. |
| **Design** | `cba design <layer> <cmd> <domain>` | Authors DNA: `list`, `show`, `add`, `remove`, `schema`, `validate`. Scoped per-layer. |
| **Develop** | `cba develop <domain> [--cell X]` | Reads technical DNA, invokes each declared cell's generator. |
| **Deliver** | `cba deliver <domain> --env <env> [--adapter X]` | Composes generated cells into a deployable topology via a delivery adapter (default: `docker-compose`). |

Plus utilities: `cba run <domain> --adapter <x>` (start generated output), `cba validate <domain>` (all-layer + cross-layer validation).

## Examples

```bash
# Inspect DNA
npx cba design operational list lending
npx cba design operational show lending --type Noun --name Loan
npx cba design operational schema Noun              # prints JSON schema

# Mutate DNA
npx cba design technical add lending --type Variable --file new-var.json
npx cba design operational add lending --type Noun \
  --at acme.finance.lending --file loan.json
npx cba design operational add lending --type Verb \
  --at acme.finance.lending:Loan --file approve.json
npx cba design technical remove lending --type Variable --name OLD_FLAG

# Generate + run
npx cba develop lending --dry-run                   # preview all cells
npx cba develop lending --cell api-cell             # run one cell
npx cba run lending --adapter express               # start generated API

# Deliver — compose generated cells into a deployable topology
npx cba deliver lending --env dev --plan            # preview services + skipped constructs
npx cba deliver lending --env dev                   # writes output/lending-deploy/docker-compose.yml
cd output/lending-deploy && docker compose up -d    # run the full stack locally

# Validate
npx cba validate lending                            # all layers
npx cba validate lending --json                     # structured JSON errors
```

## For agents

Every command supports `--json` for machine-parseable output. An agent's typical loop during discovery:

1. `cba design operational list lending --json` — ground itself in existing DNA
2. `cba design operational schema Noun --json` — learn the primitive shape
3. `cba design operational add lending --type Noun --at … --file draft.json --json` — draft
4. `cba validate lending --json` — catch cross-layer errors, loop back to conversation
5. `cba develop lending --dry-run --json` — show stakeholder the diff
6. `cba develop lending` — ship it

See `packages/cba/README.md` for full command reference and flags.

---

# Delivery

`cba deliver` reads Technical DNA for a target Environment and composes the generated cell artifacts into a deployable topology via a **delivery adapter**. Infrastructure is not a cell — it's configuration consumed by the delivery step.

| Adapter | Status | Output |
|---------|--------|--------|
| `docker-compose` | **Built** | `output/<domain>-deploy/docker-compose.yml` — multi-service local stack |
| `terraform/aws` | Planned | AWS IaC from Constructs + Providers |
| `aws-sam` | Planned | AWS serverless deployment for function-category Constructs |

## `docker-compose` adapter

Composes the full lending stack (Postgres, Redis, Express API, NestJS API, Vite UI) into one compose file, wiring environment variables from Technical DNA:

- Storage `Construct`s → first-class compose services (`primary-db`, `session-cache`)
- `Cell`s with `node/*` or `vite/*` adapters → services built from each cell's output dir
- `secret`-sourced variables → dev defaults that reference other compose services (e.g. `DATABASE_URL=postgresql://postgres:postgres@primary-db:5432/lending`)
- `output`-sourced variables → resolved to internal service URLs (e.g. `api-cell.api_url` → `http://api:3001`)
- External providers (`auth0`, etc.) and network Constructs are skipped — reported under `skipped` in the delivery result

```bash
npx cba develop lending                      # generate all cells first
npx cba deliver lending --env dev --plan     # preview
npx cba deliver lending --env dev            # write output/lending-deploy/
cd output/lending-deploy
docker compose up -d                         # run the full stack
```

Delivery is **not regenerative** — it fails loudly if cell artifacts are missing, telling you to run `cba develop` first.

---

# Implementation Stack

- **Description language**: JSON (all three DNA layers)
- **Engines/cells**: TypeScript packages
- **Frontend cells**: target React, Vue, Next.js (via adapter)
- **Backend cells**: target Rails, Django, NestJS, etc. (via adapter)

---

# Repository Structure

```
cell-based-architecture/
  dna/                              # DNA documents organized by application instance
    lending/
      operational.json              # Full Operational DNA: domain, nouns, capabilities, causes, rules, outcomes, lifecycles
      product.api.json              # Product API DNA: namespace, resources, operations, endpoints
      product.ui.json               # Product UI DNA: layout, pages, routes, blocks
      technical.json                # Technical DNA: providers, constructs, variables, cells, environments
  operational/
    schemas/                        # JSON schemas for Operational primitives
  product/
    schemas/                        # JSON schemas for Product primitives
  technical/
    schemas/                        # JSON schemas for Technical primitives
    cells/
      api-cell/                     # Consumes Product API DNA → containerized REST API
        src/
          adapters/
            node/                   # Shared Node.js adapter utilities (Dockerfile, .dockerignore)
              nestjs/               # NestJS adapter: controllers, services, modules, DTOs, Drizzle schema
              express/              # Express adapter: dynamic runtime interpreter, reads DNA at startup
              shared/               # Shared Drizzle schema generation
          run.ts                    # Core orchestrator: loads DNA, validates, dispatches to adapter
          index.ts                  # CLI entry point
      db-cell/                      # Consumes Operational DNA → database provisioning
        src/
          adapters/
            postgres/               # Postgres adapter: Docker, init SQL, schema, migrations, seed
      ui-cell/                      # Consumes Product UI DNA → UI app (scaffolded)
      workflow-cell/                # (planned) Consumes Technical DNA → event workflows
  packages/                         # Shared utilities across all layers
    cba/                            # Unified CLI for the full lifecycle (discover, design, develop, deliver)
    dna-validator/                  # Validates DNA documents against JSON schemas
```

# Key Principles

- **Operational DNA has no cell.** It is validated JSON injected into Product and Technical cells as input — it is the source, not a target.
- **Primitives are unique across layers.** No primitive name is reused across Operational, Product, or Technical layers.
- **Constructs are declared once, referenced by many.** A database Construct can be shared across multiple cells without duplication.
- **Adapters bridge DNA and frameworks.** The cell engine is generic; the adapter carries all framework-specific knowledge.
- **DNA is the source of truth at every layer.** Cells must not encode domain, product, or framework logic beyond what is needed to interpret their layer's DNA.
- **JSON in, infrastructure out.** The full path from business concept to deployed software is driven by JSON documents and TypeScript engines.

---

# Roadmap

See [ROADMAP.md](ROADMAP.md) for the full implementation plan — from the current proof-of-concept through multi-adapter expansion, new cells, tooling, and production readiness.
