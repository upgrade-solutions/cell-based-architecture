## Context

DNA's product layer describes APIs in DNA primitives (`Endpoint`, `Schema`, `Param`, `Namespace`). The contract translation from DNA to OpenAPI 3.x is the responsibility of `@dna-codes/output-openapi` — that's the design intent baked into the package boundaries:

- **DNA** owns the product spec shape.
- **`output-openapi`** is the contract layer (DNA → OpenAPI 3.x).
- **CBA** owns the *technical implementation* (OpenAPI → fastify routes, controllers, etc.).

Today's api-cell **violates that boundary**. It carries its own DNA-to-OpenAPI logic in `src/interpreter/openapi.ts`. Every time the DNA Field schema gains a type (object, soon array), the api-cell silently rots until someone notices the runtime spec is wrong. We just hit that exact failure mode with `add-object-field-type`.

The upstream sister proposal `dna/openspec/changes/add-object-field-type` (archived) gave us a working `output-openapi` for object Fields. This proposal makes the api-cell *use* it.

## Goals / Non-Goals

**Goals**
- The runtime OpenAPI doc served at `/api-json` is rendered by `@dna-codes/output-openapi`, not by the api-cell.
- Adding a new Field type in DNA + updating output-openapi automatically updates every cba api-cell consumer's runtime spec on next regen, with no cba-side change.
- Conformance test catches the next time these two paths drift.

**Non-Goals**
- **Routing.** The api-cell's route registration (`registerRoutes`) still consumes `product.api.json` directly today. Flipping it to consume OpenAPI is a separate, larger change (different concerns: param parsing, validation middleware, etc.). This proposal scopes only the spec served at `/api-json`.
- **Other api-cell adapters.** NestJS, Express, Rails, FastAPI all have their own OpenAPI emission paths. They should flip to output-openapi too, but each is its own lift. Sequence this proposal first; replicate per adapter as follow-ons.
- **Authentication/authorization shape.** If `@dna-codes/output-openapi` doesn't yet emit `securitySchemes.bearerAuth` and per-endpoint `security`, that's a gap to close in output-openapi (a separate proposal in `dna/`), not a reason to keep the hand-rolled builder.

## Decisions

### 1. Wrapper signature

```ts
// technical/cells/api-cell/src/adapters/node/fastify/templates/openapi.ts (template source)
import { render } from '@dna-codes/output-openapi'

export function buildOpenApiSpec(api: any): object {
  const { content, format } = render(api, { format: 'json' })
  if (format !== 'json') throw new Error(`Expected JSON, got ${format}`)
  return JSON.parse(content)
}
```

Drop the unused `core` parameter unless any caller in the existing template relies on it; the rendered emitted file in the cell's generated tree should match.

### 2. Audit: feature parity with the hand-rolled builder

Read both implementations and produce a per-feature checklist before deleting the hand-rolled file. If a gap exists:

- **Cosmetic gap** (e.g., different `tags` casing): either accept the new shape or post-process locally. Document the choice.
- **Functional gap** (e.g., `securitySchemes` missing): file a sister proposal in `dna/` against `output-openapi`. **Do not work around it in cba.** The whole point of the flip is to centralize this logic.

The audit step is mandatory. Implementer should produce the checklist as part of this change's PR description.

### 3. Generated `package.json` template — add the dep

```jsonc
{
  "dependencies": {
    "@dna-codes/output-openapi": "^0.1.0",
    "@dna-codes/core": "^0.3.0",
    // … existing
  }
}
```

The version range here doesn't conflict with the `align-cba-internal-dna-codes-deps` proposal — that one moves `@dna-codes/*` to `file:` references at the cba workspace level. The api-cell's *generated* output (which ships to consumers like `dna-platform`) keeps semver pins because consumers may not have `dna/` as a sibling. Consumers who *do* (per their own `package.json`'s overrides — like `dna-platform`'s) override these to `file:` paths anyway.

### 4. Conformance test extension

Extend the existing fastify runtime conformance test (`fix-fastify-adapter-swagger-ui-wiring` added the runtime assertion). Add a new fixture or extend the existing ECS fixture with a request body containing a `type: "object"` Field. After boot, hit `/api-json`. Assert:

```ts
expect(spec.paths['/test'].post.requestBody.content['application/json'].schema)
  .toMatchObject({
    type: 'object',
    properties: expect.objectContaining({
      nested: expect.objectContaining({
        type: 'object',
        properties: expect.any(Object),
      }),
    }),
  })
```

Catches both the flip AND the next time output-openapi gains a Field type and the api-cell drifts (because the cell now just delegates).

### 5. Delete the hand-rolled file

Once tests pass with the wrapper, the existing `interpreter/openapi.ts` template emits a thin re-export. Remove the implementation; keep the file as a one-liner that `export * from '@dna-codes/output-openapi'` if downstream consumers import from the file path directly. If the only caller is `main.ts` (already imports from `./interpreter/openapi`), updating that import to `@dna-codes/output-openapi` directly is fine — and cleaner.

## Open Questions

1. **Which adapter file is the actual template source?** `technical/cells/api-cell/src/adapters/node/fastify/` has a templates directory; need to find the file that produces `interpreter/openapi.ts` in the generated output.

   Resolved: `src/adapters/node/fastify/generators/openapi.ts`. Previously a one-line re-export from the express adapter's hand-rolled `generateOpenApi`; now carries its own body — the wrapper around `@dna-codes/output-openapi.render()` plus parity post-processing.
2. **What's the right shape for the audit deliverable?** Lean: a markdown table in the PR description matching the §3 table in `proposal.md`. Each row marked ✅ (parity), 🔧 (gap, post-process locally), or 📝 (gap, sister proposal filed).

   Resolved: tasks.md task 1.3 carries the final checklist inline; the file-level docstring on `generators/openapi.ts` carries the post-process rationale.
3. **Should the conformance test fixture have a real-world shape (mirroring dna-platform's `Conversion`) or a minimal contrived one?** Lean: minimal contrived. The test asserts the contract, not the platform.

   Resolved: contrived `POST /v1/convert` with nested `from` (format + input) and `to` (format) object Fields. Mirrors dna-platform's shape closely enough to be the canary, doesn't couple to the platform.

## Follow-on: upstream output-openapi proposals

Three 📝 candidates surfaced in the parity audit. Each is a real upstream gap; cba post-processes pending. When a downstream consumer pushes for the upstream fix, file as a sister proposal in `dna/openspec/changes/`:

1. **Auth shape (`securitySchemes` + per-endpoint `security`)**. cba currently hard-wires `bearerAuth` and applies it to every operation. The right home for this is a future Auth DNA shape (probably on the api layer's namespace) that `output-openapi` derives from. Until then cba shims `securitySchemes.bearerAuth` and `security: [{ bearerAuth: [] }]` per op.

2. **Default error responses (401/403/404 stub descriptions)**. Cosmetic enough to keep local — but if there's an Auth DNA shape, deriving these from it would be cleaner.

3. **Resource-name tags**. cba post-processes to override the namespace-name tag with `["${Resource}s"]` per op (preserves Redoc's per-resource sidebar grouping). Could become an `output-openapi` option (e.g., `tags: 'resource' | 'namespace'`) or a derivation rule.

`x-roles` post-processing stays cba-internal — it's not appropriate upstream.

## Follow-on: flips for the other api-cell adapters

NestJS, Express, Rails, FastAPI all hand-roll their own DNA → OpenAPI logic with the same eventual-drift problem (whenever DNA gains a Field type). Each is its own flip with different file paths, generation patterns, and runtime constraints. Tracked here as a queue rather than four placeholder change directories — when a downstream consumer hits the flat-OpenAPI bug for a specific adapter, that's the trigger to file the real proposal (`flip-nestjs-api-cell-to-output-openapi`, etc.).
