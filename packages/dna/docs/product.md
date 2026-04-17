# Product Layer Agents

Agents scoped to the Product DNA layer. Product DNA is the surface layer: the resources, actions, endpoints, pages, blocks, and fields that describe *how the business is experienced* via API and UI. Product DNA is derived from Operational DNA and is the contract that Technical DNA reads.

## Layer contract

The product layer contains three documents per domain:

- **`product.core.json`** — a self-contained slice of Operational DNA (Nouns, Capabilities, Attributes, Signals, Relationships) transitively referenced by the API and UI surfaces. Downstream layers read this *instead of* `operational.json`.
- **`product.api.json`** — the HTTP API surface (namespace, endpoints, schemas, params)
- **`product.ui.json`** — the web UI surface(s) (layouts, pages, routes, blocks, fields)

Three agents own these documents. They run in strict order because each depends on the previous.

---

## Agent 1: `product-core-materializer`

Produces `product.core.json` from `operational.json` + the references in `product.api.json` and `product.ui.json`.

### Scope

- Walk `product.api.json` and `product.ui.json` for references to Operational primitives (Nouns, Capabilities, Attributes, Signals)
- Compute the transitive closure — include Relationships between referenced Nouns, Attributes of referenced Nouns, Signals emitted by referenced Capabilities
- Emit `product.core.json` as a self-contained document that validates without `operational.json` present

### Inputs

- `operational.json` (authoritative source)
- `product.api.json` and/or `product.ui.json` (to determine what slice to materialize)

### Outputs

- **`product.core.json`** at the target domain directory
- Must validate against `@dna/core/schemas/product/product.core.json`

### When it runs

- Automatically by `cba develop` before any cell runs
- Manually via `cba product core materialize --dna <domain-dir>`
- Whenever `operational.json` changes and product surfaces haven't changed — materializer re-runs to keep core in sync

### Invariants

1. **Derived, not authored**. `product.core.json` is never hand-edited. If core is wrong, the fix is in `operational.json` or the product surfaces, not in core itself.
2. **Transitive closure**. If `product.api.json` references `Loan`, core must include `Loan`'s Attributes, any Signal that `Loan.*` Capabilities emit, and any `Relationship` involving `Loan`.
3. **No operational leakage past this point**. Once core exists, nothing downstream reads `operational.json` directly.

---

## Agent 2: `product-api-designer`

Produces `product.api.json` from `product.core.json`.

### Scope

- Map Resources to REST namespaces and endpoints
- Map Capabilities to HTTP operations (method + path + request/response schemas)
- Derive request and response schemas from Attributes
- Author endpoints for every Capability surfaced in the API (some Capabilities may be internal-only)

### Inputs

- `product.core.json` (Nouns, Capabilities, Attributes, Signals)
- Domain-specific prompt or brief describing which Capabilities become public endpoints vs internal
- An API namespace name (e.g. `marshall`, `lending`)

### Outputs

- **`product.api.json`** at the target domain directory
- Must validate against `@dna/core/schemas/product/product.api.json`
- Cross-layer validation: every `endpoint.operation` resolves to a Capability in `product.core.json`

### Must not touch

- `product.core.json` — if a Capability or Attribute is missing, update `operational.json` and re-materialize core
- `product.ui.json` — that's the next agent's job

### Hand-off

When `product.api.json` validates, hand off to **`product-ui-designer`**.

---

## Agent 3: `product-ui-designer`

Produces `product.ui.json` from `product.core.json`.

### Scope

- Design layouts, pages, and routes for each UI surface the domain requires
- Map Resources to list/detail pages; map Actions to forms and action buttons
- Derive form fields from Attributes; configure blocks (FormBlock, TableBlock, DetailBlock, ActionsBlock, EmptyStateBlock)
- Support multiple UI surfaces per platform (e.g. public marketing site + authenticated admin)

### Inputs

- `product.core.json`
- Domain-specific prompt describing UI surfaces, layouts, and route structure
- Layout catalog from `@dna/core/schemas/product/web/layout.json`

### Outputs

- **`product.ui.json`** at the target domain directory (may contain one or more surfaces)
- Must validate against `@dna/core/schemas/product/product.ui.json`

### Hand-off

When both `product.api.json` and `product.ui.json` validate, hand off to **`technical-stack-designer`** (see `technical/AGENTS.md`).

---

## Why three agents, not one?

Each surface has different concerns: core-materializer is deterministic (it's a projection); api-designer makes REST/schema decisions; ui-designer makes layout/component decisions. Splitting them keeps each prompt focused, makes failures diagnosable per agent, and lets core be regenerated cheaply when only operational DNA changes.
