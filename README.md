# Cell-based Architecture

Cell-based architecture is a philosophy for building applications by injecting **DNA** into **cells** — infrastructure shells that read DNA and produce working software (API endpoints, UIs, database schemas, etc.).

- **DNA** — a JSON description language expressing a domain at three distinct layers (see below)
- **Cell** — a TypeScript package/engine that accepts one layer of DNA as input and produces code or deployable infrastructure

The relationship: DNA describes *what* the business is and does; cells decide *how* to implement it.

# The Three Layers of DNA

## 1. Operational DNA
> *"What the business does"* — analogous to Domain-Driven Design

Operational DNA captures pure business logic: domain concepts, processes, rules, and SOPs. It is technology-agnostic and owned by the business, not engineering.

**Structure primitives:**

| Primitive | Description |
|-----------|-------------|
| `Noun` | A business entity (e.g. `Loan`, `Order`, `User`) |
| `Verb` | A business action (e.g. `Approve`, `Ship`, `Terminate`) |
| `Capability` | A Noun:Verb pair — the atomic unit of business activity (e.g. `Loan.Approve`) |
| `Attribute` | A property on a Noun (name, type, constraints) |
| `Domain` | Dot-separated hierarchy grouping Nouns into bounded contexts (e.g. `acme.finance.lending`) |
| `Relationship` | A named, directed connection between two Nouns — formalizes the link a reference Attribute implies, adding cardinality (e.g. `Loan.borrower`: many-to-one from Loan to Borrower via `borrower_id`) |

**Behavior primitives** — evaluated in order:
```
Cause → Rule → [Capability executes] → Outcome (→ Signal)
```

| Primitive | Description |
|-----------|-------------|
| `Cause` | What initiates a Capability (user action, webhook, schedule, chained Capability, or Signal) |
| `Rule` | A constraint on a Capability — who may perform it (`type: access`) or what conditions must be met (`type: condition`) |
| `Outcome` | State changes and side effects after execution. Can `initiate` downstream Capabilities (intra-domain, sync) or `emit` Signals (cross-domain, async) |
| `Signal` | A named domain event published after a Capability executes — crosses domain boundaries with a typed payload contract. Other domains subscribe via `Cause` with `source: "signal"` |
| `Equation` | A named, technology-agnostic computation — pure function with typed inputs and output. Implemented concretely by a Script in Technical DNA |

**SOP primitives** — the human operating playbook:

| Primitive | Description |
|-----------|-------------|
| `Position` | An organizational job title (e.g. `ClosingSpecialist`, `LoanOfficer`). Carries Roles (declared in Product Core DNA) and is referenced by Tasks and Persons |
| `Person` | An individual who currently fills a Position — the business org roster. Documentation-grade DNA, not authentication identity |
| `Task` | The atomic reusable unit of human activity: a Position performing exactly one Capability (e.g. `ClosingSpecialist does Loan.Close`) |
| `Process` | A Standard Operating Procedure: a named, owned, ordered DAG of Steps that accomplishes a business goal. Each Step references a Task. Purely descriptive — runtime orchestration deferred to workflow-cell |

Schemas live in `../operational/schemas/` or https://github.com/upgrade-solutions/cell-based-architecture/tree/main/operational/schemas

### SOPs in Operational DNA

The SOP primitives model **who does what in what order** — the human operating playbook behind Capability executions. They complement the behavior stack (Cause → Rule → Outcome) which models *what the system does*.

**Position vs Role:** Position is the org-chart title (`ClosingSpecialist`, `Underwriter`) — it lives in Operational DNA because it describes the business. Role is the access-control grant (`closer`, `admin`) — it lives in Product Core DNA because it defines what the product permits. Positions carry Roles via `Position.roles[]`. The two are many-to-many: a `ClosingSpecialist` might have roles `[closer, editor]`; the `admin` role might not map to any Position.

**Task = Position + Capability:** A Task is the atomic reusable unit — *"ClosingSpecialist does Loan.Close"*. One Task = one Capability. If the rules change, it's a different Capability (and therefore a different Task). Tasks are composed into Processes, not called directly.

**Process = ordered DAG of Steps:** Each Step references a Task and optionally `depends_on` sibling step IDs. Multiple `depends_on` entries mean "wait for all" (AND fan-in) — this is how parallel branches converge. A `branch` on a Step provides a conditional gate with `when` / `else`. Processes are **purely descriptive** in v1 — they document the playbook but don't execute it. The planned workflow-cell will consume Processes to drive real orchestration.

**Person** is the current org roster — who fills each Position today. It's documentation-grade DNA, not authentication identity (JWT subjects stay with the IDP). Editing `persons[]` does not trigger downstream code generation.

Example — Loan Origination SOP:
```
Process: LoanOrigination (operator: LendingManager)
  ├── review: Underwriter does Loan.Review
  ├── approve: Underwriter does Loan.Approve (depends_on: review, branch: when qualified)
  └── reject: Underwriter does Loan.Reject (depends_on: review, branch: else)
```

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
| `Role` | `Position` (many-to-many) | A named access-control grant referenced by Rules and Positions. Consumed by api-cell for auth middleware and ui-cell for permission guards |

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
| `Profile` | A named subset of Cells for targeted deployment (e.g. `python-stack`, `node-stack`) |
| `View` | A named architecture diagram perspective (e.g. `deployment`, `data-flow`) containing Nodes, Connections, and Zones |
| `Node` | A visual element in a View representing a system component (cell, construct, provider, etc.) |
| `Connection` | A directed relationship between two Nodes (depends-on, data-flow, communicates-with, publishes-to) |
| `Zone` | A visual container grouping related Nodes (tier, boundary, environment, domain) |

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

Adapter types are namespaced by runtime — `node/nestjs`, `node/express`, `ruby/rails`, `python/fastapi`, etc. — making the execution environment explicit in the DNA.

Constructs are declared once and referenced by multiple Cells — e.g. a `database` Construct shared by both an `api` Cell and a `workflow` Cell.

---

### Architecture views (derived from Technical DNA)

Technical DNA auto-derives an architecture graph — a visual diagram of system topology — from the `cells` and `constructs` arrays. The derivation happens at read time via `cba views <domain> --env <env>`, which emits JSON consumed by the `cba-viz` viewer.

Providers are *not* rendered on the deployment view — they're config (which cloud, which auth backend), not deployable infrastructure. Their reference lives on each Construct's `provider` field.

| Primitive | Description |
|-----------|-------------|
| `View` | A named diagram perspective (e.g. `deployment`) — currently one per domain, auto-derived from technical DNA |
| `Node` | A visual element representing a cell, construct, or provider. Auto-generated; not hand-maintained |
| `Connection` | A directed relationship — currently cells link to their constructs as `depends-on`. Auto-generated |
| `Zone` | A tier container (Compute for cells, Storage for constructs). Auto-generated |

The `views[]` section in `technical.json` is a **layout overlay** — each entry stores only `id` + `position` + `size`, and the derive function merges those onto the corresponding derived node or zone. Adding a cell/construct/provider makes it appear on the graph automatically; removing one removes it. Manual position edits persist across DNA changes.

**Provisioner cells are hidden on the deployment view.** Cells whose adapter is `postgres` or `node/event-bus` have no runtime service of their own — their entire purpose is to provision a single Construct (schema, queue config, etc.). On the deployment view they'd be visually redundant with their construct, so they're filtered out. The provisioning relationship still lives in `cell.constructs[]` in technical DNA.

```bash
npx cba views lending --env dev                    # derived graph for the dev environment
npx cba views torts/marshall --env prod --json     # derived graph, JSON output
```

---

# `cba-viz` — Interactive Architecture Viewer

The `cba-viz` package (`packages/cba-viz/`) is a standalone Vite + React application that renders Architecture DNA as interactive JointJS diagrams.

```bash
cd packages/cba-viz
npm run dev                                # http://localhost:5174
```

Open the viewer for a specific domain, phase, and sub-tab via URL params:

```
http://localhost:5175/?domain=torts/marshall&phase=run&sub=deployment&env=prod
```

| Param | Default | Description |
|-------|---------|-------------|
| `domain` | `lending` | DNA domain path (supports nested paths like `torts/marshall`) |
| `phase` | `build` | Lifecycle phase: `build` (authoring) or `run` (runtime observation) |
| `sub` | `operational` | Sub-tab within the phase. Build: `operational`, `product-core`, `product-api`, `product-ui`, `technical`, `cross-layer`. Run: `deployment`, `logs*`, `metrics*`, `access*` (* = stub) |
| `cap` | _(none)_ | Selected capability for `sub=cross-layer`, as `Noun.Verb` (e.g. `Loan.Approve`) |
| `env` | `dev` | Environment for technical overlay (dev uses rabbitmq, prod uses eventbridge). Only applies to `sub=deployment` / `sub=technical` |
| `adapter` | `docker-compose` | Technical status probe adapter. Only applies to `sub=deployment` |

Legacy `?layer=X` URLs from earlier releases are automatically translated to the equivalent `?phase=Y&sub=Z` on load.

Phase + sub are selectable in the two-row toolbar at runtime. `env` and `adapter` only surface in the toolbar when on `Run > Deployment`.

**Data flow:** cba-viz calls `GET /api/load-views/:domain?env=<env>`, which the vite middleware proxies by shelling out to `cba views <domain> --env <env> --json`. The graph is always the derived view — adding a cell/construct/provider to `technical.json` makes it appear automatically.

**Features:**
- **Build / Run lifecycle nav** — top-level `Build` tab groups authoring surfaces (Operational, Product Core / API / UI, Technical, Cross-layer); `Run` groups runtime observation (Deployment + stubs for Logs, Metrics, Access). The IA asks *"what am I doing right now?"*, not *"which file am I editing?"*.
- **Cross-layer view** — a single-capability lens spanning Operational → Product API → Product UI. Pick a capability from the floating chip in the top-left; the canvas renders three horizontal bands with the capability + its rules/outcomes on top, matching endpoints in the middle, matching pages/blocks on the bottom, and dashed cross-layer edges linking them. Clicking any node opens its home-layer RJSF form in the sidebar.
- **Multi-layer editing** — Build sub-tabs switch between the **Operational** (Nouns, Capabilities, Rules, Outcomes, Signals), **Product Core / API / UI** (Resources, Endpoints, Pages, Blocks), and **Technical** (deployment graph) DNA layers. Each layer has its own canvas, shape palette, and save pipeline.
- **Schema-driven inspector** — operational nodes surface a live RJSF form generated from `operational/schemas/*.json`, so editing a Capability or Rule round-trips cleanly through the same JSON Schema the CLI and validator use. Edits stream through `onChange` and mark the graph dirty for Ctrl+S.
- **View switching** — dropdown to switch between views in the architecture DNA (technical layer)
- **Editable** — drag nodes to reposition, inspector panel to edit properties
- **Collapsible inspector** — the right-hand inspector panel can collapse to a thin strip to reclaim canvas space; click the caret to expand/collapse
- **Smooth re-renders** — the canvas fades in on every graph rebuild (view switch, layer switch, or status transition) so transitions don't flash
- **Custom shapes** — distinct visual styles per layer: technical uses cells (rounded rect, blue), constructs (rect, blue), providers (pill, amber); operational uses Nouns (slate rect), Capabilities (emerald pill), Rules (amber/cyan hex), Outcomes (violet square), Signals (rose diamond)
- **Write-back** — save positions and edits back to `technical.json` or `operational.json` (Ctrl+S or Save button). Operational layouts persist to a `layouts[]` field on the document.
- **Dark theme** — dark canvas with dot grid, matching the cell-based architecture aesthetic
- **Live status** — polls the selected adapter every 5 seconds and updates technical node status in real time
- **Adapter selector** — toolbar dropdown to switch between Docker Compose and Terraform/AWS status probes
- **Terraform/AWS probe** — reads `terraform.tfstate` + queries AWS APIs (ECS, RDS, EventBridge, SQS) to map live infrastructure status back to DNA node IDs

**Status rendering:**

| Status | Visual |
|--------|--------|
| `proposed` | Dashed stroke, dim (45% opacity) |
| `planned` | Solid stroke, greyed out (60% opacity) |
| `deployed` | Full color, solid |

When the Terraform/AWS adapter is selected, nodes start as `planned` (from the DNA spec) and transition to `deployed` as resources are provisioned and verified via AWS APIs.

**Tech stack:** Vite 7, React 19, JointJS Plus (v4.2), MobX, Tailwind CSS v4.

---

# Primitive Vocabulary by Layer

| Layer | Primitives |
|-------|-----------|
| Operational | `Noun`, `Verb`, `Capability`, `Attribute`, `Domain`, `Relationship`, `Cause`, `Rule`, `Outcome`, `Signal`, `Equation`, `Position`, `Person`, `Task`, `Process` |
| Product | `Resource`, `Action`, `Operation`, `Role`, `Layout`, `Page`, `Route`, `Block`, `Field`, `Namespace`, `Endpoint`, `Schema`, `Param` |
| Technical | `Environment`, `Cell`, `Construct`, `Provider`, `Variable`, `Output`, `Script`, `View`, `Node`, `Connection`, `Zone` |

No primitive name is shared across layers.

---

# DNA Layer Relationships

```mermaid
flowchart LR
    subgraph Layers["DNA — Source of Truth (JSON)"]
        direction TB
        OP["Operational DNA\nNouns · Verbs · Capabilities · Relationships\nCauses · Rules · Outcomes · Equations\nPositions · Persons · Tasks · Processes"]
        PROD["Product DNA\nResources · Actions · Operations · Roles\nPages · Routes · Endpoints · Schemas"]
        TECH["Technical DNA\nCells · Constructs · Providers\nEnvironments · Variables · Scripts"]
        OP -->|"maps to"| PROD
        PROD -->|"configures"| TECH
    end

    subgraph CellRuntime["Cell Runtime"]
        direction TB
        CELL["Cell\nTypeScript engine"]
        ADAPTER["Adapter\ne.g. node/nestjs · node/express\nruby/rails · python/fastapi · react · vue"]
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
| `event-bus-cell` | Operational → Technical | Signals across all domains + queue Construct config | Schema registry, typed publisher libs, routing config, worker stubs | **Built** — `technical/cells/event-bus-cell/` |
| `workflow-cell` | Technical | Causes, Processes, Outcomes, Constructs | Event-driven workflows | Planned |

Signal delivery uses two patterns — **Pattern A (HTTP push)**: publisher API dispatches signals directly to subscriber API endpoints (`/_signals/:signalName`), configured via `signal_dispatch` in Technical DNA. **Pattern B (queue + worker)**: durable queue-based delivery with a standalone worker process (planned — see [ROADMAP.md](ROADMAP.md) Phase 3e).

### `api-cell` adapters

The `api-cell` supports multiple adapters that produce the same API surface from the same DNA:

| Adapter | Approach | Port | Output |
|---------|----------|------|--------|
| `node/nestjs` | Static code generation — typed controllers, services, DTOs | 3000 | `output/lending-api-nestjs/` |
| `node/express` | Dynamic runtime interpreter — reads DNA at startup, hot-reloads on DNA file changes | 3001 | `output/lending-api/` |
| `ruby/rails` | Static code generation — Rails API-mode app with controllers, models, migrations | 3000 | `output/lending-api-rails/` |
| `python/fastapi` | Static code generation — FastAPI app with Pydantic schemas, SQLAlchemy models, APIRouters | 8000 | `output/lending-api-fastapi/` |

The Node adapters expose identical Swagger UI (`/api`), Redoc (`/docs`), and raw OpenAPI JSON (`/api-json`).

The Express adapter watches `src/dna/api.json` and `src/dna/operational.json` at runtime. When either file changes, routes and the OpenAPI spec are rebuilt in-process — no restart needed. Edit the DNA, the API updates immediately.

**Signal middleware**: The Express adapter generates signal emission middleware driven by Operational DNA. For each route whose Outcome declares `emits`, the middleware intercepts the response and publishes typed signals to RabbitMQ (via amqplib) using a `signals` topic exchange. Routes with no `emits` get a zero-overhead pass-through. The middleware chain per route is: `auth → requestValidator → ruleValidator → signalMiddleware → handler`.

**Signal dispatch (Pattern A — HTTP push)**: After publishing to the event bus, the signal middleware also HTTP POSTs each signal to configured subscriber API URLs. Subscriber URLs are configured in Technical DNA under the cell's adapter config as `signal_dispatch` — a mapping of Signal names to arrays of subscriber base URLs. The middleware constructs `POST {baseUrl}/_signals/{signalName}` requests with the typed payload.

**Signal receiver**: The Express adapter generates `POST /_signals/:signalName` endpoints for each Cause with `source: "signal"` in Operational DNA. Incoming signals are validated against the Signal definition's payload contract, then dispatched to the target Capability's handler (applying Outcome effects). This enables cross-domain communication where Domain A's Outcome emits a Signal and Domain B's Cause subscribes to it.

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

**Built-in JWT** (`provider: "built-in"`) — the API issues its own HS256 tokens via `/auth/login`. Includes hardcoded demo users. The admin UI renders a login gate and attaches Bearer tokens to all API calls. Best for demos and development.

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

#### Generate and run

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

#### Rails adapter

The `ruby/rails` adapter generates a complete Rails 7.1 API-mode application:

```bash
# Generate the Rails app from DNA
cba develop lending --cell api-cell-rails

# Or directly:
cd technical/cells/api-cell
npx ts-node -r tsconfig-paths/register src/index.ts \
  ../../../dna/lending/technical.json api-cell-rails ../../../output/lending-api-rails

# Run the Rails app
cd output/lending-api-rails
bundle install
bin/rails db:create db:migrate db:seed
bin/rails server
```

Generated structure:
- **Controllers** — one per resource with role-based `authorize_roles!` and DNA Outcome effects applied inline
- **Models** — one per Operational DNA Noun with validations (presence, enum inclusion)
- **Migration** — single migration creating all tables from Noun attributes, UUID primary keys
- **Auth** — `ApplicationController` with JWKS-based JWT verification (same IDP-agnostic pattern as Node adapters)
- **Routes** — explicit route declarations matching every DNA endpoint
- **Dockerfile** — multi-stage Ruby 3.3 build with Puma

#### FastAPI adapter

The `python/fastapi` adapter generates a complete FastAPI application with SQLAlchemy 2.0 and Pydantic v2:

```bash
# Generate the FastAPI app from DNA
cba develop lending --cell api-cell-fastapi

# Run the FastAPI app
cd output/lending-api-fastapi
pip install -r requirements.txt
uvicorn app.main:app --reload    # http://localhost:8000/docs
```

Generated structure:
- **Routers** — one per resource with FastAPI dependency injection for auth and DB sessions
- **Models** — SQLAlchemy 2.0 declarative models (one per Operational DNA Noun) with `Mapped` type annotations
- **Schemas** — Pydantic v2 request/response models with `from_attributes` for ORM compatibility
- **Auth** — JWKS-based JWT verification via `python-jose`, exposed as FastAPI dependencies (`get_current_user`, `require_roles`)
- **Database** — SQLAlchemy engine + session factory with FastAPI `Depends` integration
- **Alembic** — migration configuration wired to the SQLAlchemy models
- **Dockerfile** — multi-stage Python 3.12 build with uvicorn

FastAPI's native `/docs` (Swagger UI) and `/redoc` endpoints are available automatically.

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

Or — use `cba deploy` to run the whole stack as one compose file (see Deployment section below). In that flow, db-cell's init.sql is mounted into the postgres service and api-cell's migrations run automatically on startup.

### `ui-cell` adapters

The `ui-cell` supports multiple adapters that produce the same DNA-driven UI from the same Product UI DNA:

| Adapter | Approach | Port | Output |
|---------|----------|------|--------|
| `vite/react` | DNA-driven React SPA — React Router, React Context, hooks | 5173 | `output/lending-ui/` |
| `vite/vue` | DNA-driven Vue 3 app — Vue Router, provide/inject, Composition API | 5174 | `output/lending-vue-ui/` |
| `next/react` | DNA-driven Next.js App Router app — client-side DNA loading with SSR-ready structure | 5175 | `output/lending-ui-next/` |

All adapters fetch all three DNA layers at startup through a `DnaLoader` abstraction (currently `StaticFetchLoader`; designed for future API/SSE delivery). Blocks use their `operation` field to resolve API endpoints from the Product API DNA and the `useApi` composable/hook handles data fetching, form submission, and action dispatch.

#### Layout system

Layouts are DNA-driven structural shells that wrap pages. The layout `type` in Product UI DNA selects which shell the adapter generates:

| Layout Type | Description |
|-------------|-------------|
| `universal` | Production-ready app shell — collapsible sidebar, user profile dropdown, tenant picker, theme toggle. State managed by XState v5 |
| `marketing` | Public-site shell — sticky header with brand + nav + CTA, hero on root route only, footer with links. Drives `layout.brand`, `layout.hero`, `layout.footer` from DNA. Pairs with `survey` blocks for public intake forms |
| `sidebar` | Simple fixed sidebar with nav links and theme toggle |
| `full-width` | Horizontal header nav with centered content area |
| `split-panel` | (planned) |
| `centered` | (planned) |
| `blank` | (planned) |

The **marketing layout** is for public-facing sites (landing pages, intake funnels, lead capture). It reads `layout.brand` (name/tagline/href), `layout.hero` (eyebrow/title/subtitle/cta/secondaryCta), and `layout.footer` (text/links) directly from `product.ui.json`. Hero only renders on the root route. Theme tokens flow into both Tailwind utility classes and SurveyJS CSS variables, so a `survey` block on a marketing page picks up brand colors automatically. See `dna/torts/marshall/` for a working example.

#### Survey blocks (SurveyJS)

Public forms that post to a single capability use `block.type: "survey"` instead of authoring inputs by hand. The ui-cell scaffolds `survey-core` + `survey-react-ui` into the generated `package.json` and emits a `SurveyBlock.tsx` that:

- Builds the SurveyJS model directly from `block.fields` (field types are mapped: `email`/`phone`/`password` → `text` with `inputType`, `text` → `comment` (textarea), `enum` ≤5 → radiogroup, `enum` >5 → dropdown)
- Resolves the API endpoint via `block.operation` and submits with `useApi(...).submit()`
- Falls into **mock-submit mode** when `apiBase` is empty (preview-only deployments) — payload is logged to the console, the success state shows a "preview mode" badge, no network call is made
- Theme tokens (`--sjs-primary-backcolor`, `--sjs-editor-background`, etc.) are emitted at `:root` from the layout DNA — no runtime ref-based theming required

The **universal layout** is the recommended default. Built on **Radix UI** + **Tailwind CSS v4** with a **DNA-driven white-label theme system**. It includes:

- **Radix UI primitives** — DropdownMenu (profile, tenant picker), Collapsible (nav groups), Sheet (mobile drawer), Tooltip (collapsed sidebar), Avatar (user profile), Button (all actions). Keyboard accessible, focus-managed, auto-dismissing
- **Tailwind CSS v4** — all styling via utility classes referencing CSS custom properties. Zero inline styles
- **White-label theme** — `theme` object in DNA defines 24 shadcn-compatible color tokens (light + dark), border radius, font family. Colors emit as CSS variables in `globals.css`. Change colors in DNA, regenerate, done
- **Collapsible sidebar** — 240px expanded / 64px collapsed, animated via Tailwind transitions
- **Nested navigation** — `navigation` groups with Radix Collapsible expand/collapse, Tooltip labels when collapsed, auto-expand on active route
- **XState v5 state machine** — manages all layout state: sidebar, dropdowns, nav groups, tenant, theme (light/dark with `.dark` class toggle), viewport (mobile/desktop via resize observer), feature flags
- **Vendor mode** — Radix primitives are vendored into `src/primitives/` by default (self-contained output). Set `vendorComponents: false` to import from `@cell/ui-cell/primitives` within the monorepo

Layout configuration in DNA:

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
    "tenants": [
      { "id": "acme-lending", "name": "Acme Lending" },
      { "id": "globex-finance", "name": "Globex Finance" }
    ],
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
        "primary-foreground": "#fafafa",
        "sidebar-background": "#fafafa",
        "sidebar-foreground": "#0a0a0a"
      },
      "dark": {
        "background": "#0a0a0a",
        "foreground": "#fafafa",
        "primary": "#fafafa",
        "primary-foreground": "#171717"
      },
      "radius": "0.5rem",
      "font": "system-ui, sans-serif"
    }
  }
}
```

#### Generate and run

```bash
# Generate React UI from DNA
npx cba develop lending --cell ui-cell

# Generate Vue UI from DNA
npx cba develop lending --cell vue-ui-cell

# Generate Next.js UI from DNA
npx cba develop lending --cell ui-cell-next

# Install deps and run (requires Express API on port 3001)
npm install --prefix output/lending-ui
cd output/lending-ui && npx vite        # http://localhost:5173

npm install --prefix output/lending-vue-ui
cd output/lending-vue-ui && npx vite    # http://localhost:5174

npm install --prefix output/lending-ui-next
cd output/lending-ui-next && npm run dev  # http://localhost:5175
```

#### Next.js adapter

The `next/react` adapter generates a Next.js 14 App Router application with standalone output for Docker:

```bash
# Generate Next.js UI from DNA
cd technical/cells/ui-cell && npx ts-node -r tsconfig-paths/register src/index.ts \
  ../../../dna/lending/technical.json ui-cell-next ../../../output/lending-ui-next

# Install deps and run (requires Express API on port 3001)
npm install --prefix output/lending-ui-next
cd output/lending-ui-next && npx next dev    # http://localhost:5174
```

Key differences from the Vite adapter:
- **App Router** file-system routing via `src/app/` with a `[...slug]` catch-all that resolves DNA routes
- **`next/link`** and **`usePathname()`** replace react-router-dom's `NavLink` and `useParams`
- **`useRouteParams()`** custom hook matches pathname against DNA route patterns to extract named params (e.g. `:id`)
- **SSR-safe** theme initialization with `typeof window` guard
- **Standalone Docker output** using `output: 'standalone'` — Node.js runtime instead of nginx
- **API rewrites** proxy `/api/:path*` to the Express API in dev

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

### `event-bus-cell` (Planned)

The `event-bus-cell` is a platform-level cell that reads Operational DNA Signals across all domains and generates event infrastructure code. It mirrors the `db-cell` / `api-cell` split: the `storage/queue` Construct declares the bus infrastructure (RabbitMQ for dev, EventBridge for prod), while the `event-bus-cell` generates application-level event handling code. The `engine` config in technical.json selects the transport: `rabbitmq` (amqplib), `eventbridge` (AWS SDK — EventBridge for publishing, SQS for subscribing).

**What it generates:**

| Artifact | Description |
|----------|-------------|
| Schema registry | Compiled catalog of all Signals across all domains with typed payloads |
| Publisher libraries | Typed functions per domain, per adapter language (e.g. `publishLoanDisbursed(payload)`) |
| Routing config | Maps each Signal to subscribing Capabilities and their queues |
| Worker stubs | Skeleton consumer code for api-cells or future worker-cells |
| Infrastructure config | RabbitMQ definitions (exchanges, queues, bindings) or equivalent |

**Signal → Cause flow:**

A domain publishes a Signal after a Capability's Outcome completes. Another domain subscribes to that Signal via a Cause with `source: "signal"`:

```json
// Lending domain — Outcome emits a Signal
{
  "capability": "Loan.Disburse",
  "changes": [{ "attribute": "loan.status", "set": "active" }],
  "emits": ["lending.Loan.Disbursed"]
}

// Lending domain — Signal definition with typed payload contract
{
  "name": "lending.Loan.Disbursed",
  "capability": "Loan.Disburse",
  "payload": [
    { "name": "loan_id", "type": "string", "required": true },
    { "name": "amount", "type": "number", "required": true },
    { "name": "term_months", "type": "number", "required": true }
  ]
}

// Payments domain — Cause subscribes to the Signal
{
  "capability": "PaymentSchedule.Create",
  "source": "signal",
  "signal": "lending.Loan.Disbursed",
  "description": "When a loan is disbursed, automatically create a payment schedule."
}
```

**Multi-stack platform model:**

A platform (e.g. `dna/lending/`) hosts multiple domain stacks — each with its own api-cell, ui-cell, and db-cell — all declared in the same `technical.json` alongside a shared event-bus-cell:

```
dna/lending/
  operational.json    # acme.finance.lending + acme.finance.payments domains
  product.api.json    # lending + payments API surfaces
  product.ui.json     # lending + payments UI surfaces
  technical.json      # all cells:
                      #   event-bus-cell (platform-level, shared)
                      #   lending-api-cell, lending-ui-cell, lending-db-cell
                      #   payments-api-cell, payments-ui-cell, payments-db-cell
```

See [ROADMAP.md](ROADMAP.md) Phase 3a–3c and Phase 6 for the implementation plan.

## Cell Interface Contract

- **Input**: a DNA document conforming to the relevant layer's JSON schema
- **Adapter**: embedded in the Cell's Technical DNA — framework/runtime that interprets the DNA
- **Sub-adapters**: optional plugins inside an adapter's `config` (e.g. ORM, auth library, test framework)
- **Output**: deterministic, reproducible artifacts (code, schema, running process)

---

# The `cba` CLI

`cba` is the unified CLI for the cell-based architecture lifecycle, organized around the three DNA layers plus build and deploy. It ships as the `@cell/cba` workspace package and is the primary interface for both humans and agents operating on DNA and cells.

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
| `cba down <domain> --env <env> [--adapter X]` | Tear down a deployed stack (`docker compose down -v` / `terraform destroy`) |
| `cba status <domain> --env <env> [--adapter X]` | Show what's running (`docker compose ps` / `terraform show` + AWS resource summary) |

Plus utilities: `cba run <domain> --adapter <x>` (start generated output), `cba validate <domain>` (all-layer + cross-layer validation).

## Examples

```bash
# Inspect DNA
npx cba operational list lending
npx cba operational show lending --type Noun --name Loan
npx cba operational schema Noun                     # prints JSON schema
npx cba product api list lending
npx cba product ui list lending

# Mutate DNA
npx cba technical add lending --type Variable --file new-var.json
npx cba operational add lending --type Noun \
  --at acme.finance.lending --file loan.json
npx cba operational add lending --type Verb \
  --at acme.finance.lending:Loan --file approve.json
npx cba technical remove lending --type Variable --name OLD_FLAG

# Discover — agent-driven stakeholder conversation
npx cba operational discover lending
npx cba operational discover lending --from notes.md

# Generate + run
npx cba develop lending --dry-run                   # preview all cells
npx cba develop lending --cell api-cell             # run one cell
npx cba run lending --adapter express               # start generated API

# Deploy — compose generated cells into a deployable topology
npx cba deploy lending --env dev --plan             # preview services + skipped constructs
npx cba deploy lending --env dev                    # writes output/lending-deploy/docker-compose.yml
npx cba deploy lending --env dev --cells api-cell,db-cell,ui-cell  # specific cells only
npx cba deploy lending --env dev --profile python-stack            # named profile from DNA
npx cba deploy lending --env prod --adapter terraform/aws --plan   # preview AWS resources
npx cba deploy lending --env prod --adapter terraform/aws          # writes output/lending-deploy/*.tf
cd output/lending-deploy && docker compose up -d    # run the full stack locally

# Up / Down — one command from DNA to running stack
npx cba up torts/marshall --env dev --seed --build                      # validate → develop → deploy → launch
npx cba up torts/marshall --env dev --skip-develop --attach             # rerun, stream logs
npx cba down torts/marshall --env dev                                   # docker compose down -v
npx cba status torts/marshall --env dev                                 # docker compose ps
npx cba up torts/marshall --env prod --adapter terraform/aws            # stops at terraform plan
npx cba up torts/marshall --env prod --adapter terraform/aws --auto-approve   # actually applies
npx cba status torts/marshall --env prod --adapter terraform/aws        # terraform show + AWS summary
npx cba down torts/marshall --env prod --adapter terraform/aws --auto-approve # actually destroys

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

See `packages/cba/README.md` for full command reference and flags.

---

# Deployment

`cba deploy` reads Technical DNA for a target Environment and composes the generated cell artifacts into a deployable topology via a **deployment adapter**. Infrastructure is not a cell — it's configuration consumed by the deployment step.

| Adapter | Status | Output |
|---------|--------|--------|
| `docker-compose` | **Built** | `output/<domain>-deploy/docker-compose.yml` — multi-service local stack |
| `terraform/aws` | **Built** | `output/<domain>-deploy/*.tf` — AWS IaC (VPC, RDS, ECS Fargate, ALB, S3+CloudFront) |
| `aws-sam` | Planned | AWS serverless deployment for function-category Constructs |

## `cba up` / `cba down` / `cba status` — one command from DNA to running stack

`cba deploy` only **writes** the deploy topology; you still have to `cd` into the deploy dir and run `docker compose up` or `terraform apply` yourself. `cba up` chains the whole pipeline:

```
cba up <domain> --env <env> [--adapter <name>] [flags]
  │
  ├─ 1. cba validate <domain>             (bail on broken DNA)
  ├─ 2. cba develop <domain>              (regenerate cells — skip with --skip-develop)
  ├─ 3. cba deploy <domain> --env <env>   (compose the deploy topology)
  └─ 4. adapter.launch                    (bring the stack up)
       │
       └─ terraform/aws post-apply:
            ├─ ECR login
            ├─ docker build + push (container cells → ECR)
            ├─ npm build + s3 sync (static cells → S3)
            └─ ECS force-new-deployment
```

Each delivery adapter exposes `launch`, `teardown`, and `status` hooks that `cba up`/`cba down`/`cba status` dispatch to:

| Adapter | `launch` | `teardown` | `status` |
|---------|----------|------------|----------|
| `docker-compose` | `docker compose up -d` in the deploy dir | `docker compose down -v` | `docker compose ps` |
| `terraform/aws` | `terraform init` + `plan` + `apply` (with `--auto-approve`) + post-apply build/push | `terraform destroy` — requires `--auto-approve` | `terraform show` + AWS resource count |

**Safety rails:** `cba up … --adapter terraform/aws` without `--auto-approve` stops after `terraform plan` so you can review the diff before anything touches AWS. `cba down … --adapter terraform/aws` always requires `--auto-approve` because it destroys real resources.

**Clean teardown:** S3 buckets are created with `force_destroy = true` and ECR repositories with `force_delete = true`, so `terraform destroy` can remove them even when they contain objects/images.

```bash
# Local demo — docker-compose path
npx cba up torts/marshall --env dev --seed --build                # full pipeline
npx cba up torts/marshall --env dev --skip-develop --attach       # rerun with streaming logs
npx cba up torts/marshall --env dev --cell api-cell --force-recreate  # regen one cell, recreate container
npx cba status torts/marshall --env dev                              # docker compose ps
npx cba down torts/marshall --env dev                                # compose down -v
npx cba down torts/marshall --env dev --keep-volumes                 # keep postgres data

# AWS path — terraform/aws
npx cba up torts/marshall --env prod --adapter terraform/aws                   # stops at plan
npx cba up torts/marshall --env prod --adapter terraform/aws --auto-approve    # applies
npx cba status torts/marshall --env prod --adapter terraform/aws               # terraform show + AWS summary
npx cba down torts/marshall --env prod --adapter terraform/aws --auto-approve  # destroys
```

**Useful flags:**
- `--seed` — sets `SEED_EXAMPLES=true` in the child env so the api-cell pre-loads Product Core DNA examples on startup (useful for empty-DB demos). docker-compose only.
- `--build` / `--force-recreate` — pass-through to `docker compose up`. Use `--build` when you regenerate cells, `--force-recreate` when you change compose env vars.
- `--attach` — foreground logs instead of `-d`. Ctrl-C brings the stack down.
- `--plan` — stop after `cba deploy` (step 3) — same as running `cba deploy`, but with validate + develop in front.
- `--skip-develop` — reuse already-generated cell artifacts. Fast path when you know nothing in the DNA changed.

## `docker-compose` adapter

Composes the full lending stack (Postgres, Redis, Express API, NestJS API, Vite UI) into one compose file, wiring environment variables from Technical DNA:

- Storage `Construct`s → first-class compose services (`primary-db`, `session-cache`)
- `Cell`s with `node/*` or `vite/*` adapters → services built from each cell's output dir
- `secret`-sourced variables → dev defaults that reference other compose services (e.g. `DATABASE_URL=postgresql://postgres:postgres@primary-db:5432/lending`)
- `output`-sourced variables → resolved to internal service URLs (e.g. `api-cell.api_url` → `http://api:3001`)
- External providers (`auth0`, etc.) and network Constructs are skipped — reported under `skipped` in the delivery result

```bash
npx cba develop lending                      # generate all cells first
npx cba deploy lending --env dev --plan      # preview (all cells)
npx cba deploy lending --env dev --profile express-stack  # deploy only express + db + ui
npx cba deploy lending --env dev             # write output/lending-deploy/
cd output/lending-deploy
docker compose up -d                         # run the full stack
```

Deployment is **not regenerative** — it fails loudly if cell artifacts are missing, telling you to run `cba develop` first.

## `terraform/aws` adapter

Generates Terraform HCL files that provision AWS infrastructure from Technical DNA. The adapter maps DNA primitives to AWS resources:

| DNA Primitive | AWS Resource |
|---------------|-------------|
| Provider `aws` (region, account_id) | `provider "aws"` block |
| storage/database (postgres) | `aws_db_instance` (RDS) with subnet group |
| storage/cache (redis) | `aws_elasticache_cluster` with subnet group |
| compute/container (cpu, memory) | ECS Fargate task definition + service |
| network/gateway | `aws_apigatewayv2_api` (HTTP) |
| Cell (node/\*, ruby/\*, python/\*) | ECR repository + ECS container definition |
| Cell (vite/\*) | S3 bucket + CloudFront distribution |
| Cell (next/\*) | ECR repository + ECS container (SSR) |
| Variable (secret) | Secrets Manager secret + TF input variable |
| Variable (literal) | Container environment value |
| Variable (env) | TF input variable with default |

Generated files:

| File | Contents |
|------|----------|
| `main.tf` | Terraform block, required providers, `provider "aws"` |
| `variables.tf` | Input variables (VPC CIDR, env vars) |
| `locals.tf` | Derived secrets — `DATABASE_URL` from RDS, `EVENT_BUS_NAME`/`EVENT_BUS_QUEUE_URL` from EventBridge |
| `vpc.tf` | VPC, public/private subnets (2 AZs), NAT gateway, security groups |
| `storage.tf` | RDS instances, ElastiCache clusters, EventBridge buses, SQS queues |
| `compute.tf` | ECS cluster, task definitions, services, S3 buckets for static cells |
| `network.tf` | ALB + target groups + listener rules, CloudFront |
| `secrets.tf` | Secrets Manager entries (external secrets only) |
| `iam.tf` | ECS execution/task roles, secrets read policy |
| `ecr.tf` | ECR repositories per container cell |
| `outputs.tf` | ALB DNS, ECR URLs, RDS endpoints, CloudFront domains |
| `cba-manifest.json` | Cell metadata for post-apply build/push phase |

```bash
# One command — creates infra, builds artifacts, pushes to ECR/S3, deploys ECS
npx cba up torts/marshall --env prod --adapter terraform/aws --auto-approve

# Or step by step:
npx cba deploy torts/marshall --env prod --adapter terraform/aws   # write terraform files
cd output/torts/marshall-deploy
terraform init && terraform plan                                    # review
terraform apply                                                     # create resources
```

Environment overlays work the same as docker-compose — `--env dev` uses the dev-scoped Construct configs (e.g. `db.t3.micro` instead of `db.t3.medium`). External providers (auth0, etc.) and db-cells are skipped.

---

# Validation

DNA validation operates at two levels:

## Per-layer schema validation

Each DNA document is validated against its JSON schema using `@cell/dna-validator`. This catches structural errors — missing required fields, invalid types, malformed primitives.

```bash
npx cba validate lending --layer operational   # validate one layer
npx cba validate lending                       # validate all layers
```

## Cross-layer reference validation

Cross-layer validation checks that references between DNA layers are consistent:

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

Cross-layer runs automatically as part of `cba validate` (unless scoped to a single layer with `--layer`). Programmatic access:

```typescript
import { DnaValidator } from '@cell/dna-validator'

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
| `@cell/dna-validator` | 42 | Per-schema validation, composite documents, cross-layer validation (12 tests covering all reference types) |
| `@cell/api-cell` | 68 | NestJS generators (schema, DTO, controller, service, module), Express integration (scaffold, DNA bundling, auth config), NestJS integration (full generation pipeline), **adapter conformance** (10 tests) |
| `@cell/ui-cell` | 14 | **Adapter conformance** (14 tests) |

## Adapter conformance tests

Conformance tests verify that all adapters for a given cell produce the same external surface from the same DNA input.

**API-cell** (`conformance.test.ts`): Generates all 3 adapters (NestJS, Express, Rails) into temp dirs and asserts they agree on:
- Same HTTP method + path pairs (14 endpoints)
- Same operation mappings
- Same request body fields per endpoint
- Same role-based access enforcement per capability
- OpenAPI spec covers all endpoints (Rails static spec verified)
- All produce Dockerfiles

**UI-cell** (`conformance.test.ts`): Generates all 3 adapters (Vite/React, Vite/Vue, Next/React) into temp dirs and asserts they agree on:
- Identical bundled DNA across adapters (UI, API, Operational)
- Same block types supported (form, table, detail, actions, empty-state)
- Consistent `config.json` DNA fetch paths
- All produce Dockerfiles, package.json, tsconfig.json
- All generate DNA loader and API hook/composable

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
      operational.json              # Full Operational DNA: domain, nouns, capabilities, relationships, causes, rules, outcomes, signals, equations, positions, persons, tasks, processes
      product.api.json              # Product API DNA: namespace, resources, operations, endpoints
      product.ui.json               # Product UI DNA: layout, pages, routes, blocks
      technical.json                # Technical DNA: providers, constructs, variables, cells, environments
    torts/marshall/
      operational.json              # Marshall Fire mass-tort Operational DNA (justice.masstort.marshall):
                                    #   9 Nouns (IntakeSubmission, Claimant, Claim, Incident, Property,
                                    #            Evidence, CaseStatus, Firm, Attorney)
                                    #   13 Capabilities, 20 Rules, 12 Outcomes,
                                    #   4 Signals, 2 Equations, 7 Relationships
      product.core.json             # Materialized slice — 8 nouns / 13 capabilities / 4 signals
      product.api.json              # REST surface — 7 Resources, 23 Operations, 23 Endpoints
      product.ui.json               # Public marketing site (marketing layout, intake survey block)
      product.admin.ui.json         # Staff admin SPA (universal layout, 12 pages, 36 blocks)
      technical.json                # Full stack — ui-cell, admin-ui-cell, api-cell (node/express),
                                    #             db-cell (postgres), event-bus-cell (eventbridge).
                                    # Profiles: 'marketing-only' (Phase 1) and 'default' (Phases 2+3)
      prompt.md                     # Source prompt — Sections 1–3 all reflected in DNA
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
      ui-cell/                      # Consumes Product UI DNA → UI app
        src/
          adapters/
            vite/
              docker.ts               # Shared Dockerfile, nginx.conf, .dockerignore generation
              react/                  # React adapter: JSX components, React Router, React Context
              vue/                    # Vue adapter: SFC components, Vue Router, provide/inject
      event-bus-cell/               # Consumes Signals across domains → schema registry, publishers, routing
      workflow-cell/                # (planned) Consumes Technical DNA → event workflows
  packages/                         # Shared utilities across all layers
    cba/                            # Unified CLI for the full lifecycle (discover, design, develop, deliver)
    dna-validator/                  # Validates DNA documents against JSON schemas (per-layer + cross-layer)
```

# Key Principles

- **Operational DNA has no cell.** It is validated JSON injected into Product and Technical cells as input — it is the source, not a target.
- **Primitives are unique across layers.** No primitive name is reused across Operational, Product, or Technical layers.
- **Constructs are declared once, referenced by many.** A database Construct can be shared across multiple cells without duplication.
- **Adapters bridge DNA and frameworks.** The cell engine is generic; the adapter carries all framework-specific knowledge.
- **DNA is the source of truth at every layer.** Cells must not encode domain, product, or framework logic beyond what is needed to interpret their layer's DNA.
- **JSON in, infrastructure out.** The full path from business concept to deployed software is driven by JSON documents and TypeScript engines.
- **Signals are the cross-domain contract.** Domains communicate asynchronously via Signals — named events with typed payloads. `Outcome.emits` publishes; `Cause.source: "signal"` subscribes. Two delivery patterns: **Pattern A (HTTP push)** — publisher API dispatches directly to subscriber API's `/_signals/:signalName` endpoint; **Pattern B (queue + worker)** — event bus routes to a queue, a worker process consumes and dispatches. Same handler contract, different transport.
- **A platform hosts multiple stacks.** A platform directory (e.g. `dna/lending/`) can declare multiple domain stacks (each with api-cell + ui-cell + db-cell) in one Technical DNA, sharing infrastructure like the event bus.

---

# Roadmap

See [ROADMAP.md](ROADMAP.md) for the full implementation plan — from the current proof-of-concept through multi-adapter expansion, new cells, tooling, and production readiness.
