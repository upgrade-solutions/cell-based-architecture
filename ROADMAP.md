# Roadmap

This document outlines the implementation plan for cell-based architecture — from the current proof-of-concept through a fully deployable, multi-domain system.

---

## Phase 1: Foundation (Complete)

Establish the core architecture, DNA language, and a working reference cell.

- [x] Define the three DNA layers (Operational, Product, Technical)
- [x] Author JSON schemas for all Operational primitives (Noun, Verb, Capability, Attribute, Domain, Cause, Rule, Outcome, Lifecycle, Equation)
- [x] Author JSON schemas for all Product primitives (Resource, Action, Operation, Layout, Page, Route, Block, Field, Namespace, Endpoint, Schema, Param)
- [x] Author JSON schemas for all Technical primitives (Environment, Cell, Construct, Provider, Variable, Output, Script)
- [x] Build `dna-validator` package — validates DNA documents against schemas
- [x] Write reference DNA for the Lending domain (`dna/lending/`)
- [x] Build `api-cell` with `node/nestjs` adapter — static code generation (controllers, services, DTOs, Drizzle schema)
- [x] Build `api-cell` with `node/express` adapter — dynamic runtime interpreter with hot-reload
- [x] Scaffold `ui-cell` with `vite/react` adapter — generates React pages, blocks, and layout from UI DNA
- [x] Generate reference outputs: `lending-api-nestjs/`, `lending-api/`, `lending-ui/`

---

## Phase 2: Cell Completeness

Flesh out existing cells and close gaps in the current implementation.

- [x] **ui-cell: full generation** — move from scaffold to complete generation (routing, data fetching, form submission, error handling)
- [x] **api-cell: real database integration** — wire Drizzle migrations and seed data into generated output; currently handlers use in-memory stores
- [x] **api-cell: auth middleware** — generate IDP-agnostic JWKS verification from Rule (access) DNA, with configurable role claim and ownership enforcement
- [x] **api-cell: validation** — generate request validation from Attribute constraints (required, type, enum values)
- [x] **dna-validator: cross-layer validation** — verify Product DNA references valid Operational Nouns/Verbs, Technical DNA references valid Product resources
- [x] **Testing** — add generation tests for both api-cell adapters; add runtime integration tests for generated output

---

## Phase 3: New Cells

Build the planned cells that extend the architecture beyond API and UI.

> **Note:** Infrastructure is not a cell. Cells produce deployable artifacts (API, UI, DB, worker, event bus, etc.). The deployment topology (Constructs, Providers, Environments) lives in Technical DNA and is consumed by `cba deploy` via delivery adapters — see Phase 5.

### Phase 3a: Event Bus Foundation (Schemas + DNA)

Introduce the `Signal` primitive and extend existing primitives to support cross-domain event-driven communication. A Signal is a named domain event published after a Capability executes — it crosses domain boundaries and carries a typed payload contract.

- [x] Define `Signal` schema (`operational/schemas/signal.json`) — name, capability, description, typed payload fields
- [x] Add `signals` array to operational composite schema (`operational/schemas/operational.json`)
- [x] Extend `Outcome` schema with `emits` field — array of Signal names published when outcome completes (cross-domain, async; distinct from `initiates` which is intra-domain, sync)
- [x] Extend `Cause` schema with `source: "signal"` and `signal` field — subscribe to Signals from any domain
- [x] Cross-layer validation: `Outcome.emits` references valid Signal names, `Signal.capability` references valid Capability
- [x] Author lending domain reference Signals (`lending.Loan.Disbursed`, `lending.Loan.Defaulted`) with typed payloads

### Phase 3b: Event Bus Cell

Build the `event-bus-cell` — a platform-level cell that reads Operational DNA Signals across all domains and generates event infrastructure code.

- [x] Build `event-bus-cell` (`technical/cells/event-bus-cell/`)
- [x] `node/event-bus` adapter: generates schema registry, typed publisher libraries, subscriber routing config
- [x] Publisher integration in `api-cell`: Outcome handlers call publisher when `emits` is present
- [x] Subscriber worker stub generation — skeleton consumer code for api-cells or future worker-cells

### Phase 3c: Event Bus Delivery

Wire `storage/queue` Constructs through delivery adapters so the event bus is provisionable alongside other infrastructure.

- [x] `docker-compose` adapter: handle `storage/queue` with `engine: "rabbitmq"` as a compose service (management UI on :15672)
- [x] `terraform/aws` adapter: handle `storage/queue` with `engine: "sns+sqs"` — SNS topics per Signal, SQS queues per subscriber, subscriptions + IAM policies
- [x] `EVENT_BUS_URL` variable resolution in both adapters

### Phase 3d: Signal Dispatch — HTTP Push (Pattern A)

Add cross-API signal delivery via direct HTTP. Publisher APIs dispatch signals to subscriber APIs' `/_signals/:signalName` endpoints. Subscriber URLs are configured in Technical DNA (`signal_dispatch` in adapter config).

- [x] Generate signal receiver endpoints in `api-cell` Express adapter — `POST /_signals/:signalName` routes for each Cause with `source: "signal"`
- [x] Add HTTP dispatch to signal middleware — after event bus publish, HTTP POST to configured subscriber URLs (fire and forget)
- [x] Pass `signal_dispatch` config from Technical DNA adapter config through to generated output (`dna/signal-dispatch.json`)
- [x] Signal receiver validates payload against Signal definition and dispatches to Capability handler
- [ ] Add signal receiver to NestJS, Rails, and FastAPI adapters
- [ ] Add signal dispatch to NestJS, Rails, and FastAPI signal publisher code

### Phase 3e: Signal Dispatch — Queue + Worker (Pattern B)

Replace direct HTTP delivery with durable queue-based delivery. A worker process consumes from queues and dispatches to Capability handlers — same handler contract, different transport.

- [ ] Generate standalone worker process from event-bus-cell — consumes from queues, calls Capability handlers
- [ ] Worker reuses the same signal receiver handler interface (Pattern A handlers are reusable)
- [ ] Dead-letter queue (DLQ) support for failed message handling
- [ ] Retry policy configuration in Technical DNA (max retries, backoff)
- [ ] Delivery adapter support: `docker-compose` adds worker service alongside queue; `terraform/aws` wires SQS → Lambda or ECS worker
- [ ] Technical DNA `signal_delivery` config: `"mode": "http"` (Pattern A) or `"mode": "queue"` (Pattern B) per cell

---

## Phase 4: Multi-Adapter Expansion

Broaden the adapter ecosystem so the same DNA can target different stacks.

- [x] **api-cell: `ruby/rails` adapter** — generate a Rails API from the same Product API DNA
- [x] **api-cell: `python/fastapi` adapter** — generate a FastAPI app from the same Product API DNA
- [x] **ui-cell: `vite/vue` adapter** — generate a Vue UI from the same Product UI DNA
- [x] **ui-cell: `next/react` adapter** — generate a Next.js app with SSR/SSG from Product UI DNA
- [x] **Adapter conformance tests** — ensure all adapters for a given cell produce the same external surface (same OpenAPI spec, same routes, same behavior)

---

## Phase 5: Tooling and Developer Experience

Make the system easy to adopt, extend, and operate.

- [x] **CLI** — unified `cba` CLI organized around DNA layers (`cba operational`, `cba product`, `cba technical`) plus cross-cutting commands (`cba develop`, `cba deploy`, `cba run`, `cba validate`). Every command supports `--json` for agents. Lives in `packages/cba/`.
- [ ] **`cba deploy`: delivery adapters** — replace the Phase 3 stub with real deployment. `cba deploy` reads Technical DNA (Constructs, Providers, Environments) + each Cell's generated artifacts and provisions/deploys via a delivery adapter:
  - [x] `docker-compose` — local multi-cell orchestration (built)
  - [x] `terraform/aws` — AWS IaC (VPC, RDS, ECS Fargate, ALB, S3+CloudFront, ECR, Secrets Manager) from Constructs + Providers
  - [ ] `aws-sam` — serverless-first AWS deployment for function-category Constructs
  - [ ] Future: `cdk`, `pulumi`, `terraform/gcp`
- [~] **DNA editor / visual designer** — browser-based tool for authoring DNA without writing JSON by hand. Technical viewer shipped; operational editor in progress. See **Phase 5c** below for the phased plan.
- [ ] **Layout system** — DNA-driven layout primitives that adapters generate into full shell components. See details below.

---

## Phase 5a: Layout System

DNA-driven layouts that adapters generate into fully functional application shells. Each layout is a reusable structural primitive — declared in the `layout.json` schema, configured in Product UI DNA, and generated by each adapter.

### Universal Layout (In Progress)

A general-purpose application shell that works across web and mobile, with production-ready chrome.

**Features:**
- [x] Responsive design — works on desktop and mobile viewports
- [x] Light and dark mode — theme toggle with persistence (localStorage + system preference)
- [x] Collapsible left sidebar — expand/collapse with animation, persisted state
- [x] User profile dropdown — avatar/initials, name, email, settings link, sign-out action
- [x] Tenant picker — switch between organizations/workspaces, stored in layout state
- [x] XState state machine — manages sidebar collapsed/expanded, profile dropdown open/closed, tenant picker open/closed, mobile menu open/closed as a single coordinated state chart
- [x] DNA-configurable — layout DNA can declare `features` (which chrome elements to include) and `tenants` (available tenants for the picker)
- [x] Nested sidebar navigation — `navigation` array in layout DNA defines grouped nav with expand/collapse, flyout popovers when collapsed, auto-expand on active route, flat fallback when absent
- [x] Radix UI + Tailwind CSS — all interactive components use Radix primitives (DropdownMenu, Collapsible, Sheet, Tooltip, Avatar); all styling via Tailwind with CSS custom properties
- [x] White-label theme system — `theme` object in layout DNA defines colors (24 shadcn-compatible tokens), dark mode overrides, border radius, and font family; emitted as CSS variables in `globals.css`
- [x] Full XState layout management — machine manages sidebar, dropdowns, nav groups, tenant, theme (light/dark), viewport (mobile/desktop), and feature flags
- [x] Vendor mode — primitives at `@cell/ui-cell/primitives` by default (vendored into output); set `vendorComponents: false` in adapter config to import from the workspace package instead
- [ ] Block migration — migrate FormBlock, TableBlock, DetailBlock, ActionsBlock, EmptyStateBlock from inline styles to Tailwind classes (follow-up)

**Implementation touches:**
1. `product/schemas/web/layout.json` — add `"universal"` to the type enum, add optional `features` and `tenants` properties
2. `technical/cells/ui-cell/src/adapters/vite/react/generators/scaffold.ts` — add `xstate` + `@xstate/react` to generated `package.json` dependencies
3. `technical/cells/ui-cell/src/adapters/vite/react/generators/renderer.ts` — add `rendererLayoutMachine()` (XState machine) and `rendererUniversalLayout()` (React component) generator functions
4. `technical/cells/ui-cell/src/adapters/vite/react/index.ts` — wire new generators into the output pipeline
5. `technical/cells/ui-cell/src/adapters/vite/react/generators/renderer.ts` — update `rendererLayout()` to dispatch `"universal"` type to `UniversalLayout`
6. `dna/lending/product.ui.json` — switch layout type to `"universal"` with feature config

### Future Layouts (Planned)
- [x] **Marketing** — full-width sticky header (brand + nav + optional CTA), hero section on the root route (eyebrow/title/subtitle/primary+secondary CTAs), main outlet, and footer (text + links). Schema additions: `brand`, `hero`, `footer` on Layout. Shipped for the vite/react adapter; vite/vue and next/react will land when those surfaces are needed for the Marshall Fire demo.
- [ ] **Auth** — centered card layout for login/register/forgot-password flows
- [ ] **Wizard** — step-based flow with progress indicator, back/next navigation
- [ ] **Dashboard** — grid-based layout with resizable panels and widget slots
- [ ] **Diff and preview** — show what will change in generated output before regenerating (like `terraform plan`)
- [ ] **Live dev mode** — run all cells locally with hot-reload across DNA changes (extend the Express adapter's watch pattern to all cells)
- [ ] **Documentation generation** — auto-generate domain glossaries, API docs, and architecture diagrams from DNA

---

## Phase 5b: AWS Meetup Demo — Marshall Fire Mass Tort (Prompt → Deployed)

**Deliverable**: a live demo at an AWS meetup showing the full path from a natural-language prompt to a deployed, working full-stack application on AWS. The reference domain is a mass-tort for the **Marshall Fire** (Boulder County, CO — December 30, 2021).

The starting artifact is `dna/torts/marshall/prompt.md` — a structured prompt broken into three sections (Operational research, Product surfaces, Technical stack) that feeds each DNA layer in order. Iteration happens on the prompt, not on the generated DNA.

### Architectural prerequisites

Two cross-cutting pieces land first because the demo's prompt-to-deploy flow depends on them. Both become available to every domain, not just Marshall.

#### Agent orchestration — `AGENTS.md` at every concern boundary

**Rule**: if it's a separate concern, create an `AGENTS.md` file. Each file is a prompt-level contract for an agent working within that scope.

- [x] **`operational/AGENTS.md`** — operational-dna-architect agent contract. Owns Noun/Verb/Capability/Attribute/Domain/Cause/Rule/Outcome/Lifecycle/Signal/Equation/Relationship. Inputs: domain research. Outputs: a valid `operational.json` that passes `cba validate`.
- [x] **`product/AGENTS.md`** — defines three sequenced agents:
  - `product-core-materializer` — reads `operational.json`, produces `product.core.json`
  - `product-api-designer` — produces `product.api.json` from `product.core.json`
  - `product-ui-designer` — produces `product.ui.json` from `product.core.json`
- [x] **`technical/AGENTS.md`** — technical-stack-designer agent contract (produces `technical.json`) plus an index of per-cell agents that dispatch during `cba develop`
- [x] **`technical/cells/<cell>/AGENTS.md`** — one per cell type. Each agent owns its cell's CLI invocation (`cba develop --cell <name>`), adapter selection, generated-output iteration, and failure reporting. Initial set: `api-cell`, `ui-cell`, `db-cell`, `event-bus-cell`.
- [x] **`dna/AGENTS.md`** (top-level meta-agent, not per-domain) — orchestrates DNA generation for any domain under `dna/`. Reads an optional `dna/<domain>/prompt.md` and dispatches the layer/cell agents in hand-off order. Replaces the earlier per-domain concept.
- [x] **`cba agent` CLI** — new subcommand that resolves the AGENTS.md contract for a given concern (`cba agent operational`, `cba agent api-cell`, `cba agent dna`). Supports layer shorthand, cell shorthand, explicit file paths, `--json` output, and a `list` mode. Spawning the actual agent is the caller's job.

#### Product core — `product.core.json` as the product/technical interface

Today, technical DNA and cells read operational DNA directly via cross-layer validation. That leaks operational primitives into places that should only see the product surface. Product core fixes this: technical DNA reads **only** `product.core.json` + `product.api.json` + `product.ui.json`, and operational DNA becomes invisible downstream of product.

- [x] **`product/schemas/product.core.json`** — new schema for the self-contained product-core document. Flat `nouns[]` at the top level plus optional `capabilities`, `causes`, `rules`, `outcomes`, `lifecycles`, `signals`, `relationships`, `equations`. Registered in the dna-validator.
- [x] **`product-core-materializer`** — `packages/cba/src/product-core.ts` walks `operational.json`, collects noun references from `product.api.json` (resources[].noun) and `product.ui.json` (pages[].resource), expands the closure via relationships, and filters downstream primitives to the surfaced capability set.
- [x] **`cba develop` integration** — `cba develop <domain>` auto-materializes `product.core.json` before each cell runs. `cba product core materialize <domain>` is the manual trigger.
- [x] **Cells read product core, not operational** — `api-cell` (express/nestjs/fastapi/rails), `ui-cell` (vite/react, vite/vue, next/react), `db-cell`, and `event-bus-cell` all load `product.core.json` in place of `operational.json`. Signal middleware, validators, routing, schema generation, and signal receivers reference product core. The Express runtime interpreter reads `src/dna/product.core.json` at startup and on hot-reload.
- [x] **Cross-layer validation migration** — `dna-validator.validateCrossLayer` accepts a `productCore` layer alongside `operational`. Product.api references resolve against product.core when present (fallback to operational when absent). New rule: every Noun/Capability/Signal in product.core must exist in operational (catches stale materializer output).
- [x] **Backfill existing platforms** — `dna/lending/product.core.json` materialized (3 nouns, 14 capabilities, 2 signals). `cba validate lending` green across all five layers; `cba develop lending` regenerates all seven cells cleanly end-to-end.

### Prompt → Operational DNA

- [ ] Research extraction — build a pipeline that takes `prompt.md` + the referenced mass-tort sites (LA Fire Justice, Maui Wildfire Cases) and produces candidate Nouns, Capabilities, Rules, Lifecycles, and Signals
- [~] `dna/torts/marshall/operational.json` — **v1 shipped** with `justice.masstort.marshall` domain and the `IntakeSubmission` noun driving the public marketing intake. Full noun set (Claimant, Claim, Incident, Property, Evidence, CaseStatus, Firm, Attorney) still to expand.
- [ ] Author reference Signals — `marshall.IntakeSubmission.Received`, `marshall.Claimant.Qualified`, `marshall.Claim.Filed`
- [~] Author Rules — **public intake access** and **affected-zone jurisdiction check** shipped with IntakeSubmission; staff-only qualify/review and statute-of-limitations checks still to add.
- [x] Validate with `cba validate` cross-layer checks — `cba validate torts/marshall` green across all 5 layers plus cross-layer

### Prompt → Product DNA

- [~] `dna/torts/marshall/product.api.json` — **v1 shipped** with `POST /marshall/intake` (public, unauthenticated, typed request + response). Staff admin endpoints (intake queue, claimants, claims, evidence, firms, attorneys) still to add as the noun set grows.
- [~] `dna/torts/marshall/product.ui.json` — **v1 shipped** as a single marketing surface: home, eligibility, intake form, FAQ using the new `marketing` layout with fire-red branding. Staff admin surface (universal layout, protected) still to add.
- [ ] Multi-step intake form — the public intake is the demo's most visible feature; must handle contact info, property address, damage type(s), insurance status, residency proof (current v1 is a single-step FormBlock bound to `IntakeSubmission.Submit`).

### Prompt → Technical DNA

- [~] `dna/torts/marshall/technical.json` — **v1 shipped** with the `ui-cell` (`vite/react`, marketing layout). Expand with:
  - `api-cell` with `python/django` adapter (once the adapter exists)
  - `ui-cell-admin` (vite/react, universal layout) once the admin surface lands
  - `db-cell` (postgres) once there's persistent data
  - `event-bus-cell` (node/event-bus) once Signals are authored
- [ ] Constructs — `primary-db` (Postgres 15 → RDS), `event-bus` (RabbitMQ → SNS+SQS), `evidence-bucket` (Minio → S3), `public-cdn` + `admin-cdn` (CloudFront+S3), `api-service` (ECS Fargate), `api-gateway` (ALB)
- [ ] Environments — `dev` (docker-compose) and `prod` (terraform/aws)

### New cell capabilities required

- [ ] **`api-cell`: `python/django` adapter** — generate a Django REST Framework API from the same Product API DNA (parallel to the existing `python/fastapi` adapter)
- [ ] **`storage/object` Construct support** — `evidence-bucket` needs multipart upload handling in both the `docker-compose` (Minio) and `terraform/aws` (S3 + presigned URLs) delivery adapters
- [ ] **Multiple ui-cells per platform** — Technical DNA must support two `vite/react` cells targeting different Product UI surfaces (public vs admin) with distinct layouts and route sets
- [ ] **Unauthenticated endpoints** — verify the auth middleware chain cleanly handles endpoints with no access Rule (public intake)
- [ ] **File upload pipeline** — generate Django views and `vite/react` form components that handle multipart `Evidence.Upload` against the `evidence-bucket` construct

### Demo flow (meetup script)

- [ ] **Act 1 — Prompt to DNA** — open `prompt.md`, show the three sections, run the pipeline, produce the three DNA layers live
- [ ] **Act 2 — DNA to Code** — `cba develop torts/marshall`, show the generated Django API, two React apps, event-bus client, Postgres schema
- [ ] **Act 3 — Code to Cloud** — `cba deploy torts/marshall --env prod --adapter terraform/aws`, show the terraform plan, apply, return public URLs
- [ ] **Act 4 — Live intake** — audience submits mock intakes from phones; staff admin shows them appearing; event bus fires a signal
- [ ] **Act 5 — The swap** — change `python/django` to `node/nestjs` in `technical.json`, regenerate, redeploy, prove the abstraction holds across stack changes

### Demo prerequisites (dependencies on other phases)

- **Architectural prerequisites above** finished — agent orchestration + product core must land before the prompt-to-deploy pipeline is reproducible
- Phase 3d finished — signal dispatch works end-to-end (live intake shows signals firing)
- Phase 5 `terraform/aws` delivery adapter hardened enough to provision the full construct set
- Phase 5a universal layout complete for the admin surface
- A `marketing` layout (listed under "Future Layouts") moved up — needed for the public surface

---

## Phase 5c: `cba-viz` — Multi-Layer DNA Editor

Evolve `cba-viz` from a read-only viewer of the derived Technical deployment graph into a full browser-based editor for all three DNA layers (Operational, Product, Technical). The end-state is a single tool where a domain author can inspect and modify Nouns, Capabilities, Rules, Resources, Endpoints, Pages, cells, constructs, and providers — all with schema-validated forms, cross-layer link visualization, and live save-back to disk (and eventually to a graph database).

**Guiding decisions:**
- **Files remain canonical through Phase 5c.2.** The editor reads and writes per-domain JSON (`operational.json`, `product.*.json`, `technical.json`) through the Vite dev middleware. This preserves CLI compatibility (`cba views`, `cba deliver`, `dna-validator`) automatically and avoids a new backend service while the editor UX is still shaking out.
- **Graph DB + GraphQL is Phase 5c.3, not day one.** Introducing Neo4j + `@neo4j/graphql` is deferred until we've seen real access patterns — multi-user editing, cross-domain queries, history. The JSON Schemas that drive form generation in earlier phases carry forward unchanged.
- **Schemas are the single source of truth** for form generation. `operational/schemas/*.json`, `product/schemas/*.json`, and `technical/schemas/*.json` already describe every primitive; RJSF (`@rjsf/core`) renders them into the inspector panel without hand-written editor code.

### Phase 5c.1: Technical viewer (Shipped)

- [x] JointJS canvas with custom shapes for cells, constructs, providers
- [x] Auto-derived deployment graph from `technical.json` via `cba views <domain> --env <env>`
- [x] Zone containers for delivery boundary (Docker / VPC) and tier (Compute / Storage)
- [x] Environment overlay support (`?env=dev|prod`), URL param sync
- [x] Live status polling for `docker-compose` and `terraform/aws` adapters (5s interval, TTL cache, in-flight dedup)
- [x] Status-driven styling: deployed (full color) → planned (grey) → proposed (dashed, dim) for both nodes and edges
- [x] Collapsible inspector sidebar, fade-in on graph re-renders
- [x] Layout write-back (drag positions → `technical.json` `views[]` overlay)
- [x] Deployed-URL ribbons on cells click through to live CloudFront / ALB

### Phase 5c.2: Operational DNA editor (Shipped — needs browser smoke test)

Bring Operational DNA into `cba-viz` — authoring Nouns, Capabilities, Rules, Outcomes, Signals, Lifecycles via a canvas + schema-driven inspector.

- [x] **Layer-agnostic load/save middleware** — `GET /api/dna/:layer/:domain` and `POST /api/dna/:layer/:domain` endpoints in `packages/cba-viz/vite.config.ts`. Atomic write (`.tmp` + rename). `GET /api/schemas/:family/:name` serves JSON schemas from the repo's layer schema directories.
- [x] **Operational types + loader** — `packages/cba-viz/src/loaders/operational-loader.ts` mirrors `operational/schemas/*.json` in TypeScript interfaces. `parseOperationalDNA`, `loadOperationalDNA` functions.
- [x] **Operational shape system** — `packages/cba-viz/src/shapes/operational/` with `NounShape` (slate rounded rect, attribute count badge), `CapabilityShape` (emerald pill, R/O badges), `RuleShape` (hexagon, amber=access / cyan=condition), `OutcomeShape` (violet rounded square), `SignalShape` (rose diamond). `ZoneContainer` gains a `domain-operational` color entry.
- [x] **Operational mapper** — `packages/cba-viz/src/mappers/operational-to-graph.ts` emits domain zones, nouns, capabilities, rule/outcome satellites, signals, and edges for `Outcome.initiates`, `Outcome.emits`, `Cause` with `source: "signal"`. Manual column-per-noun layout with saved-layout overlay support.
- [x] **`OperationalCanvas` component** — mirrors the technical canvas (paper setup, zoom, pan, fade-in). `Canvas.tsx` renamed to `TechnicalCanvas.tsx` so naming stays parallel.
- [x] **Schema-driven inspector** — `@rjsf/core@^6.4`, `@rjsf/utils`, `@rjsf/validator-ajv8` added to `packages/cba-viz/package.json`. New `SchemaForm.tsx` component loads the schema via the middleware endpoint and renders an RJSF form bound to the selected element's DNA. Dark theme via `.cba-viz-schema-form` scoped CSS overrides in `index.css`.
- [x] **Sidebar integration** — `Sidebar.tsx` branches on `dna.layer === 'operational'`: operational nodes render `<SchemaForm>`, technical nodes keep the existing hand-rolled `Field`/`Section` UI. `onChange` updates the cell attribute and triggers `model.setDirty(true)`.
- [x] **Operational persistence** — `packages/cba-viz/src/features/operational-persistence.ts` walks graph elements, mutates the original DNA by id (preserves fields we don't render), writes layout to a `layouts[]` field on the document, POSTs to `/api/dna/operational/:domain`.
- [x] **Layer switching** — toolbar tabs (`Technical` / `Operational`), URL param `?layer=`, `Ctrl+S` dispatches to `saveViews` (technical) or `saveOperational` (operational). `App.tsx` renders `TechnicalCanvas` or `OperationalCanvas` based on `layer` state.
- [ ] **Browser smoke test** — start the dev server, open `?domain=lending&layer=operational` in a browser, confirm the layout matches expectations (1 domain zone, 3 Nouns, 14 Capabilities, 16 Rules, 7 Outcomes, 2 Signals), click a capability, edit a description through the RJSF form, Ctrl+S, verify `dna/lending/operational.json` is updated on disk. Regression: `?layer=technical` still works. **Blocked on sandbox** — the sandbox used during implementation can't bind ports, so this step happens the first time the user runs `npm run dev` locally.

**Explicitly out of scope for 5c.2**: Product DNA (5c.3), cross-layer edges (5c.3), creating new Nouns/Capabilities from scratch (Phase 5c.4 UX work), lifecycle step editing (deferred), validation highlights on the canvas (errors appear in the inspector form only), multi-user editing, undo/redo, history.

### Phase 5c.3: Product DNA editor + cross-layer links (Foundation in progress)

Add Product DNA (core / api / ui) editing and the first visible cross-layer relationships in the canvas. Foundation landed alongside Phase 5c.2; the canvas and toolbar integration still to come.

- [x] **Product types + loaders** — single `packages/cba-viz/src/loaders/product-loader.ts` covers all three sub-layers because they share primitives (Resource, Field, Action, Operation). Re-exports shared Operational primitives (Noun, Capability, Rule, Outcome, etc.) so Product Core doesn't duplicate them. `parseProductCoreDNA`, `parseProductApiDNA`, `parseProductUiDNA`, and matching `loadProductXxxDNA` fetch helpers that hit `/api/dna/product-core|product-api|product-ui/:domain` (middleware already supports these layer tokens).
- [x] **Product Core canvas** — reuses operational's entire shape + mapper pipeline via a thin `productCoreToOperational` adapter that wraps the flat `nouns[]` into a synthetic single-level domain. `ProductCoreCanvas` is a one-line delegation to `OperationalCanvas`. New `product-core` layer token added to the toolbar tabs. Save is blocked with a helpful message explaining product.core.json is materialized — users should edit operational.json and re-run `cba product core materialize`.
- [x] **Product API canvas** — `ResourceShape` (indigo card), `EndpointShape` (METHOD-colored pill), namespace zone with distinct indigo palette. `productApiToGraphCells` lays out one lane per resource with endpoints stacked below. Sidebar `lookupSchema()` map extended to route namespace/resource/endpoint to their product schemas via nested paths (`product/api/endpoint`). Middleware schema endpoint + `inlineRefs()` now handle multi-segment schema paths and 3-segment `$ref` URIs like `https://dna.local/product/core/field`. Save blocked pending a follow-up `graphToProductApiDNA` helper.
- [x] **Product UI canvas** — `PageShape` (violet card showing the bound Resource), `BlockShape` (compact pill with block-type badge), layout zone with violet palette. `productUiToGraphCells` lanes pages horizontally with blocks stacked below each, matching the Noun→Capability and Resource→Endpoint patterns. Routes attach to their matching Page as inspector metadata rather than rendering as separate shapes — thin wrappers don't justify their own cells. Sidebar extended with layout/page/block schema routing.
- [x] **Product API + UI persistence** — `features/product-persistence.ts` exports `graphToProductApiDNA`, `graphToProductUiDNA`, `saveProductApi`, `saveProductUi`. Same mutate-by-id pattern as operational — preserves unrendered fields and endpoint/block identity across edits (block id parsing handles the corner case where two pages share a block name). Ctrl+S now round-trips product API and UI edits back to `product.api.json` / `product.ui.json`.
- [x] **Cross-layer view** — `CrossLayerCanvas` (new sixth canvas variant) renders a capability-centric graph spanning Operational → Product API → Product UI in three horizontal bands. `crossLayerToGraphCells` reuses all existing shapes so clicking any node opens its normal RJSF form via the sidebar's `(layer, kind)` routing. Thin dashed grey cross-layer edges with `api`/`ui` labels. Empty state with centered hint + floating `CapabilityPicker` chip in the top-left. Read-only (mixing three-layer saves from one canvas is a footgun deferred to a later phase).
- [x] **Lens / filter panel** — `CapabilityPicker` component serves this role: a single-capability lens that repopulates the cross-layer canvas on selection. `?cap=Loan.Approve` URL param persists selection across reloads.
- [x] **Schema-driven inspector forms** — reuse the Phase 5c.2 `SchemaForm` via the sidebar's existing `lookupSchema()` routing, now extended with `operation` (product-api) entries. Cross-layer nodes click through to the same RJSF forms as their home layer.
- [x] **Write-back** to `product.core.json`, `product.api.json`, `product.ui.json` via the existing `/api/dna/:layer/:domain` endpoint.

### Phase 5c.3a: Build/Run IA reframe (Shipped alongside cross-layer)

Collapse the flat layer-tab navigation into a lifecycle-centric **Build | Run** top nav with sub-tabs underneath. The user's reframe: navigation should ask *"what am I doing right now?"* not *"which file am I editing?"*. Build contains authoring (all DNA layers + cross-layer); Run contains runtime observation (deployment state + future logs/metrics/access).

- [x] **Phase + Sub types** in `Toolbar.tsx` — `Phase = 'build' | 'run'`, `BuildSub` union of 6 tabs, `RunSub` union of 4 tabs. `ALL_LAYERS` replaced with `BUILD_SUBS` / `RUN_SUBS` + default constants. `layerLabel` → `subLabel`, `isStubSub` helper.
- [x] **Two-row toolbar** — row 1 (domain · `Build`/`Run` phase tabs · env/view selectors, only when on `Run > Deployment` · zoom + save), row 2 (sub-tab strip for the active phase). Stub sub-tabs (`Logs`, `Metrics`, `Access`) render a `·` marker.
- [x] **App routing** — `App.tsx` splits `layer` state into `phase` + `sub` (plus `capabilityName` for the cross-layer URL param). `computeReadiness()` and `renderCanvas()` helpers extracted so the loading gate and canvas switch each live in one place — adding a new sub-tab is one branch.
- [x] **Status polling gated on `(phase, sub)`** — `useEffect` dep list extended, early-return when not on `run/deployment`. `Build > Technical` now shows the same `TechnicalCanvas` as `Run > Deployment` but without status polling, so topology editing isn't distracted by 5s status flips.
- [x] **Legacy URL migration** — pasted `?layer=X` links from Phase 5c.2/5c.3 translate to the equivalent `?phase=Y&sub=Z` on load, then `layer` param is dropped on the first URL sync. No broken links from old Slack messages.
- [x] **Default landing** — a first-time visitor to `?domain=lending` lands on `?phase=build&sub=operational`, the most meaningful authoring starting point, not the technical deployment graph.
- [x] **Run phase stubs** — `RunPhaseStub` generic card component for `Logs`, `Metrics`, `Access` sub-tabs. Labels each with its roadmap phase tag (Phase 5c.6 / 5c.7 / 5c.8) so the future IA stays visible.

### Phase 5c.4: Authoring (create + rename + delete)

Everything through Phase 5c.3 is *edit existing*. This phase adds the full CRUD surface.

#### Chunk 1 — Operational CRUD (Shipped)

Minimum-viable create/rename/delete for Operational DNA primitives. Proves the pattern on one layer before expanding.

- [x] **Create button** — `+ New` toolbar action visible on Build > Operational opens a `CreatePrimitiveDialog` with a type picker (Noun | Capability | Rule | Outcome) and a minimal form for the required fields. Existing nouns/capabilities populate dropdowns for the fields that reference them.
- [x] **Rename with referential integrity** — editing a Noun's `name` or a Capability's `noun`/`verb` in the RJSF form walks the operational DNA and rewrites every reference (`Capability.noun`, `Capability.name`, `Rule/Outcome/Cause.capability`, `Cause.after`, `Outcome.initiates[]`, `Signal.capability`, `Lifecycle.noun`, `Lifecycle.steps[]`, `Relationship.from`/`.to`). `operational-mutations.ts` exports `renameNoun` + `renameCapability` as pure helpers. Name-based refs are the source of truth for this chunk; stable UUIDs are a later chunk.
- [x] **Delete with cascade confirmation** — Delete/Backspace on a selected operational node opens `DeleteConfirmDialog` listing the cascade (preview via `previewCascade`), then `deleteOperationalPrimitive` removes the primary plus downstream references. Delete-a-Noun cascades its Capabilities, which cascade their Rules/Outcomes/Causes.
- [x] **Scope**: Noun, Capability, Rule, Outcome. Signal / Cause / Lifecycle / Relationship / Equation / Attribute CRUD deferred to chunk 2.

#### Chunk 2+ — Deferred

- [ ] **Stable identity strategy** — every primitive gets an opaque `_id` (UUID) on creation. Name fields become display labels that can be renamed freely without the rewrite walk. Migrate persistence to match.
- [ ] **Product-layer CRUD** — `product-api-mutations.ts` + `product-ui-mutations.ts` mirroring the operational pattern for Resources, Endpoints, Pages, Blocks.
- [ ] **Technical-layer CRUD** — authoring cells/constructs/providers from the canvas (currently edit-only via `graphToArchView`).
- [ ] **Element palette** — drag-to-add from a sidebar palette as an alternative to the `+ New` dialog. Shape determines primitive type.
- [ ] **Remaining operational primitives** — Signal, Cause, Lifecycle, Relationship, Equation, Attribute CRUD.
- [ ] **Validation surfacing on canvas** — hook the existing `dna-validator` package into the middleware; errors surface as red outlines on the offending nodes with full error messages in the inspector.
- [ ] **Undo / redo** — command stack with inverse operations. Local to the session initially; later synced through the backend.

### Phase 5c.4a: Bundle splitting (Shipped)

Initial-page weight dropped from 486 KB gzipped (monolith) to ~93 KB gzipped by combining two tactics:

- [x] **vite `manualChunks`** — `@joint/plus` → `joint` chunk (286 KB gz, ~1 MB), `@rjsf/*` + ajv → `rjsf` chunk (99 KB gz, 299 KB), react/react-dom/mobx/mobx-react-lite → `vendor` chunk (78 KB gz, 255 KB). Everything else stays in main.
- [x] **`React.lazy` canvas imports** — all six canvas components (`TechnicalCanvas`, `OperationalCanvas`, `ProductCoreCanvas`, `ProductApiCanvas`, `ProductUiCanvas`, `CrossLayerCanvas`) are code-split via `React.lazy(() => import(...))`. The canvas render site is wrapped in a `<Suspense>` with a "Loading canvas…" fallback. `joint` and `rjsf` fall into the deferred set because canvases are their only importers — opening any canvas fetches both, cached thereafter.

Per-canvas chunks are 0.43–10.64 KB each (e.g. `CrossLayerCanvas` 10.64 KB, `TechnicalCanvas` 7.62 KB, `OperationalCanvas` 0.43 KB since most of its weight is in the shared `joint-paper.ts` + operational mapper). Initial load now ships just the App shell + vendor — 93 KB gzipped.

### Phase 5c.5: Graph DB + GraphQL backend

Transition the canonical store from JSON files to Neo4j behind a GraphQL layer. Files become a derived export for CLI compatibility.

- [ ] **Schema design** — unified GraphQL schema covering all three layers with cross-layer edges as first-class relationships. Stable identity strategy from 5c.4 carries over.
- [ ] **Neo4j + `@neo4j/graphql`** service in a new `packages/cba-server/` workspace. Auto-generated mutations from the schema.
- [ ] **File importers** — one-shot CLI to load existing JSON DNA into Neo4j. Idempotent. Preserves all primitives and edges.
- [ ] **File exporters** — periodic or on-demand export from Neo4j back to JSON files so `cba views`, `cba deliver`, `cba validate`, and `dna-validator` keep working unchanged.
- [ ] **cba-viz GraphQL client** — swap the current `fetch('/api/dna/...')` calls for Apollo (or urql) queries and mutations. Loaders, mappers, shapes, and SchemaForm all reuse cleanly — only the network layer changes.
- [ ] **Subscription plumbing** — live-update the canvas when another user (or the CLI) modifies DNA. First step toward multi-user collaboration.

### Phase 5c.6: Collaboration, history, and permissions

- [ ] **Revision history** — full audit log of every DNA change, replayable in the viewer
- [ ] **Multi-user editing** — presence indicators, conflict resolution, optimistic UI via subscriptions
- [ ] **Per-domain permissions** — who can edit which layers/domains, backed by the graph DB
- [ ] **Diff view** — compare two revisions side-by-side on the canvas
- [ ] **PR-style review flow** — propose a DNA change → reviewer approves → merges to canonical graph

---

## Phase 6: Multi-Domain, Multi-Stack, and Production Readiness

Scale from a single domain stack to multiple communicating stacks within a platform, then to production-grade operations.

### Multi-stack platforms

A platform (e.g. `dna/lending/`) can host multiple domain stacks — each with its own api-cell, ui-cell, and db-cell — all declared in the same `technical.json`. Domains are expressed in Operational DNA's hierarchy; the platform's Technical DNA wires them into deployable cell stacks that share infrastructure like the event bus.

- [ ] **Second reference domain (payments)** — add `acme.finance.payments` to operational DNA with Signal subscriptions (e.g. `PaymentSchedule.Create` triggered by `lending.Loan.Disbursed`)
- [ ] **Multi-stack technical DNA** — declare multiple api-cell + ui-cell + db-cell stacks per platform alongside a shared event-bus-cell
- [ ] **Cross-domain signal validation** — `validateCrossDomain` checks that `Cause.signal` references resolve to a Signal defined in any domain within the platform
- [ ] **`cba deploy` multi-stack** — compose cells from all stacks + shared event bus into one deployment topology
- [ ] **Auto-derive `publishes-to` connections** — architecture views generate `publishes-to` connections from Signal/Cause relationships across domains

### Production readiness

- [ ] **Cell composition** — enable cells to reference outputs from other cells (e.g. UI cell reads API cell's base URL output)
- [ ] **Environment-scoped generation** — generate environment-specific configs, secrets, and resource sizing from Technical DNA
- [ ] **CI/CD integration** — DNA change triggers regeneration, tests, and deployment in a pipeline
- [ ] **Versioning and migration** — handle DNA schema evolution, backward compatibility, and generated output migration
