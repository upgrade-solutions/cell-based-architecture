# Cell-based Architecture

Cell-based architecture is a philosophy for building applications by injecting **DNA** into **cells** — TypeScript engines that read DNA and produce working software (API endpoints, UIs, database schemas, etc.).

- **DNA** — a JSON description language expressing a business domain across three layers (Operational, Product, Technical). Defined, schemafied, and validated by the [DNA repo](https://github.com/upgrade-solutions/dna), shipped on npm as `@dna-codes/core` + `@dna-codes/schemas`. CBA defers entirely to those packages — it does not ship its own copy of DNA primitives, schemas, or the validator.
- **Cell** — a TypeScript package/engine that accepts one layer of DNA as input and produces code or deployable infrastructure.

The relationship: DNA describes *what* the business is and does; cells decide *how* to implement it.

## Packages in this repo

| Package | What it is | Where |
|---------|-----------|-------|
| `@cell/cba` | Unified CLI for the full cell-based-architecture lifecycle | [`packages/cba/`](./packages/cba/) |
| `@cell/cba-viz` | Interactive architecture viewer (Vite + React + JointJS) | [`packages/cba-viz/`](./packages/cba-viz/) |
| `@cell/{api,ui,db}-cell` | Cells that consume DNA and produce code or infra | [`technical/cells/`](./technical/cells/) |

DNA packages (`@dna-codes/core`, `@dna-codes/schemas`) live in the [DNA repo](https://github.com/upgrade-solutions/dna) and are pulled in from npm. See that README for schemas, TypeScript bindings, and layer docs.

---

# DNA — The Three Layers

DNA documents are defined and described in the [DNA repo](https://github.com/upgrade-solutions/dna). The three layers are:

| Layer | What it captures | DNA repo doc |
|-------|------------------|--------------|
| **Operational** | What the business does — Resources/Persons/Roles/Groups + Memberships, Operations, Triggers, Rules, Tasks, Processes | [`docs/operational.md`](https://github.com/upgrade-solutions/dna/blob/main/docs/operational.md) |
| **Product** | What gets built — three sub-layers: core (Resources, Operations, Fields, Actions), api (Endpoints, Schemas, Namespaces), ui (Pages, Routes, Blocks, Layouts) | [`docs/product.md`](https://github.com/upgrade-solutions/dna/blob/main/docs/product.md) |
| **Technical** | How it gets built — Cells, Constructs, Providers, Environments, Variables, Views | [`docs/technical.md`](https://github.com/upgrade-solutions/dna/blob/main/docs/technical.md) |

Layers flow one-way downstream — Operational → Product → Technical — with upper layers never depending on lower ones.

## How DNA flows into cells

<img width="2816" height="1536" alt="Gemini_Generated_Image_rfxxq4rfxxq4rfxx" src="https://github.com/user-attachments/assets/3d38e3d8-39b6-4850-9a0b-f15a34062e5a" />

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
| `workflow-cell` | Technical | Triggers, Processes, Operations, Constructs | Event-driven workflows | Planned |

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
| `node/nestjs` | Static code generation — typed controllers, services, DTOs | 3000 | `output/lending/<env>/api-nestjs/` |
| `node/express` | Dynamic runtime interpreter — reads DNA at startup, hot-reloads on DNA file changes | 3001 | `output/lending/<env>/api/` |
| `node/fastify` | Dynamic runtime interpreter — Fastify primitives; runs on ECS or Lambda via the `compute` hint | 3001 | `output/lending/<env>/api-fastify/` |
| `ruby/rails` | Static code generation — Rails API-mode app with controllers, models, migrations | 3000 | `output/lending/<env>/api-rails/` |
| `python/fastapi` | Static code generation — FastAPI app with Pydantic schemas, SQLAlchemy models, APIRouters | 8000 | `output/lending/<env>/api-fastapi/` |

The Node adapters expose identical Swagger UI (`/api`), Redoc (`/docs`), and raw OpenAPI JSON (`/api-json`).

### `compute` hint (ECS vs Lambda)

The Fastify adapter accepts a `compute: 'ecs' | 'lambda'` cell config. The default is `ecs` — the same long-running server every other Node adapter produces. Set `compute: 'lambda'` to emit a Lambda-targeted variant that wraps Fastify with `@fastify/aws-lambda` v4+ in streaming mode (`awslambda.streamifyResponse`), suitable for Lambda Function URLs with `invoke_mode = RESPONSE_STREAM`.

```json
{
  "name": "api",
  "dna": "lending/product.api",
  "adapter": {
    "type": "node/fastify",
    "config": { "compute": "lambda", "core_dna": "lending/product.core" }
  }
}
```

| | `compute: 'ecs'` (default) | `compute: 'lambda'` |
|---|---|---|
| Entrypoint | `src/main.ts` calls `app.listen()` | `src/handler.ts` exports a Lambda handler |
| Packaging | Docker image → ECR → ECS Fargate | `lambda.zip` artifact (via `npm run package`) |
| SSE | Works (Fastify `reply.raw.write`) | Works (streaming wrapper forwards to Function URL) |
| Hot DNA reload | Yes (fs.watch + restart warning) | No (cold-start reload only) |
| terraform-aws emits | ECS task def + ALB target group | `aws_lambda_function` + `aws_lambda_function_url` (RESPONSE_STREAM) + CloudFront + WAF |

Existing `node/nestjs`, `node/express`, `ruby/rails`, `python/fastapi` adapters target ECS exclusively and ignore the hint — only the Fastify adapter currently has a Lambda path.

### OpenAPI as the contract (forward direction)

The Fastify Lambda path is the first api-cell adapter that consumes the OpenAPI document emitted by `@dna-codes/output-openapi` instead of reading `product.api.json` directly. The seam is marked `SEAM` in the generated `src/handler.ts` so the swap is mechanical when the upstream package publishes; until then, both compute targets read `product.api.json`. Migrating the existing adapters to OpenAPI consumption is a separate, larger initiative — this change establishes the precedent without forcing it.

The Express adapter watches `src/dna/api.json` and `src/dna/operational.json` at runtime. When either file changes, routes and the OpenAPI spec are rebuilt in-process — no restart needed.

**State changes**: An operational `Operation` may declare `changes[]` — typed state mutations applied to the target Resource when the operation succeeds. The api-cell adapters surface these as comments on the generated handler/service body so a reader can trace the business intent down to the route. The runtime applies the changes to the storage backend (in-memory or Postgres).

> Cross-domain signaling (Pattern A — HTTP push to subscribers, Pattern B — queue + worker fan-out) was scaffolded against the previous DNA model and is currently paused. The signal middleware, signal dispatch config, and `_signals` receiver routes have been removed pending a redesign against the new operational primitives. The `event-bus-cell` directory remains in the tree as paused work.

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
# Generate outputs from DNA (env-scoped — dev by default, override with --env)
npx cba develop lending --env dev --cell api-cell        # Express → output/lending/dev/api/
npx cba develop lending --env dev --cell api-cell-nestjs # NestJS  → output/lending/dev/api-nestjs/

# Install deps (first time or after regeneration)
npm install --prefix output/lending/dev/api
npm install --prefix output/lending/dev/api-nestjs

# Run side-by-side (in separate terminals)
npm run start:nestjs    # http://localhost:3000/api
npm run start:express   # http://localhost:3001/api
```

### Rails adapter

```bash
cba develop lending --env dev --cell api-cell-rails

cd output/lending/dev/api-rails
bundle install
bin/rails db:create db:migrate db:seed
bin/rails server
```

Generated structure:
- **Controllers** — one per resource with role-based `authorize_roles!` and DNA Operation `changes[]` applied inline
- **Models** — one per Operational DNA Resource with validations (presence, enum inclusion)
- **Migration** — single migration creating all tables from Resource attributes, UUID primary keys
- **Auth** — `ApplicationController` with JWKS-based JWT verification (IDP-agnostic)
- **Routes** — explicit route declarations matching every DNA endpoint
- **Dockerfile** — multi-stage Ruby 3.3 build with Puma

### FastAPI adapter

```bash
cba develop lending --env dev --cell api-cell-fastapi

cd output/lending/dev/api-fastapi
pip install -r requirements.txt
uvicorn app.main:app --reload    # http://localhost:8000/docs
```

Generated structure:
- **Routers** — one per resource with FastAPI dependency injection for auth and DB sessions
- **Models** — SQLAlchemy 2.0 declarative models (one per Operational DNA Resource)
- **Schemas** — Pydantic v2 request/response models
- **Auth** — JWKS-based JWT verification via `python-jose`
- **Alembic** — migration configuration wired to the SQLAlchemy models
- **Dockerfile** — multi-stage Python 3.12 build with uvicorn

### Using Postgres (via db-cell)

The `db-cell` provisions the database + app role. The `api-cell` owns migrations, seeds, and queries via drizzle, connecting as the app role.

```bash
# 1. Generate and start the database
npx cba develop lending --env dev --cell db-cell
cd output/lending/dev/db
docker compose up -d         # Postgres on port 5433, creates lending DB + lending_app role

# 2. Generate drizzle migrations, apply, and seed
cd ../api
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
| `vite/react` | DNA-driven React SPA — React Router, React Context, hooks | 5173 | `output/lending/<env>/ui/` |
| `vite/vue` | DNA-driven Vue 3 app — Vue Router, provide/inject, Composition API | 5174 | `output/lending/<env>/vue-ui/` |
| `next/react` | DNA-driven Next.js App Router app — client-side DNA loading with SSR-ready structure | 5175 | `output/lending/<env>/ui-next/` |
| `astro` | Static-site generation — `flavor: 'marketing' \| 'starlight'`. Each DNA `Page` becomes an `.astro` page (marketing) or a Starlight Markdown entry (docs). | n/a | `output/lending/<env>/site/` |

All adapters fetch all three DNA layers at startup through a `DnaLoader` abstraction (currently `StaticFetchLoader`; designed for future API/SSE delivery). Blocks use their `operation` field to resolve API endpoints from Product API DNA.

### Astro adapter (marketing + starlight flavors)

The `astro` adapter ships two flavors selected via cell config:

```json
{ "type": "astro", "config": { "flavor": "marketing" } }
{ "type": "astro", "config": { "flavor": "starlight", "openapiPath": "./openapi.json" } }
```

**Marketing** — plain Astro SSG. Each DNA `Page` → `src/pages/<route>.astro`; the `Layout` → `src/layouts/Site.astro`; each unique `Block` → `src/components/Block<Name>.astro`. Routes with `:id`-style params become Astro `[id]` segments. Output is static HTML; terraform-aws delivers via S3 + CloudFront, the same path used for `vite/*` cells.

**Starlight** — Astro + `@astrojs/starlight` (docs UI). Each DNA `Page` becomes a Markdown entry under `src/content/docs/`; sidebar order matches the page list. When `openapiPath` is set in cell config, the `starlight-openapi` plugin renders an API reference section sourced from a document emitted by `@dna-codes/output-openapi`.

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
npx cba develop lending --env dev --cell ui-cell         # React
npx cba develop lending --env dev --cell vue-ui-cell     # Vue
npx cba develop lending --env dev --cell ui-cell-next    # Next.js

npm install --prefix output/lending/dev/ui
cd output/lending/dev/ui && npx vite                     # http://localhost:5173
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
| `postgres` | Generates Docker Compose + init SQL (DB, roles, permissions) | `output/lending/<env>/db/` |

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

## `event-bus-cell` (paused)

Cross-domain signaling was scaffolded against the previous DNA model that included `Signal` as a top-level primitive with `Outcome.emits` carrying the publish list. Both `Signal` and `Outcome` were removed in the model rewrite — state mutations now live as `Operation.changes[]`, and there is no top-level Signal primitive in `@dna-codes/schemas`.

The cell directory remains in `technical/cells/event-bus-cell/` for reference, but is excluded from the active build/test pipeline. A redesign that maps Triggers (`source: "operation"` chains) onto an event bus is on the roadmap. See [ROADMAP.md](ROADMAP.md).

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
| `op` | _(none)_ | Selected operation for `sub=cross-layer`, as `Target.Action` |
| `env` | `dev` | Environment for technical overlay |
| `adapter` | `docker-compose` | Technical status probe adapter |

**Data flow:** cba-viz calls `GET /api/load-views/:domain?env=<env>`, which the vite middleware proxies by shelling out to `cba views <domain> --env <env> --json`. Adding a cell/construct/provider to `technical.json` makes it appear automatically.

**Features:**
- **Build / Run lifecycle nav** — `Build` groups authoring surfaces (Operational, Product, Technical, Cross-layer, Guide); `Run` groups runtime observation (Deployment + stubs for Logs, Metrics, Access)
- **Discovery workspace (Guide tab)** — 3-phase pipeline: **Discover** (tag text fragments as DNA primitives), **Define** (browse and refine Operational DNA), **Design** (auto-generates SOP docs, process flow DAGs, and Product DNA summary)
- **Cross-layer view** — single-capability lens spanning Operational → Product API → Product UI
- **Multi-layer editing** — per-layer canvas with shape palette and save pipeline
- **Schema-driven inspector** — live RJSF form generated from `@dna-codes/schemas`
- **Write-back** — save positions and edits back to `technical.json` or `operational.json` (Ctrl+S)
- **Live status** — polls the selected adapter every 5 seconds and updates technical node status in real time
- **Terraform/AWS probe** — reads `terraform.tfstate` + queries AWS APIs to map live infrastructure status back to DNA node IDs
- **Clickable URL ribbons** — each deployed cell/construct renders its live endpoint at the bottom of its node (CloudFront for vite cells, ALB for api cells, AWS console deep links for RDS/EventBridge). The ribbon is truncated to fit the shape; click opens the full URL in a new tab

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
| `cba develop <domain> [--env X] [--cell Y]` | Reads technical DNA, invokes each declared cell's generator into `output/<domain>/<env>/<cell-suffix>/` |
| `cba deploy <domain> --env <env> [--adapter X]` | Composes generated cells into a deployable topology (default: `docker-compose`) |
| `cba up <domain> --env <env> [--adapter X]` | Full pipeline: `validate` → `develop` → `deploy` → launch the stack |
| `cba down <domain> --env <env> [--adapter X]` | Tear down a deployed stack |
| `cba status <domain> --env <env> [--adapter X]` | Show what's running |

Plus utilities: `cba run <domain> --adapter <x>` (start generated output), `cba validate <domain>` (all-layer + cross-layer validation).

## Examples

```bash
# Inspect DNA
npx cba operational list lending
npx cba operational show lending --type Resource --name Loan
npx cba operational schema Resource                 # prints JSON schema
npx cba product api list lending

# Mutate DNA
npx cba technical add lending --type Variable --file new-var.json
npx cba operational add lending --type Resource \
  --at acme.finance.lending --file loan.json
npx cba technical remove lending --type Variable --name OLD_FLAG

# Discover — agent-driven stakeholder conversation
npx cba operational discover lending
npx cba operational discover lending --from notes.md

# Generate + run
npx cba develop lending --env dev --dry-run                   # preview all cells for dev
npx cba develop lending --env dev --cell api-cell             # run one cell
npx cba run lending --env dev --adapter express               # start generated API

# Deploy
npx cba deploy lending --env dev --plan             # preview
npx cba deploy lending --env dev                    # write compose file
cd output/lending/dev/deploy && docker compose up -d

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
2. `cba operational schema Resource --json` — learn the primitive shape
3. `cba operational add lending --type Resource --at … --file draft.json --json` — draft
4. `cba validate lending --json` — catch cross-layer errors, loop back to conversation
5. `cba develop lending --env dev --dry-run --json` — show stakeholder the diff
6. `cba develop lending --env dev` — ship it

See [`packages/cba/README.md`](./packages/cba/README.md) for full command reference and flags.

---

# Deployment

`cba deploy` reads Technical DNA for a target Environment and composes the generated cell artifacts into a deployable topology via a **deployment adapter**. Infrastructure is not a cell — it's configuration consumed by the deployment step.

| Adapter | Status | Output |
|---------|--------|--------|
| `docker-compose` | **Built** | `output/<domain>/<env>/deploy/docker-compose.yml` |
| `terraform/aws` | **Built** | `output/<domain>/<env>/deploy/*.tf` — AWS IaC (VPC, RDS, ECS Fargate, ALB, S3+CloudFront) |
| `aws-sam` | Planned | AWS serverless deployment for function-category Constructs |

## `cba up` / `cba down` / `cba status`

`cba up` chains the whole pipeline:

```
cba up <domain> --env <env>
  │
  ├─ 1. cba validate <domain>
  ├─ 2. cba develop <domain> --env <env>
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
npx cba develop lending --env dev
npx cba deploy lending --env dev --plan
npx cba deploy lending --env dev
cd output/lending/dev/deploy && docker compose up -d
```

## `terraform/aws` adapter

Generates Terraform HCL files that provision AWS infrastructure from Technical DNA. Output is split across `main.tf`, `vpc.tf`, `storage.tf`, `compute.tf`, `network.tf`, `iam.tf`, `ecr.tf`, `secrets.tf`, `locals.tf`, `variables.tf`, and `outputs.tf`.

**Baseline (always provisioned)** — foundational resources every environment gets:

| Concern | AWS Resources |
|---------|---------------|
| Network (`vpc.tf`) | `aws_vpc`, `aws_subnet` (2 public + 2 private across 2 AZs), `aws_internet_gateway`, `aws_nat_gateway`, `aws_eip`, `aws_route_table`, `aws_route_table_association`, `aws_security_group` (ECS, ALB; RDS and Redis added when used) |
| Compute cluster (`compute.tf`) | `aws_ecs_cluster`, `aws_cloudwatch_log_group` |
| Edge (`network.tf`) | `aws_lb` + `aws_lb_listener` (ALB front door for ECS services) |
| IAM (`iam.tf`) | `aws_iam_role` (ECS execution + task), `aws_iam_role_policy` (Secrets Manager reads; EventBridge + SQS when present), `aws_iam_role_policy_attachment` |

**Per DNA primitive** — resources emitted based on what's in Technical DNA:

| DNA Primitive | AWS Resources |
|---------------|---------------|
| `storage/database` (postgres) | `aws_db_instance` (RDS, managed master password), `aws_db_subnet_group` |
| `storage/cache` (redis) | `aws_elasticache_cluster`, `aws_elasticache_subnet_group` |
| `storage/queue` (eventbridge) | `aws_cloudwatch_event_bus`, `aws_cloudwatch_event_rule`, `aws_cloudwatch_event_target`, `aws_sqs_queue`, `aws_sqs_queue_policy` |
| `compute/container` (via Cell) | `aws_ecs_task_definition` (Fargate), `aws_ecs_service` |
| `network/gateway` | `aws_apigatewayv2_api`, `aws_apigatewayv2_stage`, `aws_apigatewayv2_integration` (VPC-linked to ALB) |
| Cell (`node/*`, `ruby/*`, `python/*`) | `aws_ecr_repository` + container definition wired into the ECS task def above. HTTP-serving cells also get `aws_lb_target_group` + `aws_lb_listener_rule` on the shared ALB |
| Cell (`vite/*`, `astro/*`) | `aws_s3_bucket`, `aws_s3_bucket_public_access_block`, `aws_s3_bucket_policy`, `aws_cloudfront_distribution`, `aws_cloudfront_origin_access_identity` |
| Cell with `compute: 'lambda'` (api-cell fastify) | `aws_lambda_function` (zip), `aws_lambda_function_url` (`invoke_mode = RESPONSE_STREAM`, `authorization_type = NONE`), `aws_lambda_permission` (CloudFront principal), `aws_cloudfront_distribution` (no caching, all methods), `aws_wafv2_web_acl` (rate-based rule, default 100 req/5min/IP, attached to the distribution). Lambda + db-cell additionally emits `aws_db_proxy` + target group + target, an RDS-Proxy IAM role, lambda-side VPC config (private subnets + lambda SG), and an aliased `aws.us_east_1` provider for the WAF (CloudFront WAFs are global) |
| Variable (`source: secret`, sensitive) | `aws_secretsmanager_secret` + `aws_secretsmanager_secret_version`. `JWT_SECRET` also gets a `random_password` resource; `DATABASE_URL` is derived from RDS outputs via `locals.tf` (or from the RDS Proxy endpoint when a lambda cell is in the plan) |

Data sources pulled in: `aws_availability_zones` (for subnet AZ spread), `aws_secretsmanager_secret_version` (for the RDS-managed master password when deriving `DATABASE_URL`).

```bash
npx cba up torts/marshall --env prod --adapter terraform/aws --auto-approve
```

**Safety rails:** `--adapter terraform/aws` without `--auto-approve` stops after `terraform plan`. `cba down … --adapter terraform/aws` always requires `--auto-approve`.

**Lambda + RDS rule:** any lambda cell paired with a postgres db-cell automatically routes its `DATABASE_URL` through `aws_db_proxy` instead of hitting RDS directly. This is non-negotiable — Lambda concurrency burns RDS connections at any throughput without the proxy. ECS-only plans skip the proxy entirely (existing behavior preserved). The proxy override is applied per-plan; you don't toggle it.

**WAF defaults:** the rate-based rule defaults to 100 requests / 5 minutes per IP. Override per-cell via `adapter.config.wafRateLimit` (raise for higher-traffic surfaces, lower for sensitive auth endpoints).

---

# Validation

Validation is handled by the `DnaValidator` exported from `@dna-codes/core` (see [DNA repo](https://github.com/upgrade-solutions/dna)). The `cba validate` command wraps it for the full lifecycle:

```bash
npx cba validate lending --layer operational   # validate one layer
npx cba validate lending                       # validate all layers + cross-layer
npx cba validate lending --json                # structured JSON errors
```

## Cross-layer reference validation

| Source | Target | What's checked |
|--------|--------|---------------|
| Product API `Resource.resource` | Operational `Resource` | Resource references an existing Resource |
| Product API `Action.action` | Operational `Action` | API action name exists on the Resource's actions[] catalog |
| Product API `Operation` (by `name`) | Operational `Operation` | Each API operation has a matching `Target.Action` operation |
| Product API `Endpoint.operation` | Product API `Operation` | Endpoint references a defined Operation |
| Product UI `Page.resource` | Product API `Resource` | Page references an existing Resource |
| Product UI `Block.operation` | Product API `Operation` | Block references an existing Operation |
| Product UI `Route.page` | Product UI `Page` | Route references a defined Page |
| Technical `Construct.provider` | Technical `Provider` | Construct references an existing Provider |
| Technical `Cell.constructs[]` | Technical `Construct` | Cell construct references exist |

Programmatic access:

```typescript
import { DnaValidator } from '@dna-codes/core'

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
| `@dna-codes/core` (validator) | 42 | Per-schema validation, composite documents, cross-layer validation (lives upstream in the DNA repo) |
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
      event-bus-cell/               # PAUSED — pending redesign against the new operational model
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
- **Operations carry their state mutations.** Each `Operation` declares optional `changes[]` — typed attribute updates applied to the target Resource on success. There is no separate Outcome primitive; state mutation is an Operation property.
- **Triggers, not Causes.** Triggers fire Operations or Processes from one of four sources: `user`, `schedule`, `webhook`, `operation` (the last expresses operation-to-operation chaining via `after`).
- **Infrastructure is not a cell.** Deployment is a `cba deliver` concern with delivery adapters (docker-compose, terraform/aws, aws-sam), not a cell type.

---

# Spec-Driven Development

This repo uses **[OpenSpec](https://github.com/Fission-AI/OpenSpec)** as its default spec-driven development framework. Non-trivial features go through a Proposal → Apply → Archive workflow before implementation, keeping intent and code in sync.

```bash
npm install -g @fission-ai/openspec@latest   # one-time, global
```

Slash commands (Claude Code):

| Command | What it does |
|---------|--------------|
| `/opsx:explore` | Think through ideas, investigate problems, clarify requirements |
| `/opsx:propose <name-or-description>` | Create a change with `proposal.md`, `design.md`, `tasks.md` |
| `/opsx:apply` | Implement the tasks for the active change |
| `/opsx:archive` | Finalize and archive a completed change |

Project-level OpenSpec layout:
- `openspec/config.yaml` — project context + per-artifact rules used by every proposal
- `openspec/specs/` — accepted, living specs
- `openspec/changes/` — in-flight proposals; archived ones move to `openspec/changes/archive/`

Skip OpenSpec only for trivial fixes, doc tweaks, or one-off experiments.

---

# Roadmap

See [ROADMAP.md](ROADMAP.md) for the full implementation plan.
