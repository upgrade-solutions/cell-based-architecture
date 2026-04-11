# Marshall Fire Domain Agent

Domain-specific orchestrating agent for the **Marshall Fire mass-tort demo** — the AWS meetup deliverable. Owns the end-to-end flow from `prompt.md` to a deployed three-layer stack on AWS.

## Scope

This is a *meta-agent* — it does not produce DNA itself. It reads `prompt.md`, dispatches the layer and cell agents in the correct order, and reports back to the user after each milestone.

## Inputs

- `dna/torts/marshall/prompt.md` — the research brief, pipeline diagram, and per-layer task lists
- The reference sources named in the prompt (LA Fire Justice, Maui Wildfire Cases, Marshall Fire news/case coverage)
- Existing DNA under `dna/torts/marshall/` — the agent edits in place as iterations refine the output

## Outputs

At full maturity, this directory will contain:

- `operational.json`
- `product.core.json`
- `product.api.json`
- `product.ui.json`
- `technical.json`

And under `output/` (after `cba develop` + `cba deploy`):

- `torts-marshall-api/` (Django REST Framework — eventually swappable to NestJS)
- `torts-marshall-ui-public/` (React SPA, marketing layout)
- `torts-marshall-ui-admin/` (React SPA, universal layout)
- `torts-marshall-db/` (Postgres schema + migrations)
- `torts-marshall-event-bus/` (event bus client library)

## Hand-off order

The domain agent dispatches layer and cell agents in this order:

1. **`operational-dna-architect`** (see `operational/AGENTS.md`)
   Reads `prompt.md` Section 1 and the referenced mass-tort sites. Produces `operational.json`. Hand back on `cba validate --layer operational` passing.

2. **`product-core-materializer`** → **`product-api-designer`** → **`product-ui-designer`** (see `product/AGENTS.md`)
   Reads `prompt.md` Section 2 + `operational.json`. Produces `product.core.json`, then `product.api.json`, then `product.ui.json`. Hand back on `cba validate` passing across the product layer.

3. **`technical-stack-designer`** (see `technical/AGENTS.md`)
   Reads `prompt.md` Section 3 + the product layer. Produces `technical.json`. Hand back on full cross-layer validation passing.

4. **Per-cell agents** (see `technical/cells/*/AGENTS.md`)
   `cba develop dna/torts/marshall` walks `technical.json` and dispatches each cell's agent. Expected cells:
   - `api-cell` with `python/django` adapter (blocked on adapter availability — see Phase 5b)
   - `ui-cell-public` with `vite/react` adapter, `marketing` layout (blocked on marketing layout)
   - `ui-cell-admin` with `vite/react` adapter, `universal` layout
   - `db-cell` with `postgres` adapter
   - `event-bus-cell` with `node/event-bus` adapter (engine: `rabbitmq` in dev, `sns+sqs` in prod)

5. **Delivery**
   - `cba deploy torts/marshall --env dev --adapter docker-compose` — audience can `curl` the local stack
   - `cba deploy torts/marshall --env prod --adapter terraform/aws` — the live meetup URL

## Known blockers

The prompt's success criteria are blocked on several Phase 5b prerequisites:

- **`python/django` adapter** — not yet built; must be added alongside the existing `python/fastapi` adapter
- **`marketing` layout** — listed under Phase 5a "Future Layouts"; needed for the public surface
- **`storage/object` Construct** — needed for `evidence-bucket` (Minio dev → S3 prod) and multipart `Evidence.Upload`
- **`product.core.json` across all cells** — the materializer and per-cell updates must land before this demo's flow is reproducible
- **All AGENTS.md contracts** — must land so the layer and cell agents can be spawned in order

These are all tracked in `ROADMAP.md` Phase 5b.

## Demo script hand-off

When all blockers clear, the domain agent drives the five-act meetup demo:

1. **Prompt → DNA** — open `prompt.md`, run the pipeline, show the three layers materialize
2. **DNA → Code** — `cba develop dna/torts/marshall`
3. **Code → Cloud** — `cba deploy dna/torts/marshall --env prod --adapter terraform/aws`
4. **Live intake** — audience submits mock intakes from phones; admin surface shows them; signals fire
5. **The swap** — change `python/django` → `node/nestjs` in `technical.json`, regenerate, redeploy, prove the abstraction holds

## Must not touch

- Layer schemas (`operational/schemas/`, `product/schemas/`, `technical/schemas/`) — changes there affect every domain
- Other domains under `dna/` — this agent is scoped to `torts/marshall/` only
- Cell generators — if the `python/django` adapter is missing, escalate to the user; do not hand-author Django code
