# Cell-based Architecture

Cell-based architecture is a philosophy for building applications by injecting **DNA** into **cells** — TypeScript engines that read DNA and produce working software (API endpoints, UIs, database schemas, etc.).

- **DNA** — a JSON description language expressing a business domain across three layers (Operational, Product, Technical). Defined and documented in the [DNA repo](https://github.com/upgrade-solutions/dna).
- **Cell** — a TypeScript package/engine that accepts one layer of DNA as input and produces code or deployable infrastructure.

The relationship: DNA describes *what* the business is and does; cells decide *how* to implement it.

## Packages in this repo

| Package | What it is | Where |
|---------|-----------|-------|
| `@cell/cba` | Unified CLI for the full cell-based-architecture lifecycle | [`packages/cba/`](./packages/cba/) |
| `@cell/cba-viz` | Interactive architecture viewer (Vite + React + JointJS) | [`packages/cba-viz/`](./packages/cba-viz/) |
| `@cell/{api,ui,db,event-bus}-cell` | Cells that consume DNA and produce code or infra | [`technical/cells/`](./technical/cells/) |

DNA packages (`@dna-codes/core`, `@dna-codes/schemas`) live in the [DNA repo](https://github.com/upgrade-solutions/dna). See its README for schemas, TypeScript bindings, and layer docs.

---

# DNA — The Three Layers

DNA documents are defined and described in the [DNA repo](https://github.com/upgrade-solutions/dna). The three layers are:

| Layer | What it captures | DNA repo doc |
|-------|------------------|--------------|
| **Operational** | What the business does — Nouns, Capabilities, Rules, Outcomes, SOPs | [`docs/operational.md`](https://github.com/upgrade-solutions/dna/blob/main/docs/operational.md) |
| **Product** | What gets built — Resources, Endpoints, Pages, Blocks | [`docs/product.md`](https://github.com/upgrade-solutions/dna/blob/main/docs/product.md) |
| **Technical** | How it gets built — Cells, Constructs, Providers, Environments | [`docs/technical.md`](https://github.com/upgrade-solutions/dna/blob/main/docs/technical.md) |

Layers flow one-way downstream — Operational → Product → Technical — with upper layers never depending on lower ones.

## How DNA flows into cells

```mermaid
flowchart LR
    subgraph DNA["DNA — Source of Truth (JSON)"]
        direction TB
        OP["Operational DNA"]
        PROD["Product DNA"]
        TECH["Technical DNA"]
        OP -->|"maps to"| PROD
        PROD -->|"configures"| TECH
    end

    subgraph CellRuntime["Cell Runtime"]
        direction TB
        CELL["Cell\nTypeScript engine"]
        ADAPTER["Adapter\ne.g. node/nestjs · ruby/rails · react · vue"]
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
| `db-cell` | Technical | Construct config (infra-only) | Database provisioning (Docker, roles, permissions) | **Built** — `technical/cells/db-cell/` |
| `event-bus-cell` | Operational → Technical | Signals across all domains + queue Construct config | Schema registry, typed publisher libs, routing config, worker stubs | **Built** — `technical/cells/event-bus-cell/` |
| `workflow-cell` | Technical | Causes, Processes, Outcomes, Constructs | Event-driven workflows | Planned |

## Cell Interface Contract

- **Input**: a DNA document conforming to the relevant layer's JSON schema
- **Adapter**: embedded in the Cell's Technical DNA — framework/runtime that interprets the DNA
- **Sub-adapters**: optional plugins inside an adapter's `config` (e.g. ORM, auth library, test framework)
- **Output**: deterministic, reproducible artifacts (code, schema, running process)

---

## `api-cell` adapters

The `api-cell` supports multiple adapters that produce the same API surface from the same DNA:

| Adapter | Approach | Port | Output |
|---------|----------|------|--------|
| `node/nestjs` | Static code generation — typed controllers, services, DTOs | 3000 | `output/lending-api-nestjs/` |
| `node/express` | Dynamic runtime interpreter — reads DNA at startup, hot-reloads on DNA file changes | 3001 | `output/lending-api/` |
| `ruby/rails` | Static code generation — Rails API-mode app with controllers, models, migrations | 3000 | `output/lending-api-rails/` |
| `python/fastapi` | Static code generation — FastAPI app with Pydantic schemas, SQLAlchemy models, APIRouters | 8000 | `output/lending-api-fastapi/` |

The Node adapters expose identical Swagger UI (`/api`), Redoc (`/docs`), and raw OpenAPI JSON (`/api-json`).

The Express adapter watches `src/dna/api.json` and `src/dna/operational.json` at runtime. When either file changes, routes and the OpenAPI spec are rebuilt in-process — no restart needed.

**Signal middleware**: The Express adapter generates signal emission middleware driven by Operational DNA. For each route whose Outcome declares `emits`, the middleware intercepts the response and publishes typed signals to RabbitMQ (via amqplib) using a `signals` topic exchange. Routes with no `emits` get a zero-overhead pass-through. The middleware chain per route is: `auth → requestValidator → ruleValidator → signalMiddleware → handler`.

**Signal dispatch (Pattern A — HTTP push)**: After publishing to the event bus, the signal middleware also HTTP POSTs each signal to configured subscriber API URLs. Subscriber URLs are configured in Technical DNA under the cell's adapter config as `signal_dispatch` — a mapping of Signal names to arrays of subscriber base URLs. The middleware constructs `POST {baseUrl}/_signals/{signalName}` requests with the typed payload.

**Signal receiver**: The Express adapter generates `POST /_signals/:signalName` endpoints for each Cause with `source: "signal"` in Operational DNA. Incoming signals are validated against the Signal definition's payload contract, then dispatched to the target Capability's handler.

```
Publisher API (Domain A)                    Subscriber API (Domain B)
────────────────────────                    ────────────────────────
POST /loans/:id/disburse
  → handler succeeds (200)
  → signal middleware fires
  → publishes to event bus
  → HTTP POST ──────────────────────────→   POST /_signals/lending.Loan.Disbursed
                                              → validates payload
                                              → dispatches to PaymentSchedule.Create
```

Signal dispatch config in Technical DNA:

```json
{
  "name": "api-cell",
  "adapter": {
    "config": {
      "signal_dispatch": {
        "lending.Loan.Disbursed": ["http://payments-api:3002"],
        "lending.Loan.Defaulted": ["http://collections-api:3003"]
      }
    }
  }
}
```

Pattern B (queue + worker) is planned — same handler contract, different transport. See [ROADMAP.md](ROADMAP.md) Phase 3e.

**Dual-mode storage**: The Express adapter supports both in-memory and PostgreSQL (Drizzle ORM) storage. Without `DATABASE_URL`, it runs with in-memory Maps seeded from Operational DNA examples. With `DATABASE_URL`, it connects to Postgres, runs migrations on startup, and seeds from DNA.

**Authentication and authorization**: The api-cell supports two auth modes, selected via the Technical DNA `auth` provider:

**Built-in JWT** (`provider: "built-in"`) — the API issues its own HS256 tokens via `/auth/login`. The admin UI renders a login gate and attaches Bearer tokens to all API calls. Best for demos and development.

```json
{ "name": "built-in", "type": "auth", "config": { "provider": "built-in" } }
```

Demo credentials: `admin@marshall.demo` / `demo123` (roles: admin), `staff@marshall.demo` / `demo123` (roles: intake_staff), `attorney@marshall.demo` / `demo123` (roles: attorney).

**External OIDC** (Auth0, Clerk, Okta, etc.) — JWKS-based RS256 verification against an external IDP:

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

Both modes share the same middleware pipeline:
1. Verify JWT (HS256 for built-in, RS256 via JWKS for OIDC)
2. Enforce role-based access from Operational DNA Rules (type: `access`)
3. Flag ownership-required operations for handler-level enforcement

### Generate and run

```bash
# Generate outputs from DNA
npm run generate:lending          # Express → output/lending-api/
npm run generate:lending-nestjs   # NestJS  → output/lending-api-nestjs/

# Install deps (first time or after regeneration)
npm install --prefix output/lending-api
npm install --prefix output/lending-api-nestjs

# Run side-by-side (in separate terminals)
npm run start:nestjs    # http://localhost:3000/api
npm run start:express   # http://localhost:3001/api
```

### Rails adapter

```bash
cba develop lending --cell api-cell-rails

cd output/lending-api-rails
bundle install
bin/rails db:create db:migrate db:seed
bin/rails server
```

Generated structure:
- **Controllers** — one per resource with role-based `authorize_roles!` and DNA Outcome effects applied inline
- **Models** — one per Operational DNA Noun with validations (presence, enum inclusion)
- **Migration** — single migration creating all tables from Noun attributes, UUID primary keys
- **Auth** — `ApplicationController` with JWKS-based JWT verification (IDP-agnostic)
- **Routes** — explicit route declarations matching every DNA endpoint
- **Dockerfile** — multi-stage Ruby 3.3 build with Puma

### FastAPI adapter

```bash
cba develop lending --cell api-cell-fastapi

cd output/lending-api-fastapi
pip install -r requirements.txt
uvicorn app.main:app --reload    # http://localhost:8000/docs
```

Generated structure:
- **Routers** — one per resource with FastAPI dependency injection for auth and DB sessions
- **Models** — SQLAlchemy 2.0 declarative models (one per Operational DNA Noun)
- **Schemas** — Pydantic v2 request/response models
- **Auth** — JWKS-based JWT verification via `python-jose`
- **Alembic** — migration configuration wired to the SQLAlchemy models
- **Dockerfile** — multi-stage Python 3.12 build with uvicorn

### Using Postgres (via db-cell)

The `db-cell` provisions the database + app role. The `api-cell` owns migrations, seeds, and queries via drizzle, connecting as the app role.

```bash
# 1. Generate and start the database
npx cba develop lending --cell db-cell
cd output/lending-db
docker compose up -d         # Postgres on port 5433, creates lending DB + lending_app role

# 2. Generate drizzle migrations, apply, and seed
cd ../lending-api
npm install
npm run db:generate
DATABASE_URL=postgresql://lending_app:lending_app@localhost:5433/lending npm run db:migrate
DATABASE_URL=postgresql://lending_app:lending_app@localhost:5433/lending npm run db:seed

# 3. Run the API against Postgres
DATABASE_URL=postgresql://lending_app:lending_app@localhost:5433/lending npm run start:dev
```

Or — use `cba deploy` to run the whole stack as one compose file (see Deployment section below).

---

## `ui-cell` adapters

| Adapter | Approach | Port | Output |
|---------|----------|------|--------|
| `vite/react` | DNA-driven React SPA — React Router, React Context, hooks | 5173 | `output/lending-ui/` |
| `vite/vue` | DNA-driven Vue 3 app — Vue Router, provide/inject, Composition API | 5174 | `output/lending-vue-ui/` |
| `next/react` | DNA-driven Next.js App Router app — client-side DNA loading with SSR-ready structure | 5175 | `output/lending-ui-next/` |

All adapters fetch all three DNA layers at startup through a `DnaLoader` abstraction (currently `StaticFetchLoader`; designed for future API/SSE delivery). Blocks use their `operation` field to resolve API endpoints from Product API DNA.

### Layout system

Layouts are DNA-driven structural shells that wrap pages. The layout `type` in Product UI DNA selects which shell the adapter generates:

| Layout Type | Description |
|-------------|-------------|
| `universal` | Production-ready app shell — collapsible sidebar, user profile dropdown, tenant picker, theme toggle. State managed by XState v5 |
| `marketing` | Public-site shell — sticky header, hero on root route only, footer. Pairs with `survey` blocks for public intake forms |
| `sidebar` | Simple fixed sidebar with nav links and theme toggle |
| `full-width` | Horizontal header nav with centered content area |
| `split-panel` | (planned) |
| `centered` | (planned) |
| `blank` | (planned) |

The **marketing layout** is for public-facing sites (landing pages, intake funnels, lead capture). It reads `layout.brand`, `layout.hero`, and `layout.footer` from `product.ui.json`. Theme tokens flow into both Tailwind utility classes and SurveyJS CSS variables. See `dna/torts/marshall/` for a working example.

### Survey blocks (SurveyJS)

`block.type: "survey"` scaffolds `survey-core` + `survey-react-ui` and emits a `SurveyBlock.tsx` that builds the SurveyJS model directly from `block.fields`. Falls into **mock-submit mode** when `apiBase` is empty (preview-only deployments).

The **universal layout** is the recommended default — built on **Radix UI** + **Tailwind CSS v4** with a DNA-driven white-label theme system. Layout configuration in DNA:

```json
{
  "layout": {
    "name": "LendingDashboard",
    "type": "universal",
    "features": {
      "sidebar": true,
      "profileDropdown": true,
      "tenantPicker": true,
      "themeToggle": true
    },
    "navigation": [
      {
        "label": "Loans",
        "children": [
          { "route": "/loans", "label": "All Loans" },
          { "route": "/loans/apply", "label": "Apply" }
        ]
      }
    ],
    "theme": {
      "colors": {
        "background": "#ffffff",
        "foreground": "#0a0a0a",
        "primary": "#171717",
        "primary-foreground": "#fafafa"
      },
      "radius": "0.5rem",
      "font": "system-ui, sans-serif"
    }
  }
}
```

### Generate and run

```bash
npx cba develop lending --cell ui-cell         # React
npx cba develop lending --cell vue-ui-cell     # Vue
npx cba develop lending --cell ui-cell-next    # Next.js

npm install --prefix output/lending-ui
cd output/lending-ui && npx vite               # http://localhost:5173
```

### Next.js adapter

Key differences from the Vite adapter:
- **App Router** file-system routing via `src/app/` with a `[...slug]` catch-all
- **`useRouteParams()`** custom hook matches pathname against DNA route patterns
- **Standalone Docker output** using `output: 'standalone'`
- **API rewrites** proxy `/api/:path*` to the Express API in dev

---

## `db-cell` adapter

| Adapter | Approach | Output |
|---------|----------|--------|
| `postgres` | Generates Docker Compose + init SQL (DB, roles, permissions) | `output/lending-db/` |

The `db-cell` is **infrastructure-only** — it provisions the Postgres instance, the application role, and permissions. Schema migrations, seeds, and queries are owned by `api-cell` via drizzle, connecting as the app role created by db-cell.

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

---

## `event-bus-cell`

The `event-bus-cell` reads Operational DNA Signals across all domains and generates event infrastructure code. The `engine` config in technical.json selects the transport: `rabbitmq` (amqplib) or `eventbridge` (AWS SDK).

**What it generates:**

| Artifact | Description |
|----------|-------------|
| Schema registry | Compiled catalog of all Signals with typed payloads |
| Publisher libraries | Typed functions per domain, per adapter language |
| Routing config | Maps each Signal to subscribing Capabilities and their queues |
| Worker stubs | Skeleton consumer code for api-cells or future worker-cells |

**Signal → Cause flow:**

```json
// Lending domain — Outcome emits a Signal
{
  "capability": "Loan.Disburse",
  "emits": ["lending.Loan.Disbursed"]
}

// Payments domain — Cause subscribes to the Signal
{
  "capability": "PaymentSchedule.Create",
  "source": "signal",
  "signal": "lending.Loan.Disbursed"
}
```

**Multi-stack platform model:**

A platform directory (e.g. `dna/lending/`) hosts multiple domain stacks — each with its own api-cell, ui-cell, and db-cell — declared in the same `technical.json` alongside a shared event-bus-cell.

See [ROADMAP.md](ROADMAP.md) Phase 3a–3c and Phase 6 for the implementation plan.

---

# `cba-viz` — Interactive Architecture Viewer

The `cba-viz` package (`packages/cba-viz/`) is a standalone Vite + React application that renders Architecture DNA as interactive JointJS diagrams.

```bash
cd packages/cba-viz
npm run dev                                # http://localhost:5174
```

Open the viewer for a specific domain via URL params:

```
http://localhost:5175/?domain=torts/marshall&phase=run&sub=deployment&env=prod
```

| Param | Default | Description |
|-------|---------|-------------|
| `domain` | `lending` | DNA domain path (supports nested paths like `torts/marshall`) |
| `phase` | `build` | Lifecycle phase: `build` (authoring) or `run` (runtime observation) |
| `sub` | `operational` | Sub-tab within the phase. Build: `operational`, `product`, `technical`, `cross-layer`, `guide`. Run: `deployment`, `logs*`, `metrics*`, `access*` (* = stub) |
| `cap` | _(none)_ | Selected capability for `sub=cross-layer`, as `Noun.Verb` |
| `env` | `dev` | Environment for technical overlay |
| `adapter` | `docker-compose` | Technical status probe adapter |

**Data flow:** cba-viz calls `GET /api/load-views/:domain?env=<env>`, which the vite middleware proxies by shelling out to `cba views <domain> --env <env> --json`. Adding a cell/construct/provider to `technical.json` makes it appear automatically.

**Features:**
- **Build / Run lifecycle nav** — `Build` groups authoring surfaces (Operational, Product, Technical, Cross-layer, Guide); `Run` groups runtime observation (Deployment + stubs for Logs, Metrics, Access)
- **Discovery workspace (Guide tab)** — 3-phase pipeline: **Discover** (tag text fragments as DNA primitives), **Define** (browse and refine Operational DNA), **Design** (auto-generates SOP docs, process flow DAGs, and Product DNA summary)
- **Cross-layer view** — single-capability lens spanning Operational → Product API → Product UI
- **Multi-layer editing** — per-layer canvas with shape palette and save pipeline
- **Schema-driven inspector** — live RJSF form generated from `@dna/core` schemas
- **Write-back** — save positions and edits back to `technical.json` or `operational.json` (Ctrl+S)
- **Live status** — polls the selected adapter every 5 seconds and updates technical node status in real time
- **Terraform/AWS probe** — reads `terraform.tfstate` + queries AWS APIs to map live infrastructure status back to DNA node IDs

**Status rendering:**

| Status | Visual |
|--------|--------|
| `proposed` | Dashed stroke, dim (45% opacity) |
| `planned` | Solid stroke, greyed out (60% opacity) |
| `deployed` | Full color, solid |

**Tech stack:** Vite 7, React 19, JointJS Plus (v4.2), MobX, Tailwind CSS v4.

---

# The `cba` CLI

`cba` is the unified CLI for the cell-based architecture lifecycle, organized around the three DNA layers plus build and deploy. It ships as the `@cell/cba` workspace package.

```bash
npx cba --help                                      # root help
npx cba help operational                             # per-command help
npx cba domains                                     # list domains under dna/
```

## Commands

| Command | What it does |
|---------|--------------|
| `cba operational <cmd> <domain>` | Work with Operational DNA: `discover`, `list`, `show`, `add`, `remove`, `schema`, `validate` |
| `cba product <api\|ui> <cmd> <domain>` | Work with Product DNA (API or UI surface): `list`, `show`, `add`, `remove`, `schema`, `validate` |
| `cba technical <cmd> <domain>` | Work with Technical DNA: `list`, `show`, `add`, `remove`, `schema`, `validate` |
| `cba develop <domain> [--cell X]` | Reads technical DNA, invokes each declared cell's generator |
| `cba deploy <domain> --env <env> [--adapter X]` | Composes generated cells into a deployable topology (default: `docker-compose`) |
| `cba up <domain> --env <env> [--adapter X]` | Full pipeline: `validate` → `develop` → `deploy` → launch the stack |
| `cba down <domain> --env <env> [--adapter X]` | Tear down a deployed stack |
| `cba status <domain> --env <env> [--adapter X]` | Show what's running |

Plus utilities: `cba run <domain> --adapter <x>` (start generated output), `cba validate <domain>` (all-layer + cross-layer validation).

## Examples

```bash
# Inspect DNA
npx cba operational list lending
npx cba operational show lending --type Noun --name Loan
npx cba operational schema Noun                     # prints JSON schema
npx cba product api list lending

# Mutate DNA
npx cba technical add lending --type Variable --file new-var.json
npx cba operational add lending --type Noun \
  --at acme.finance.lending --file loan.json
npx cba technical remove lending --type Variable --name OLD_FLAG

# Discover — agent-driven stakeholder conversation
npx cba operational discover lending
npx cba operational discover lending --from notes.md

# Generate + run
npx cba develop lending --dry-run                   # preview all cells
npx cba develop lending --cell api-cell             # run one cell
npx cba run lending --adapter express               # start generated API

# Deploy
npx cba deploy lending --env dev --plan             # preview
npx cba deploy lending --env dev                    # write compose file
cd output/lending-deploy && docker compose up -d

# Up / Down
npx cba up torts/marshall --env dev --seed --build
npx cba down torts/marshall --env dev
npx cba status torts/marshall --env dev
npx cba up torts/marshall --env prod --adapter terraform/aws --auto-approve

# Validate
npx cba validate lending                            # all layers
npx cba validate lending --json                     # structured JSON errors
```

## For agents

Every command supports `--json` for machine-parseable output. An agent's typical loop during discovery:

1. `cba operational list lending --json` — ground itself in existing DNA
2. `cba operational schema Noun --json` — learn the primitive shape
3. `cba operational add lending --type Noun --at … --file draft.json --json` — draft
4. `cba validate lending --json` — catch cross-layer errors, loop back to conversation
5. `cba develop lending --dry-run --json` — show stakeholder the diff
6. `cba develop lending` — ship it

See [`packages/cba/README.md`](./packages/cba/README.md) for full command reference and flags.

---

# Deployment

`cba deploy` reads Technical DNA for a target Environment and composes the generated cell artifacts into a deployable topology via a **deployment adapter**. Infrastructure is not a cell — it's configuration consumed by the deployment step.

| Adapter | Status | Output |
|---------|--------|--------|
| `docker-compose` | **Built** | `output/<domain>-deploy/docker-compose.yml` |
| `terraform/aws` | **Built** | `output/<domain>-deploy/*.tf` — AWS IaC (VPC, RDS, ECS Fargate, ALB, S3+CloudFront) |
| `aws-sam` | Planned | AWS serverless deployment for function-category Constructs |

## `cba up` / `cba down` / `cba status`

`cba up` chains the whole pipeline:

```
cba up <domain> --env <env>
  │
  ├─ 1. cba validate <domain>
  ├─ 2. cba develop <domain>
  ├─ 3. cba deploy <domain> --env <env>
  └─ 4. adapter.launch
```

**Useful flags:**
- `--seed` — sets `SEED_EXAMPLES=true` so the api-cell pre-loads Product Core DNA examples on startup
- `--build` / `--force-recreate` — pass-through to `docker compose up`
- `--attach` — foreground logs instead of `-d`
- `--plan` — stop after `cba deploy` (step 3)
- `--skip-develop` — reuse already-generated cell artifacts

## `docker-compose` adapter

Composes the full stack into one compose file, wiring environment variables from Technical DNA:

- Storage `Construct`s → first-class compose services
- `Cell`s with `node/*` or `vite/*` adapters → services built from each cell's output dir
- `secret`-sourced variables → dev defaults referencing other compose services
- External providers and network Constructs → skipped

```bash
npx cba develop lending
npx cba deploy lending --env dev --plan
npx cba deploy lending --env dev
cd output/lending-deploy && docker compose up -d
```

## `terraform/aws` adapter

Generates Terraform HCL files that provision AWS infrastructure from Technical DNA:

| DNA Primitive | AWS Resource |
|---------------|-------------|
| storage/database (postgres) | `aws_db_instance` (RDS) |
| storage/cache (redis) | `aws_elasticache_cluster` |
| compute/container | ECS Fargate task definition + service |
| network/gateway | `aws_apigatewayv2_api` |
| Cell (node/\*, ruby/\*, python/\*) | ECR repository + ECS container definition |
| Cell (vite/\*) | S3 bucket + CloudFront distribution |
| Variable (secret) | Secrets Manager secret |

```bash
npx cba up torts/marshall --env prod --adapter terraform/aws --auto-approve
```

**Safety rails:** `--adapter terraform/aws` without `--auto-approve` stops after `terraform plan`. `cba down … --adapter terraform/aws` always requires `--auto-approve`.

---

# Validation

Validation is handled by `@dna/validator` (see [DNA repo](https://github.com/upgrade-solutions/dna)). The `cba validate` command wraps it for the full lifecycle:

```bash
npx cba validate lending --layer operational   # validate one layer
npx cba validate lending                       # validate all layers + cross-layer
npx cba validate lending --json                # structured JSON errors
```

## Cross-layer reference validation

| Source | Target | What's checked |
|--------|--------|---------------|
| Product API `Resource.noun` | Operational `Noun` | Resource references an existing Noun |
| Product API `Action.verb` | Operational `Verb` | Action verb exists on the corresponding Noun |
| Product API `Operation.capability` | Operational `Capability` | Operation capability exists |
| Product API `Endpoint.operation` | Product API `Operation` | Endpoint references a defined Operation |
| Product UI `Page.resource` | Product API `Resource` | Page references an existing Resource |
| Product UI `Block.operation` | Product API `Operation` | Block references an existing Operation |
| Product UI `Route.page` | Product UI `Page` | Route references a defined Page |
| Technical `Construct.provider` | Technical `Provider` | Construct references an existing Provider |
| Technical `Cell.constructs[]` | Technical `Construct` | Cell construct references exist |

Programmatic access:

```typescript
import { DnaValidator } from '@dna/validator'

const validator = new DnaValidator()
const result = validator.validateCrossLayer({ operational, productApi, productUi, technical })
// result.errors: Array<{ layer, path, message }>
```

---

# Testing

All packages include Jest test suites. Run the full workspace:

```bash
npm test                    # runs all workspace tests
```

| Package | Tests | Coverage |
|---------|-------|----------|
| `@dna/validator` | 42 | Per-schema validation, composite documents, cross-layer validation |
| `@cell/api-cell` | 68 | NestJS generators, Express integration, NestJS integration, **adapter conformance** (10 tests) |
| `@cell/ui-cell` | 14 | **Adapter conformance** (14 tests) |

## Adapter conformance tests

Conformance tests verify that all adapters for a given cell produce the same external surface from the same DNA input.

**API-cell**: Generates all 3 adapters (NestJS, Express, Rails) and asserts they agree on HTTP method + path pairs, operation mappings, request body fields, role-based access enforcement, and Dockerfiles.

**UI-cell**: Generates all 3 adapters (Vite/React, Vite/Vue, Next/React) and asserts identical bundled DNA, same block types, consistent `config.json` DNA fetch paths, and Dockerfiles.

---

# Repository Structure

```
cell-based-architecture/
  dna/                              # DNA documents organized by application instance
    lending/
      operational.json
      product.api.json
      product.ui.json
      technical.json
    torts/marshall/
      operational.json
      product.core.json
      product.api.json
      product.ui.json
      product.admin.ui.json
      technical.json
      prompt.md
  technical/
    cells/
      api-cell/                     # Consumes Product API DNA → containerized REST API
      db-cell/                      # Consumes Operational DNA → database provisioning
      ui-cell/                      # Consumes Product UI DNA → UI app
      event-bus-cell/               # Consumes Signals → schema registry, publishers, routing
      workflow-cell/                # (planned)
  packages/
    cba/                            # Unified CLI for the full lifecycle
    cba-viz/                        # Interactive architecture viewer (Vite + React + JointJS)
```

---

# Key Principles

- **Operational DNA has no cell.** It is validated JSON injected into Product and Technical cells as input — it is the source, not a target.
- **Primitives are unique across layers.** No primitive name is reused across Operational, Product, or Technical layers.
- **Constructs are declared once, referenced by many.** A database Construct can be shared across multiple cells without duplication.
- **Adapters bridge DNA and frameworks.** The cell engine is generic; the adapter carries all framework-specific knowledge.
- **DNA is the source of truth at every layer.** Cells must not encode domain, product, or framework logic beyond what is needed to interpret their layer's DNA.
- **JSON in, infrastructure out.** The full path from business concept to deployed software is driven by JSON documents and TypeScript engines.
- **Signals are the cross-domain contract.** Domains communicate asynchronously via Signals — named events with typed payloads. Two delivery patterns: **Pattern A (HTTP push)** — publisher dispatches directly to subscriber's `/_signals/:signalName` endpoint; **Pattern B (queue + worker)** — event bus routes to a queue, a worker process consumes and dispatches.
- **Infrastructure is not a cell.** Deployment is a `cba deliver` concern with delivery adapters (docker-compose, terraform/aws, aws-sam), not a cell type.

---

# Roadmap

See [ROADMAP.md](ROADMAP.md) for the full implementation plan.
