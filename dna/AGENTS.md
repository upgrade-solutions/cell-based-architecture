# DNA Directory Agent

Top-level orchestrator for DNA generation across any domain under `dna/`. Given a target domain (and optionally a `prompt.md` describing what to build), this agent dispatches the layer and cell agents in the correct order to produce a complete, validated, deployable stack.

This is a *meta-agent* — it does not author DNA directly. It knows the pipeline and drives the layer agents.

## Scope

- Accept a domain path (`lending`, `torts/marshall`, `acme/billing/invoicing`, etc.) that lives under `dna/`
- Optionally read a `dna/<domain>/prompt.md` brief if the domain provides one
- Dispatch the layer and cell agents in the correct hand-off order
- Report validation results back up after each milestone
- Iterate when an agent reports failure (missing adapter, invalid DNA, stale product core)

## Inputs

- `dna/<domain>/prompt.md` (optional) — a structured research brief with sections for operational, product, and technical DNA. Hand-authored; not generated. See `dna/torts/marshall/prompt.md` for the reference shape.
- Any existing DNA files under `dna/<domain>/` — the agent edits in place
- The layer and cell agent contracts in `operational/AGENTS.md`, `product/AGENTS.md`, `technical/AGENTS.md`, and `technical/cells/*/AGENTS.md`

## Outputs

After a full run, `dna/<domain>/` contains:

- `operational.json` — authored by `operational-dna-architect`
- `product.core.json` — materialized from operational by `product-core-materializer`
- `product.api.json` — authored by `product-api-designer` from product.core
- `product.ui.json` — authored by `product-ui-designer` from product.core
- `technical.json` — authored by `technical-stack-designer` from the product layer
- (optional) `prompt.md` — the brief the run started from

And under `output/<domain>-*/`, the generated cell artifacts from `cba develop <domain>`.

## Hand-off order

1. **`operational-dna-architect`** (see `operational/AGENTS.md`)
   Reads the prompt's Section 1 + any referenced external sources. Produces `operational.json`. Hand back on `cba validate <domain> --layer operational` passing.

2. **`product-core-materializer`** (see `product/AGENTS.md`)
   Runs automatically before any downstream agent — or manually via `cba product core materialize <domain>`. Produces `product.core.json` from the operational source. Re-runs whenever `operational.json` changes.

3. **`product-api-designer`** → **`product-ui-designer`** (see `product/AGENTS.md`)
   Reads the prompt's Section 2 + `product.core.json`. Each designer produces its own surface. Hand back on `cba validate <domain>` passing across the product layer.

4. **`technical-stack-designer`** (see `technical/AGENTS.md`)
   Reads the prompt's Section 3 + the full product layer. Produces `technical.json`. Hand back on full cross-layer validation passing.

5. **Per-cell agents** (see `technical/cells/*/AGENTS.md`)
   `cba develop <domain>` walks `technical.json` and dispatches each cell's agent. Each cell agent iterates on its generated output until the artifact builds.

6. **Delivery**
   - `cba deploy <domain> --env dev --adapter docker-compose` for local runs
   - `cba deploy <domain> --env prod --adapter terraform/aws` for a cloud deploy

## Invariants

1. **One domain per run**. This agent operates on exactly one `dna/<domain>/` subtree per invocation. Cross-domain coordination is a higher-level concern (Phase 6, multi-stack platforms).
2. **Prompt is optional, not authoritative**. If `prompt.md` is present the agent uses it as a starting brief. If it isn't, the agent reads existing DNA files and iterates them based on user instructions.
3. **Do not author schemas or cells**. If the pipeline requires a cell adapter that doesn't exist yet (e.g. `python/django`), or a schema field that doesn't exist yet (e.g. a new layout type), escalate to the user. Schema and adapter work are outside this agent's scope.
4. **Product core is never hand-edited**. Always regenerate via the materializer. If product core is wrong, the fix is upstream.
5. **Technical DNA reads product core only**. Never feed `operational.json` directly into cell agents — they must see a product-shaped view.

## Tools

- `cba validate <domain> [--layer <layer>]` — validate one or all layers, including cross-layer rules
- `cba product core materialize <domain>` — regenerate `product.core.json`
- `cba develop <domain> [--cell <name>]` — run cells
- `cba deploy <domain> --env <env> --adapter <name>` — deliver
- `cba agent <concern>` — resolve a layer or cell AGENTS.md file so the caller can dispatch the right subagent type
- `cba domains` — list every domain under `dna/`

## Adding a new domain

```
mkdir -p dna/<domain>
# (optional) author dna/<domain>/prompt.md with the research brief
cba agent dna                              # resolve this contract
# orchestrating agent dispatches operational-dna-architect,
# then product materializer + designers, then technical designer,
# then cba develop + cba deploy
```

## Must not touch

- Layer schemas (`operational/schemas/`, `product/schemas/`, `technical/schemas/`) — those are owned by the layer maintainers
- Cell generators (`technical/cells/*/src/`) — those are owned by the cell maintainers
- Other domains under `dna/` — this agent is scoped to one domain per run
