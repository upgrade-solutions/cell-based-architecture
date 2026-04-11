# Prompt: Marshall Fire Mass Tort — Cell-Based Architecture Demo

## Meta

This file is the **starting prompt** for generating a full cell-based architecture for a new mass tort covering the **Marshall Fire** (Boulder County, Colorado — December 30, 2021). The fire destroyed over 1,000 homes across Superior, Louisville, and unincorporated Boulder County, making it the most destructive wildfire in Colorado history.

The goal of this demo (for an AWS meetup) is to show the path from **a natural-language prompt → three-layer DNA → fully deployed AWS architecture**, with every step driven by the cell-based architecture system in this repo.

**Iterate on this prompt** — each section below is fed (in order) into the DNA generation pipeline. Refining the prompt is how we refine the generated system.

---

## Pipeline

```
prompt.md
  │
  ├─► [Section 1: Research] ──► operational.json   (domain, nouns, capabilities, rules, lifecycles, signals)
  │                             └─► agent: operational-dna-architect (see operational/AGENTS.md)
  │
  ├─► [Section 2: Surfaces] ──► product.core.json  (self-contained slice of operational DNA)
  │                             product.api.json   (REST endpoints, references product.core only)
  │                             product.ui.json    (public web, intake form, admin)
  │                             └─► agents: product-core-materializer, product-api-designer,
  │                                         product-ui-designer (see product/AGENTS.md)
  │
  └─► [Section 3: Stack]    ──► technical.json     (cells, constructs, providers, environments —
                                                    references product.core + product.api/ui only)
                                     │
                                     ├─► agent: technical-stack-designer (see technical/AGENTS.md)
                                     │
                                     └─► cba develop torts/marshall
                                         cba deploy  torts/marshall --env prod --adapter terraform/aws
                                             │
                                             └─► per-cell agents dispatch the actual work:
                                                 api-cell-agent, ui-cell-agent, db-cell-agent,
                                                 event-bus-cell-agent (see technical/cells/*/AGENTS.md)
```

---

## Architectural conventions this flow depends on

Two cross-cutting pieces underlie the pipeline above. Both are tracked in `ROADMAP.md` Phase 5b as prerequisites for this demo.

### AGENTS.md at every concern boundary

**Rule**: if it's a separate concern, create an `AGENTS.md` file.

- `operational/AGENTS.md` — how to spawn agents that translate research into Operational DNA (primitives, schemas, cross-layer validation)
- `product/AGENTS.md` — how to spawn agents that materialize `product.core.json`, design API surfaces, and design UI surfaces from a settled Operational DNA
- `technical/AGENTS.md` — how to spawn the stack designer, and an index of per-cell agents
- `technical/cells/<cell>/AGENTS.md` — per-cell agent responsible for calling `cba develop --cell <name>`, selecting adapters, iterating on generated output, and reporting back up. There's one of these for every cell type (api-cell, ui-cell, db-cell, event-bus-cell).
- `dna/torts/marshall/AGENTS.md` — domain-specific agent for this demo (knows the research sources, the prompt, and which of the above layer agents to spawn at each stage)

Each `AGENTS.md` is a prompt-level contract: *given this DNA layer (or this cell), here's what you can do, what you must not touch, and how to hand off to the next agent.*

### `product.core.json` — product layer inherits from operational, technical inherits from product

The current architecture has technical DNA reading operational DNA directly (via cross-layer validation). That's fine for a single domain but leaks the operational schema into places that shouldn't care. The fix:

- **`product.core.json`** — a new per-platform file that contains a **self-contained slice of operational DNA**: the Nouns, Capabilities, Attributes, Signals, and Relationships actually referenced by `product.api.json` and `product.ui.json`. It's materialized from `operational.json` by the product layer.
- **Technical DNA no longer reads operational DNA.** It reads only `product.core.json` + `product.api.json` + `product.ui.json`. Cells see a product-shaped view of the domain.
- **Single source of truth is still operational.json.** Product core is a derived artifact — regenerated whenever operational DNA changes — but downstream layers treat it as authoritative within their scope.

This is the same layering principle as database views: operational DNA is the base table, product.core is a view, technical DNA queries the view.

---

## Section 1 — Operational DNA (Research-Driven)

**Driver**: `operational/AGENTS.md` → spawns an operational-dna-architect agent that owns this section.

**Task**: Research mass-tort litigation operations and translate them into Operational DNA primitives (Noun, Verb, Capability, Attribute, Domain, Cause, Rule, Outcome, Lifecycle, Signal, Equation, Relationship).

**Reference sources** — study these to understand the real-world domain:

1. **LA Fire Justice** — https://www.lafirejustice.com/
   - Intake workflow for Eaton Fire / Palisades Fire plaintiffs
   - Claim categories (real property, personal property, business loss, personal injury, wrongful death, evacuation/nuisance)
   - Qualifying criteria and evidence requirements

2. **Maui Wildfire Cases** — https://www.mauiwildfirecases.com/
   - Multi-firm coordination model
   - Claimant intake form structure (contact info, damage type, insurance status, residency proof)
   - Case status tracking through settlement phases

3. **Marshall Fire specifics** — Boulder County, CO, Dec 30 2021
   - Known defendants: Xcel Energy (power line ignition theory), religious organization with smoldering debris on the property of origin, potential failure-to-maintain claims
   - Affected areas: Superior, Louisville, unincorporated Boulder County
   - ~1,084 homes destroyed, ~149 damaged
   - Statute of limitations and class certification considerations

### Operational DNA to produce

**Domain**: `justice.masstort.marshall` (hierarchy under a `justice` root, `masstort` sub-namespace, `marshall` leaf domain)

**Core Nouns** (expect ~6–10):
- `Claimant` — a person filing a claim
- `Claim` — a specific cause of action tied to a Claimant (property, injury, business loss, etc.)
- `Incident` — the Marshall Fire event itself (single instance, singleton-ish)
- `Property` — a real-property address within the affected zone
- `Evidence` — supporting documents (insurance policies, photos, damage assessments, receipts)
- `IntakeSubmission` — the raw form submission before it becomes a Claimant
- `CaseStatus` — milestone records for case progression (intake → reviewed → qualified → filed → settled)
- `Firm` — participating law firm (supports multi-firm coordination pattern from Maui)
- `Attorney` — an individual attorney assigned to a Claimant

**Core Capabilities** (verbs per noun — start with these, let research expand):
- `IntakeSubmission.Submit` (public, no auth)
- `IntakeSubmission.Qualify` → transitions to `Claimant.Register`
- `Claimant.Register`, `Claimant.View`, `Claimant.Assign`
- `Claim.File`, `Claim.Review`, `Claim.UpdateStatus`
- `Evidence.Upload`, `Evidence.Verify`
- `CaseStatus.Advance`
- `Firm.Onboard`, `Attorney.Assign`

**Key Rules**:
- Access rules — public can `Submit`, only attorneys/intake staff can `Qualify`/`Review`
- Condition rules — address must fall within affected Boulder County zones; filing deadline (statute of limitations) must not be passed
- Residency verification for property-damage claims

**Lifecycles**:
- `IntakeSubmission`: `submitted → under_review → qualified | rejected`
- `Claimant`: `registered → assigned → active → settled | withdrawn`
- `Claim`: `draft → filed → under_review → settled | dismissed`

**Signals** (for cross-domain / async processing):
- `marshall.IntakeSubmission.Received` — emitted on submit, triggers internal review queue
- `marshall.Claimant.Qualified` — emitted when intake promotes to claimant, triggers attorney assignment
- `marshall.Claim.Filed` — emitted for downstream court-filing integration

**Equations** (technology-agnostic computations):
- `days_since_incident` — for statute-of-limitations checks
- `estimated_claim_value` — rough bucket based on damage type + property assessment

---

## Section 2 — Product DNA (Surfaces)

**Driver**: `product/AGENTS.md` → spawns three agents in sequence:
1. **product-core-materializer** — reads `operational.json`, produces `product.core.json` (self-contained slice of operational DNA actually referenced by product surfaces)
2. **product-api-designer** — produces `product.api.json`, references only `product.core.json`
3. **product-ui-designer** — produces `product.ui.json`, references only `product.core.json`

**Task**: Generate `product.core.json`, `product.api.json`, and `product.ui.json` from the Operational DNA above. Two product surfaces are required:

### 2a. Product API DNA (`product.api.json`)

Namespace: `marshall` (served under `/marshall/*`)

**Endpoints** (derived from Capabilities):
- `POST /marshall/intake` → `IntakeSubmission.Submit` (public, unauthenticated)
- `GET /marshall/intakes` → `IntakeSubmission.List` (staff only)
- `PATCH /marshall/intakes/:id/qualify` → `IntakeSubmission.Qualify`
- `GET /marshall/claimants` → `Claimant.List`
- `GET /marshall/claimants/:id` → `Claimant.View`
- `POST /marshall/claimants/:id/claims` → `Claim.File`
- `PATCH /marshall/claims/:id/status` → `Claim.UpdateStatus`
- `POST /marshall/claims/:id/evidence` → `Evidence.Upload` (multipart)
- `GET /marshall/firms`, `POST /marshall/firms/:id/attorneys` → firm/attorney admin

**Schemas**: one per Noun, derived from Attributes. Pay special attention to:
- `IntakeSubmission` must accept all fields a public user would provide in one shot — contact info, property address, damage type(s), insurance carrier, residency proof URLs
- `Evidence` supports multipart upload with file metadata
- Address fields should support validation against the affected-zone geocoded list

### 2b. Product UI DNA (`product.ui.json`)

Two UI surfaces — both generated from the same product UI schema but with different layouts and route sets:

**Surface 1: Public Web Presence** (layout: `marketing` or `universal` with public mode)
- **Home page** — hero section explaining the Marshall Fire litigation, eligibility, firm credentials
- **Eligibility page** — detailed criteria, affected zones, evidence requirements
- **Intake form page** — the `IntakeSubmission.Submit` form (multi-step form with validation)
- **FAQ page** — content page, static blocks
- **Contact page** — fallback contact form / phone / email

**Surface 2: Staff Admin** (layout: `universal` with nested nav)
- **Intake queue** — list + detail view of `IntakeSubmission`, qualify/reject actions
- **Claimants** — list, detail, assign attorney
- **Claims** — list, detail, status updates, evidence upload
- **Firms / Attorneys** — admin CRUD
- Protected by auth (see Section 3)

---

## Section 3 — Technical DNA (Stack + Deployment)

**Driver**: `technical/AGENTS.md` → spawns the technical-stack-designer to produce `technical.json`, then dispatches per-cell agents (`technical/cells/<cell>/AGENTS.md`) during `cba develop`.

**Inputs**: `product.core.json` + `product.api.json` + `product.ui.json` only. This layer does not read `operational.json` directly — product core is the contract.

**Task**: Generate `technical.json` declaring the cells, constructs, providers, and environments needed to deploy the above to AWS.

### Cells

| Cell | Adapter | Output |
|------|---------|--------|
| `api-cell` | **`python/django`** (new adapter — to be built) | Django REST Framework API, Postgres-backed |
| `ui-cell-public` | `vite/react` | Static React SPA for public web presence |
| `ui-cell-admin` | `vite/react` | Static React SPA for staff admin |
| `db-cell` | `postgres` | Postgres schema + roles + migrations |
| `event-bus-cell` | `node/event-bus` | Signal registry + publishers for cross-cell events |

**Future swap (Phase 2 of demo)**: replace `python/django` with `node/nestjs` adapter, regenerate, redeploy — demonstrating that the operational and product DNA remain unchanged when the implementation stack changes. This is the "prove the abstraction" moment for the meetup audience.

### Constructs

- `primary-db` — `storage/database` (Postgres 15); RDS for prod, local Postgres for dev
- `event-bus` — `storage/queue` (SNS+SQS prod / RabbitMQ dev)
- `evidence-bucket` — `storage/object` (S3 for prod, Minio or local FS for dev) — for multipart `Evidence.Upload`
- `public-cdn` — `network/cdn` (CloudFront + S3 for the public React app)
- `admin-cdn` — `network/cdn` (CloudFront + S3 for the admin React app)
- `api-service` — `compute/container` (ECS Fargate running the Django API)
- `api-gateway` — `network/loadbalancer` (ALB in front of the API service)

### Providers

- `aws` — `region: us-west-2` (Colorado-adjacent)
- `auth0` (or equivalent) — for staff admin auth; public intake does not require auth

### Environments

- `dev` — docker-compose overlays (Postgres, RabbitMQ, Minio, Django dev server, Vite dev servers)
- `prod` — terraform/aws overlays (RDS, SNS+SQS, S3, CloudFront, ECS Fargate, ALB, ACM, Route 53)

### Delivery adapters needed

- `docker-compose` — already built, needs `storage/object` (Minio) support
- `terraform/aws` — already built for RDS, ECS, ALB, S3+CloudFront; needs SNS+SQS (already done in Phase 3c) and `storage/object` wiring

---

## Success Criteria for the AWS Meetup Demo

1. **Prompt to DNA** — running the prompt through our pipeline produces valid `operational.json`, `product.api.json`, `product.ui.json`, `technical.json` that pass `cba validate`.
2. **DNA to Code** — `cba develop torts/marshall` generates a Django API, two React apps, an event-bus client, and a Postgres schema without errors.
3. **Code to Cloud** — `cba deploy torts/marshall --env prod --adapter terraform/aws` provisions the full stack on AWS and returns a public URL for the intake form and the admin app.
4. **Live intake** — audience members can submit a mock intake from their phones; the submission appears in the admin app; a signal fires through the event bus.
5. **The swap** — change one line in `technical.json` (`python/django` → `node/nestjs`), rerun `cba develop` + `cba deploy`, demonstrate the same functional system on a different stack.

---

## Notes for the Prompt-to-DNA Iteration

- **Do not hand-author the DNA files.** Feed this prompt + the referenced web sources into the pipeline and let the system generate them. Hand-edit only when the generator gets something clearly wrong — and when it does, update this prompt so the next run produces the right thing.
- **Operational DNA is the longest iteration loop.** Most refinement happens in Section 1 as we discover new nouns/capabilities from the reference sites.
- **Product DNA is mostly mechanical** once Operational is settled — `product.core.json` is materialized automatically from operational, then endpoints map to capabilities and UI pages map to resources + actions.
- **Technical DNA is the shortest iteration loop** — it's mostly stack/construct choices, not business logic. Technical DNA only sees product core + product api/ui — it never reads operational DNA.
- **Never skip the layer agents.** Each layer has an `AGENTS.md` file that defines its contract. If you bypass a layer agent and hand-author DNA, you break the prompt-to-deploy promise — and the meetup demo stops being reproducible.
