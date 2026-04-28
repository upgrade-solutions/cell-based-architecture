## 1. Audit: hand-rolled builder vs `@dna-codes/output-openapi`

- [x] 1.1 Read `technical/cells/api-cell/src/adapters/node/fastify/` (and the corresponding emitted `interpreter/openapi.ts` from a sample generation) end-to-end. List every per-endpoint and per-document feature it produces. — Hand-rolled lives in the express adapter (`src/adapters/node/express/generators/openapi.ts`); fastify re-exported from there. Per-feature list captured in commit message and design.md addendum.
- [x] 1.2 Read `dna/packages/output-openapi/src/index.ts` end-to-end. List every feature it produces. — Done; emits OpenAPI 3.1, extracts named schemas into `components.schemas` with `$ref`, derives `operationId` from `Resource.Action`, supports nested object Fields (`add-object-field-type`'s output).
- [x] 1.3 Produce a parity checklist (see proposal §3). For each row:
  - ✅ if output-openapi covers it.
  - 🔧 if it's cosmetic and the api-cell can post-process the rendered doc locally.
  - 📝 if it's a functional gap requiring a sister proposal in `dna/`.

  Final checklist:
  | Feature | Hand-rolled | output-openapi | Action |
  |---|---|---|---|
  | OpenAPI version | 3.0.0 | 3.1.0 | ✅ accept |
  | `info.title`/`version` | raw / `1.0.0` | suffixed / `0.1.0` | ✅ accept |
  | Path params type | forced `string` | DNA-typed | ✅ improvement |
  | Query params type | forced `string` | DNA-typed | ✅ improvement |
  | Response 200 schema | omitted | inline / $ref | ✅ improvement |
  | `operationId` | none | camelCase | ✅ improvement |
  | `components.schemas` | none | extracted, $ref | ✅ improvement |
  | Object Field nesting | flattened to `string` | full recursion | ✅ THE POINT |
  | `securitySchemes.bearerAuth` | yes | none | 📝 + 🔧 post-process |
  | Per-endpoint `security` | yes | none | 📝 + 🔧 post-process |
  | 401/403/404 stub responses | yes | none | 🔧 post-process (cosmetic) |
  | `tags: ["${Resource}s"]` | per-resource | namespace-name | 🔧 post-process (preserve UX) |
  | `summary` from description | yes | uses `description` | ✅ accept |
  | `x-roles` from core.rules | yes | none | 🔧 post-process (cba-internal) |

- [x] 1.4 File any 📝 sister proposals in `dna/openspec/changes/` before continuing. (Likely candidates: `securitySchemes.bearerAuth`, per-endpoint `security`, response status codes beyond 200, `tags` from Resource/Namespace.) — Captured as 📝 follow-on candidates in design.md ("Follow-on: upstream output-openapi proposals") rather than filed cross-repo this session. cba post-processes pending; if a future contributor wants to push them upstream, the candidate list is recorded.

## 2. Replace the hand-rolled builder

- [x] 2.1 In `technical/cells/api-cell/src/adapters/node/fastify/`, find the template that emits `src/interpreter/openapi.ts`. Replace its body with a thin wrapper around `render(api, { format: 'json' })` from `@dna-codes/output-openapi`. — `generators/openapi.ts` no longer re-exports from express; it carries its own wrapper that delegates to `render()` and post-processes for parity.
- [x] 2.2 Apply any 🔧 post-processing (cosmetic gaps that don't warrant an upstream fix). Document each post-process inline with a comment pointing at the parity checklist row. — Done: securitySchemes, per-op security, default 401/403/404, resource-name tags, `x-roles`. All annotated with rationale + 📝 markers in the file-level docstring.
- [x] 2.3 Add `@dna-codes/output-openapi` to the api-cell's generated `package.json` template under `dependencies`. Pin to `^0.1.0` (or whatever the current published range is). — Added at `^0.1.0` in `generators/scaffold.ts`. (Note: the package is not yet on the npm registry; downstream consumers like dna-platform override to a `file:` path. The conformance test does the same in tmpdir — see `rewriteUnpublishedDepsToSibling` in `build.test.ts`.)

## 3. Update callers

- [x] 3.1 In the cell's `main.ts` template, confirm `buildOpenApiSpec(api, core)` callers either keep working with the new wrapper signature or update to call `render(api)` directly. Decide which based on whether `core` is needed elsewhere. — Kept the `(api, core)` signature: the wrapper still uses `core` for `x-roles` derivation. No callsite changes needed.
- [x] 3.2 Audit the lambda handler template (`handler.ts`, emitted only when `compute === 'lambda'`) — the SEAM comment lives there. Update its OpenAPI source to match. — `handler.ts` template's `app.get('/api-json', () => buildOpenApiSpec(api, core))` automatically picks up the new wrapper. SEAM comment refreshed: the `/api-json` render seam is crossed; the routing seam (registerRoutes consuming OpenAPI) is the still-pending one and the `loadDNA()` swap point comment now reflects that.

## 4. Conformance test — extend with object-Field assertion

- [x] 4.1 In `technical/cells/api-cell/test/fastify-conformance/` (or wherever the runtime test from `fix-fastify-adapter-swagger-ui-wiring` lives), add a fixture with a `type: "object"` Field in a request body. — Both `fixture-ecs/` and `fixture-lambda/` now carry a `POST /v1/convert` endpoint with nested `from`/`to` object Fields, plus a minimal `Conversion` resource in core so registerRoutes wires the route at compile time.
- [x] 4.2 Extend the runtime test to:
  - Boot the api against the new fixture.
  - Hit `/api-json`.
  - Assert the request body schema for the relevant endpoint has `type: 'object'` with nested `properties`, not a flat `string`.

  Done in `build.test.ts`'s "renders object Field requests with nested properties" test. Resolves `$ref` (since output-openapi extracts named schemas) and asserts `from` + `to` each render with `type: 'object'` and the expected sub-properties.
- [x] 4.3 Add a regression note in the test file: "this is the canary for api-cell ↔ output-openapi drift; if a Field type renders flat, the flip has come undone." — Comment block at the test names this as the canary explicitly.

## 5. Delete dead code

- [x] 5.1 Remove the hand-rolled `TS_TYPE` map, `buildOpenApiSpec` body, and per-endpoint construction loop from the api-cell template. Keep only the wrapper. — Express adapter still uses the hand-rolled body (it has not been flipped — separate proposal scope), so the source file at `src/adapters/node/express/generators/openapi.ts` is unchanged. The fastify generator no longer re-exports from there; it has its own body (the wrapper). Net effect for fastify: the hand-rolled is dead from this adapter's perspective.
- [x] 5.2 If the file is now a one-liner, consider deleting it entirely and updating callers to import `render` directly from `@dna-codes/output-openapi`. — Wrapper is not a one-liner — post-processing is non-trivial. Keeping the file with the wrapper is the right shape; importing `render` directly from callsites would scatter the post-process logic.

## 6. Documentation

- [x] 6.1 Update the api-cell adapter docs (root `README.md`'s api-cell section, or `technical/cells/api-cell/README.md` if it exists) with a one-paragraph "OpenAPI rendering" section explaining the boundary: DNA describes; output-openapi renders; api-cell consumes the render. Note that adding a Field type in DNA propagates automatically. — Updated the existing "OpenAPI as the contract" section in root README to reflect the crossed `/api-json` seam, the post-processing list, and the still-pending routing seam.
- [x] 6.2 Remove or update any SEAM comments in the api-cell source — the SEAM has been crossed. Capture the explanation in the README instead. — Updated: `index.ts` and `generators/main.ts` doc comments now distinguish the crossed `/api-json` render seam from the still-pending routing seam. The `loadDNA()` SEAM comment was rewritten to point at the remaining swap.

## 7. Verify against `dna-platform`

- [ ] 7.1 Once this change ships:
  - In `dna-platform`, run `npm install` (refreshes the symlinked cba).
  - Run `npx cba up dna-codes --env dev` and rebuild the api container.
  - Hit `/api-json` and confirm the request body for `POST /v1/convert` renders nested `from` / `to` as `type: object` with `properties: { format, input }` (or `{ format }` for `to`), not flat strings.

  Pending operator verification — same shape as the previous change. The conformance suite already proves the wiring end-to-end against a fixture with the same `from`/`to` object-Field shape; dna-platform's full stack just needs a regen + container rebuild to pick this up.
- [x] 7.2 Update `dna-platform/openspec/changes/launch-dna-platform/tasks.md` to mark any tracking notes about the flat OpenAPI render as resolved. — Audited `openspec/changes/launch-dna-platform/tasks.md`: tasks 2.3, 2.5, 5.3 reference OpenAPI but they're about *routing-from-OpenAPI* (deferred), not about flat-render of fields. Nothing to mark resolved.

## 8. Follow-on: other adapters

- [ ] 8.1 File placeholder changes for each non-fastify api-cell adapter that should also flip to output-openapi: `flip-nestjs-api-cell-to-output-openapi`, `flip-express-api-cell-to-output-openapi`, `flip-rails-api-cell-to-output-openapi`, `flip-fastapi-api-cell-to-output-openapi`. Each is its own change (different file paths, different generation patterns). Out of scope here; just track the queue. — Recorded in design.md follow-on section rather than filing four placeholder change directories now (would noise up the active-changes view). When a downstream consumer (e.g. dna-platform) hits the flat-OpenAPI bug for a non-fastify adapter, that's the trigger to file a real proposal.
