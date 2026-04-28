## Context

Companion to `fix-fastify-adapter-template`. That change moved the api-cell adapter to a fastify-v5-coherent dep set:

```
fastify@^5
@fastify/cors@^11
@fastify/swagger@^9
@fastify/swagger-ui@^5
```

The deps install and build cleanly. **But the registration code in `main.ts` was not updated for the v9/v5 plugin APIs**, so the runtime Swagger UI surface is broken. Build-time conformance passed; runtime conformance was never asserted.

This is the same shape as the prior consumer-mode bugs: a template assumption silently breaks when the inputs change. The fix is the wiring + a runtime assertion in the conformance test.

## Goals / Non-Goals

**Goals**
- `Swagger UI: http://localhost:<port>/api` renders the api-cell's actual OpenAPI document, with all paths visible and operable.
- The build-conformance test fails if the UI's spec URL ever returns an empty doc again.
- Implementation has at most one moving piece (either `@fastify/swagger` *or* hand-rolled HTML + `/api-json`, not both) — the current template carries `@fastify/swagger` for no clear reason since the spec is built directly by the cell.

**Non-Goals**
- No change to the OpenAPI document itself (`/api-json`). It already renders correctly via Redoc.
- No change to the api-cell's route registration, schema generation, or runtime store. Those are orthogonal.

## Decisions

### 1. Pick one strategy for v9/v5 wiring

Three options surveyed in the proposal. Rank:

**A. Decorate `app.swagger()` to return the pre-built doc** — minimal change, keeps `@fastify/swagger` in the picture but inverts who owns the doc. Risk: `@fastify/swagger@^9` may not allow overriding the decorator after registration, and may regenerate from introspected routes regardless. Verify before committing to this path.

**B. Drop `@fastify/swagger` entirely; hand-roll the Swagger UI HTML** — lowest coupling. The api-cell already serves a hand-rolled Redoc page at `/docs` pointing at `/api-json`; mirror that for Swagger UI at `/api`. The Swagger UI assets ship in `swagger-ui-dist` (or the fastify plugin's bundled copy); load them from CDN or the bundled path. Drops `@fastify/swagger-ui` too in the cleanest version, replacing both plugins with a static HTML page.

**C. Use `@fastify/swagger`@^9's openapi transform hooks** — cleanest if supported. v9 may expose `transform` or a method to seed the doc; if it does, that's the intended path. If the documented v9 API is "register routes with schema and we generate the doc," that doesn't apply here since the api-cell registers routes dynamically without schema metadata.

Recommendation order: try **C** (intended v9 path) → fall back to **A** (decorator override) → fall back to **B** (hand-roll). Commit to whichever reaches green. Document the choice in the api-cell adapter's source.

**Resolved during implementation — chosen strategy is B′ (Redoc-only).** Once we accepted that the api-cell builds the OpenAPI doc directly and the swagger plugin pair is therefore dead weight, the next question was "do we need two renderers?" — and the answer is no. Redoc's standalone bundle already includes a "Request samples" panel with curl and a copy button, which is the only Swagger UI feature the dev loop relied on. Strategy B′ drops both plugins, drops the Swagger UI page entirely, and points `/` at `/docs`. Two plugin majors gone, one renderer remaining.

### 2. Don't keep `mode: 'static'` if it doesn't work

The current template uses `mode: 'static'` because the api-cell pre-builds the spec. If neither A, B, nor C cleanly preserves that mode, drop it. The point is "the UI shows the spec" — the mechanism is implementation-detail.

### 3. Runtime conformance test

The build conformance test from `fix-fastify-adapter-template` asserts `npm install && npm run build` succeeds. Extend it (or add a sibling test in the same dir) that:

- Starts the generated api in the background (`spawn('node', ['dist/main.js'], { detached: true, stdio: 'pipe' })`).
- Polls `GET /health` until 200 or 30s timeout.
- Hits `GET /api` — asserts HTTP 200 and the response body contains `swagger-ui`-recognizable markup (`<div id="swagger-ui">`, `swagger-ui-bundle`, etc.).
- Hits the spec URL the UI page references — extract the `<script>`-loaded init JS or the `swagger-initializer.js` and assert it points at a path that returns `{ "openapi": "3.x.x", "paths": { ... non-empty ... } }`.
- Stops the server cleanly (`process.kill`).

Edge cases:
- Port collisions: the test should pick a free port (let fastify bind to `:0` and read back the port from the listen log, or set `PORT=` to a known-free value chosen via `net.createServer().listen(0)`).
- DB dependency: if the generated api requires Postgres, run with the in-memory store mode (existing `[store] using memory` log path) — set the env vars accordingly.

The runtime test is meaningfully slower than the build test (boot + poll). Keep it in the same `test:fastify-build` script — single CI gate, no separate matrix.

## Open Questions

1. **Does `@fastify/swagger@^9` expose a way to inject a pre-built static spec?** Need to read the v9 changelog/README. If yes, strategy C; if no, A or B.
2. **Should the api-cell stop carrying `@fastify/swagger` at all?** It's only registered as a feeder for swagger-ui. If we hand-roll Swagger UI HTML the same way Redoc is hand-rolled, the plugin is dead weight. Lean: drop it. One less version peer to manage.
3. **Are there other places the swagger plugin's introspection matters?** Search the api-cell adapter for `app.swagger()` calls outside `main.ts`. If anywhere relies on it (request validation, route docs, etc.), keep the plugin.
