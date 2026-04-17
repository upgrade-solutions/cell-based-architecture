# Technical Layer Agents

Agents scoped to the Technical DNA layer. Technical DNA declares *how the product is built and deployed*: cells (api, ui, db, event-bus), constructs (databases, queues, CDNs, compute), providers (AWS, Auth0), environments (dev, prod), and delivery adapters (docker-compose, terraform/aws).

Technical DNA reads **only** `product.core.json` + `product.api.json` + `product.ui.json`. It never reads `operational.json`. Cells see a product-shaped view of the domain.

## Agent: `technical-stack-designer`

Owns authoring `technical.json` for a domain.

### Scope

- Choose cell adapters (node/express, python/django, vite/react, postgres, node/event-bus, ...)
- Wire constructs — databases, queues, object storage, CDNs, compute, load balancers
- Declare providers and environments (dev overlays, prod overlays)
- Map signal dispatch config (which cell subscribes to which signal) for Pattern A HTTP push

### Inputs

- `product.core.json` + `product.api.json` + `product.ui.json`
- Domain-specific prompt (stack preferences, cloud target, dev vs prod expectations)
- Catalog of available cells (below) and construct categories from `@dna/core/schemas/technical/`

### Outputs

- **`technical.json`** at the target domain directory
- Must validate against `@dna/core/schemas/technical/technical.json`
- Must pass cross-layer validation (product.core ↔ technical) via `cba validate`

### Must not touch

- **Operational or product layers** — if a noun/capability/endpoint is missing, that's an upstream fix. Do not paper over with technical config.
- **Generated cell output** — `output/<platform>-*/` is owned by per-cell agents during `cba develop`.

### Hand-off

When `technical.json` validates, dispatch to the per-cell agents listed below via `cba develop <platform>`. The develop command walks each cell in `technical.json` and invokes the matching cell's agent to generate its output.

---

## Per-cell agent index

Each cell has its own `AGENTS.md` file. The per-cell agent owns:

- Calling `cba develop <platform> --cell <name>` for its cell
- Selecting and validating the adapter specified in technical DNA
- Iterating on generated output when generation fails or produces invalid code
- Reporting success/failure back up to `technical-stack-designer` or the orchestrating domain agent

| Cell | Source | Agent contract |
|------|--------|----------------|
| `api-cell` | `technical/cells/api-cell/` | [`technical/cells/api-cell/AGENTS.md`](cells/api-cell/AGENTS.md) |
| `ui-cell` | `technical/cells/ui-cell/` | [`technical/cells/ui-cell/AGENTS.md`](cells/ui-cell/AGENTS.md) |
| `db-cell` | `technical/cells/db-cell/` | [`technical/cells/db-cell/AGENTS.md`](cells/db-cell/AGENTS.md) |
| `event-bus-cell` | `technical/cells/event-bus-cell/` | [`technical/cells/event-bus-cell/AGENTS.md`](cells/event-bus-cell/AGENTS.md) |

---

## Invariants

1. **Product core is the contract**. Technical DNA never imports, requires, or validates against `operational.json`.
2. **One technical.json per platform**. A platform (e.g. `dna/lending/`) can declare multiple cells of the same type — for example, `ui-cell-public` and `ui-cell-admin` both using the `vite/react` adapter but targeting different Product UI surfaces.
3. **Adapters are swappable**. Swapping `python/django` for `node/nestjs` in `technical.json` is a legitimate operation — the upstream DNA must not change as a result. This is what makes the demo's "swap the stack" moment work.
4. **Delivery adapters live separately**. `terraform/aws`, `docker-compose`, `aws-sam` are owned by `packages/cba/src/deliver/adapters/` — not cells. Cells produce deployable artifacts; delivery adapters wire them into environments.
