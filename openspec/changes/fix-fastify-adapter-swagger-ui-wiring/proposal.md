## Why

Companion to the just-archived `fix-fastify-adapter-template`. That change aligned the fastify dep majors to v5; this one fixes the **swagger/swagger-ui registration code** in the api-cell adapter's `main.ts` template, which was written for the v8/v4 plugin API and doesn't work against v9/v5.

Surfaced while bringing up `dna-platform`'s api+db dev stack — health check passes, OpenAPI JSON at `/api-json` is correct, **but Swagger UI at `/api` shows**:

```
Unable to render this definition
The provided definition does not specify a valid version field.
```

Root cause: with `@fastify/swagger@^9` + `@fastify/swagger-ui@^5`, the v5 swagger-ui auto-registers `<routePrefix>/json` and serves it from `app.swagger()` (the swagger plugin's API). The current registration uses `mode: 'static'` with `specification.document`, which no longer flows the static doc through to `app.swagger()` the way it did in v8. So `<routePrefix>/json` returns `{}`, and Swagger UI complains that the empty doc has no `openapi` / `swagger` version field.

Verified: `curl http://localhost:3001/api/json` returns `{}` (size 2). The real spec is at `/api-json` (size ~1.6KB) and renders correctly via Redoc at `/docs`. The bug is **only** in the Swagger UI wiring path.

## What Changes

### 1. Rewrite the swagger/swagger-ui registration in the api-cell `main.ts` template for v9/v5

Current template (paraphrased from the generated `output/dna-codes/dev/api/src/main.ts`):

```ts
await app.register(swagger, {
  mode: 'static',
  specification: { document: currentSpec as any },
})
await app.register(swaggerUi, {
  routePrefix: '/api',
  uiConfig: { url: '/api-json' },     // ← v5 ignores this; resolveUrl('./json') forces the override
})
```

Replacement strategy (implementer's call which to use; both should land at "Swagger UI at `/api` renders the real OpenAPI document"):

- **A. Decorate `app.swagger()` to return the pre-built doc.** Register `@fastify/swagger` minimally, then override the decorator so `app.swagger()` returns `currentSpec`. swagger-ui's auto-registered `/api/json` route then serves the real doc.
- **B. Drop `@fastify/swagger` entirely; serve a custom Swagger UI HTML.** The api-cell already serves a custom Redoc HTML at `/docs` pointing at `/api-json`. Mirror that pattern for Swagger UI: drop both plugin registrations, hand-write a Swagger UI HTML page at `/api` that loads `/api-json`. Removes the moving piece (the swagger plugin) entirely.
- **C. Use `@fastify/swagger`'s v9 transform/openapi hooks** to inject the static spec. The cleanest if v9 supports it.

Recommendation: **A** if v9 supports decorator override cleanly; **B** otherwise (matches the existing Redoc treatment, lowest coupling to `@fastify/swagger`'s API surface). `mode: 'static'` is doing nothing useful here — the api-cell builds the spec at startup; we don't need fastify-swagger to introspect anything.

**Update during implementation — chosen strategy is B′ (Redoc-only).** Redoc already renders the OpenAPI doc at `/docs` with a built-in "Request samples" panel that includes curl + a copy button. A second renderer at `/api` added no value to justify hand-rolling another HTML page. Outcome: drop `@fastify/swagger` *and* `@fastify/swagger-ui`, do not hand-roll Swagger UI, redirect `/` to `/docs`, and rely on Redoc as the sole renderer.

### 2. Extend the build-conformance test to load `/api`

The `fix-fastify-adapter-template` proposal added a conformance test that asserts `npm install && npm run build` succeeds for both compute targets. That test does **not** start the server or hit the UI — which is why this regression slipped through.

Extend the conformance test (or add a sibling) to:

1. Build the ECS fixture and start it (`npm start` in the background).
2. Wait for `/health` to return 200.
3. Hit `/api` (the Swagger UI HTML page) — assert HTTP 200, response references swagger-ui assets.
4. Hit the spec URL Swagger UI actually fetches from (`/api/json` for the current registration, or whichever path the new wiring uses).
5. Assert the response is JSON with a non-empty `paths` and either `"openapi": "3.x"` or `"swagger": "2.0"` at the top level.
6. Tear down.

Keep this in the same `test:fastify-build` script the previous proposal introduced; it's already CI-gated.

## Capabilities

### Modified Capabilities
- `api-cell-fastify` — Swagger UI at `<routePrefix>` renders the api's actual OpenAPI document under `@fastify/swagger@^9` + `@fastify/swagger-ui@^5`.

### Modified Capabilities (extended)
- `api-cell-fastify-build-conformance` — also asserts `/api` loads and serves the real spec, not an empty doc. Catches the next plugin-API drift the same way the build assertion catches dep drift.

## Impact

- **Affected paths**: `technical/cells/api-cell/src/adapters/node/fastify/` (the `main.ts` template — wherever swagger / swagger-ui register); the conformance test under `technical/cells/api-cell/test/fastify-conformance/`.
- **Backwards compatibility**: anyone whose `/api` page worked already was running an older, pre-v5 generated tree. After this lands, regenerating against the current cba produces a working `/api`.
- **Coordination**: `dna-platform` is the immediate beneficiary. After this lands, `cba up dna-codes --env dev` produces a stack where Swagger UI renders cleanly with no manual main.ts patches.
- **Risk profile**: low. Localized to one file in the adapter template. The extended conformance test is the safety net.
