# Roadmap

This document outlines the implementation plan for cell-based architecture — from the current proof-of-concept through a fully deployable, multi-domain system.

---

## Phase 1: Foundation (Complete)

Establish the core architecture, DNA language, and a working reference cell.

- [x] Define the three DNA layers (Operational, Product, Technical)
- [x] Author JSON schemas for all Operational primitives (Noun, Verb, Capability, Attribute, Domain, Trigger, Policy, Rule, Effect, Flow)
- [x] Author JSON schemas for all Product primitives (Resource, Action, Operation, Layout, Page, Route, Block, Field, Namespace, Endpoint, Schema, Param)
- [x] Author JSON schemas for all Technical primitives (Environment, Cell, Construct, Provider, Variable, Output)
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
- [ ] **api-cell: real database integration** — wire Drizzle migrations and seed data into generated output; currently handlers use in-memory stores
- [ ] **api-cell: auth middleware** — generate real JWT/Auth0 verification from Policy DNA (currently stubbed guards)
- [ ] **api-cell: validation** — generate request validation from Attribute constraints (required, type, enum values)
- [ ] **dna-validator: cross-layer validation** — verify Product DNA references valid Operational Nouns/Verbs, Technical DNA references valid Product resources
- [ ] **Testing** — add generation tests for both api-cell adapters; add runtime integration tests for generated output

---

## Phase 3: New Cells

Build the planned cells that extend the architecture beyond API and UI.

- [ ] **auth-cell** — reads Policies and Constructs from Technical DNA, generates authorization middleware (Auth0, Clerk, custom JWT)
- [ ] **workflow-cell** — reads Triggers, Flows, and Effects from Operational DNA, generates event-driven workflows (queues, scheduled jobs, chained capabilities)
- [ ] **infra-cell** — reads Technical DNA Constructs/Providers/Environments, generates IaC (Terraform, CDK, Pulumi) for the full deployment topology

---

## Phase 4: Multi-Adapter Expansion

Broaden the adapter ecosystem so the same DNA can target different stacks.

- [ ] **api-cell: `ruby/rails` adapter** — generate a Rails API from the same Product API DNA
- [ ] **api-cell: `python/fastapi` adapter** — generate a FastAPI app from the same Product API DNA
- [ ] **ui-cell: `vite/vue` adapter** — generate a Vue UI from the same Product UI DNA
- [ ] **ui-cell: `next/react` adapter** — generate a Next.js app with SSR/SSG from Product UI DNA
- [ ] **Adapter conformance tests** — ensure all adapters for a given cell produce the same external surface (same OpenAPI spec, same routes, same behavior)

---

## Phase 5: Tooling and Developer Experience

Make the system easy to adopt, extend, and operate.

- [ ] **CLI** — unified `cell` CLI for generating, validating, running, and deploying (`cell generate`, `cell validate`, `cell run`, `cell deploy`)
- [ ] **DNA editor / visual designer** — browser-based tool for authoring DNA without writing JSON by hand
- [ ] **Diff and preview** — show what will change in generated output before regenerating (like `terraform plan`)
- [ ] **Live dev mode** — run all cells locally with hot-reload across DNA changes (extend the Express adapter's watch pattern to all cells)
- [ ] **Documentation generation** — auto-generate domain glossaries, API docs, and architecture diagrams from DNA

---

## Phase 6: Multi-Domain and Production Readiness

Scale from a single reference domain to a production-grade platform.

- [ ] **Second reference domain** — build a second DNA set (e.g. e-commerce, HR) to validate the architecture generalizes beyond lending
- [ ] **Cell composition** — enable cells to reference outputs from other cells (e.g. UI cell reads API cell's base URL output)
- [ ] **Environment-scoped generation** — generate environment-specific configs, secrets, and resource sizing from Technical DNA
- [ ] **CI/CD integration** — DNA change triggers regeneration, tests, and deployment in a pipeline
- [ ] **Versioning and migration** — handle DNA schema evolution, backward compatibility, and generated output migration
