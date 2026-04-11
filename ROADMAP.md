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
- [ ] **DNA editor / visual designer** — browser-based tool for authoring DNA without writing JSON by hand
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
- [ ] **Marketing** — full-width, header nav, hero sections, footer
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

- [ ] **`operational/AGENTS.md`** — operational-dna-architect agent contract. Owns Noun/Verb/Capability/Attribute/Domain/Cause/Rule/Outcome/Lifecycle/Signal/Equation/Relationship. Inputs: domain research. Outputs: a valid `operational.json` that passes `cba validate`.
- [ ] **`product/AGENTS.md`** — defines three sequenced agents:
  - `product-core-materializer` — reads `operational.json`, produces `product.core.json`
  - `product-api-designer` — produces `product.api.json` from `product.core.json`
  - `product-ui-designer` — produces `product.ui.json` from `product.core.json`
- [ ] **`technical/AGENTS.md`** — technical-stack-designer agent contract (produces `technical.json`) plus an index of per-cell agents that dispatch during `cba develop`
- [ ] **`technical/cells/<cell>/AGENTS.md`** — one per cell type. Each agent owns its cell's CLI invocation (`cba develop --cell <name>`), adapter selection, generated-output iteration, and failure reporting. Initial set: `api-cell`, `ui-cell`, `db-cell`, `event-bus-cell`.
- [ ] **`dna/torts/marshall/AGENTS.md`** — domain-specific agent that orchestrates the five layer/cell agents for this demo. Knows the prompt sections, the research sources, and the hand-off order.
- [ ] **`cba agent` CLI** — new subcommand that spawns the agent described by a given `AGENTS.md` file (`cba agent operational/AGENTS.md`, `cba agent technical/cells/api-cell/AGENTS.md`)

#### Product core — `product.core.json` as the product/technical interface

Today, technical DNA and cells read operational DNA directly via cross-layer validation. That leaks operational primitives into places that should only see the product surface. Product core fixes this: technical DNA reads **only** `product.core.json` + `product.api.json` + `product.ui.json`, and operational DNA becomes invisible downstream of product.

- [ ] **`product/schemas/core.json`** — new schema for the self-contained product-core document. Contains the slice of operational DNA (Nouns, Capabilities, Attributes, Signals, Relationships) actually referenced by product primitives.
- [ ] **`product-core-materializer` agent** — reads `operational.json`, walks `product.api.json` and `product.ui.json` for references, and emits `product.core.json` with the transitive closure of everything referenced.
- [ ] **`cba develop` integration** — materializes `product.core.json` automatically before each cell runs; regenerated whenever `operational.json` changes.
- [ ] **Cells read product core, not operational** — update `api-cell`, `ui-cell`, `db-cell`, and `event-bus-cell` adapters to load `product.core.json` in place of `operational.json`. Signal middleware, routing, and payload extraction all reference product core.
- [ ] **Cross-layer validation migration** — move `dna-validator` cross-layer rules from `operational ↔ technical` to `operational ↔ product.core` (upstream) and `product.core ↔ technical` (downstream). Technical layer tests no longer load operational DNA.
- [ ] **Backfill existing platforms** — generate `product.core.json` for `dna/lending/` and verify the lending stack still builds and deploys unchanged.

### Prompt → Operational DNA

- [ ] Research extraction — build a pipeline that takes `prompt.md` + the referenced mass-tort sites (LA Fire Justice, Maui Wildfire Cases) and produces candidate Nouns, Capabilities, Rules, Lifecycles, and Signals
- [ ] Generate `dna/torts/marshall/operational.json` — domain `justice.masstort.marshall`, full Noun set (Claimant, Claim, Incident, Property, Evidence, IntakeSubmission, CaseStatus, Firm, Attorney)
- [ ] Author reference Signals — `marshall.IntakeSubmission.Received`, `marshall.Claimant.Qualified`, `marshall.Claim.Filed`
- [ ] Author Rules — public intake access, staff-only qualify/review, affected-zone validation, statute-of-limitations checks
- [ ] Validate with `cba validate` cross-layer checks

### Prompt → Product DNA

- [ ] Generate `dna/torts/marshall/product.api.json` — public intake endpoints (unauthenticated) plus authenticated staff admin endpoints for intake queue, claimants, claims, evidence, firms, attorneys
- [ ] Generate `dna/torts/marshall/product.ui.json` with two surfaces:
  - **Public web presence** — home, eligibility, intake form, FAQ, contact (marketing layout)
  - **Staff admin** — intake queue, claimants, claims, firms/attorneys (universal layout with nested nav, protected by auth)
- [ ] Multi-step intake form — the public intake is the demo's most visible feature; must handle contact info, property address, damage type(s), insurance status, residency proof

### Prompt → Technical DNA

- [ ] Generate `dna/torts/marshall/technical.json` declaring:
  - `api-cell` with `python/django` adapter
  - `ui-cell-public` (vite/react, static, marketing layout)
  - `ui-cell-admin` (vite/react, static, universal layout)
  - `db-cell` (postgres)
  - `event-bus-cell` (node/event-bus)
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
