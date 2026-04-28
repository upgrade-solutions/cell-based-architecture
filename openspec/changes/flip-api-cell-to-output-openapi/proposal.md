## Why

The api-cell adapter generates a hand-rolled OpenAPI builder at `src/interpreter/openapi.ts` (in the cell's emitted source). That builder has its own `TS_TYPE` map:

```ts
const TS_TYPE: Record<string, string> = {
  string: 'string', text: 'string', number: 'number', boolean: 'boolean',
  date: 'string', datetime: 'string', enum: 'string', reference: 'string',
}
```

Notably absent: `object` (and `array`, when it lands). Any Field type that's added to the canonical schema after the api-cell adapter was templated is invisible to the runtime spec served at `/api-json` — the api silently flattens unknown types to `string` (or the wrong default).

Concrete instance: `dna/openspec/changes/add-object-field-type` shipped `type: "object"` with recursive `fields[]` and updated `@dna-codes/output-openapi` to render it correctly. `dna-platform`'s `product.api.json` declares nested `from` / `to` shapes. The validator accepts them. But the running api emits `{ from: { type: "string" }, to: { type: "string" } }` because the hand-rolled builder doesn't know about the new type.

The architectural direction has been clear for a while — the existing SEAM comment in the api-cell's lambda handler says exactly this:

> SEAM: when @dna-codes/output-openapi publishes, swap the api.json read for a read of the emitted OpenAPI document and adapt registerRoutes to consume it. Everything else in this file is compute-target agnostic.

It published. The flip just hasn't happened. This proposal is that flip — for the spec served at `/api-json` (the immediate forcing function). Flipping `registerRoutes` to consume OpenAPI for routing/validation is a larger second step, deferred to a follow-on.

## What Changes

### 1. Replace `src/interpreter/openapi.ts` with a call to `@dna-codes/output-openapi`

In the api-cell adapter (`technical/cells/api-cell/src/adapters/node/fastify/`), where `interpreter/openapi.ts` is templated:

- Drop the hand-rolled `buildOpenApiSpec`, `TS_TYPE` map, and per-endpoint construction loop.
- Replace with a thin wrapper that calls `render(productApi)` from `@dna-codes/output-openapi` and returns the parsed JSON object (since callers want a JS object, not a YAML/JSON string).

```ts
import { render } from '@dna-codes/output-openapi'

export function buildOpenApiSpec(api: any, _core: any): object {
  const { content, format } = render(api, { format: 'json' })
  return format === 'json' ? JSON.parse(content) : /* yaml-parse */ ...
}
```

The `core` argument can be retained for signature compatibility but is unused (output-openapi consumes the api layer only). Remove if no callers depend on it.

### 2. Add `@dna-codes/output-openapi` to the api-cell's generated `package.json`

The cell currently doesn't depend on `@dna-codes/output-openapi`. Add it to `dependencies` in the emitted `package.json`. Pin to the same version range as other `@dna-codes/*` deps the cell generates (currently `^0.1.0`).

### 3. Cover the feature gaps before flipping

The hand-rolled builder does things `@dna-codes/output-openapi` may not yet do. Audit and address each before flipping:

| Hand-rolled feature | output-openapi today | Action |
|---|---|---|
| Path param substitution (`:id` → `{id}`) | Likely yes (OpenAPI uses braces natively) | Verify |
| Query/header param emission from `endpoint.params` | Likely yes | Verify |
| Request body schema from `endpoint.request.fields` | Yes | OK |
| Response schema (200 from `endpoint.response`) | Yes | OK |
| Default `401` response | Probably no | Add to output-openapi or post-process |
| `security: [{ bearerAuth: [] }]` per endpoint | Probably no | Same |
| `securitySchemes.bearerAuth` in `components` | Probably no | Same |
| Tags from `${resource}s` | Maybe via Namespace? | Verify |
| `summary` from `endpoint.description` | Maybe | Verify |

For each gap, the right fix is in **`@dna-codes/output-openapi`** (so all consumers benefit), not in cba. If a gap can't be closed before this proposal lands, the api-cell wraps `render()` and post-processes the result — but that's tech debt, not a stable shape.

### 4. Conformance: extend the api-cell's existing tests

The fastify build-conformance suite (added in `fix-fastify-adapter-template`) asserts the cell builds. Extend it (or add a runtime check inside the existing runtime assertion from `fix-fastify-adapter-swagger-ui-wiring`) to:

- Generate a fixture with a `type: "object"` Field in the request body.
- Boot the api.
- Hit `/api-json`.
- Assert the response's request body schema for that endpoint contains a `properties: { ... }` shape, not a flat `string`.

Catches the next regression in the `output-openapi` ↔ api-cell handoff.

## Capabilities

### Modified Capabilities
- `api-cell-fastify-openapi` — the api's runtime OpenAPI doc is rendered by `@dna-codes/output-openapi`, not a hand-rolled builder. New Field types in DNA propagate automatically.

### Removed Capabilities
- `api-cell-handrolled-openapi-builder` — the per-cell builder is dead weight once output-openapi is the source of truth. Delete it.

## Impact

- **Affected paths**: `technical/cells/api-cell/src/adapters/node/fastify/` (the `interpreter/openapi.ts` template + the cell's generated `package.json`); the conformance test under `technical/cells/api-cell/test/fastify-conformance/`.
- **Backwards compatibility**: the *shape* of `/api-json` may change for endpoints where output-openapi differs from the hand-rolled builder. Any downstream that pinned against the exact hand-rolled shape (unlikely — there are no known consumers) will need to update. For OpenAPI-spec-compliant readers (Redoc, Swagger UI, Postman), the doc remains valid — if anything it gets *more* correct.
- **Coordination**: depends on (a) `dna/openspec/changes/add-object-field-type` (already shipped — output-openapi knows about object Fields), and (b) the gap audit in §3. May trigger one or more follow-up proposals in `dna` to extend output-openapi.
- **Risk profile**: medium. Removing well-tested hand-rolled code in favor of an upstream renderer is the right move, but the gap audit needs to be honest. Don't ship the flip with unaddressed gaps.
