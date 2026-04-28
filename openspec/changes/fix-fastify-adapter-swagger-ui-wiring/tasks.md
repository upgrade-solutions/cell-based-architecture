## 1. Pick a v9/v5 wiring strategy and implement it

- [x] 1.1 Audit `@fastify/swagger@^9` for a documented way to inject a pre-built static spec (changelog, README, source). Confirm or rule out strategy C from design.md. — Ruled out: v9 hooks (`transform`, openapi route schema) are designed for runtime route introspection. The api-cell builds the spec directly, so they add no value.
- [x] 1.2 If C is unavailable, try strategy A (decorate `app.swagger` after registration). Confirm `app.swagger()` returns `currentSpec`, and `<routePrefix>/json` returns it too. — Considered and rejected: even with reordering so the plugin captures the populated `currentSpec`, `@fastify/swagger-ui@^5` force-routes `<routePrefix>/json` through `app.swagger()` and keeps the plugin pair as a moving piece for no benefit beyond what `/api-json` already provides.
- [x] 1.3 If A is unavailable or fragile, fall back to strategy B: drop `@fastify/swagger` and `@fastify/swagger-ui`; hand-roll a Swagger UI HTML page at `<routePrefix>` mirroring the existing Redoc treatment at `/docs`. Load Swagger UI assets from `swagger-ui-dist` or a CDN. Wire the `url` to `/api-json` (or whatever the api-cell uses for the live spec endpoint). — Implemented as **strategy B′ (Redoc-only)**: dropped both swagger plugins AND skipped hand-rolling Swagger UI. Redoc already renders the same OpenAPI doc at `/docs` with a built-in "Request samples" panel (curl + copy button), so a second renderer added no value. `/` now redirects to `/docs`; the api-cell prints two URLs (Redoc + OpenAPI), not three.
- [x] 1.4 Update the api-cell adapter source (`technical/cells/api-cell/src/adapters/node/fastify/`) where `main.ts` is templated. Document the chosen strategy in a comment on the swagger registration block.
- [x] 1.5 If strategy B is chosen and `@fastify/swagger` becomes unused, remove it from the generated `package.json` template too. Keep `@fastify/swagger-ui` only if its assets are still being loaded from the plugin. — Both `@fastify/swagger` and `@fastify/swagger-ui` removed; assets are loaded from `unpkg.com/swagger-ui-dist@5/*` (mirrors Redoc CDN pattern).

## 2. Audit other usages of `@fastify/swagger` in the adapter

- [x] 2.1 `grep -r "app.swagger\|@fastify/swagger" technical/cells/api-cell/src/adapters/node/fastify/`. Confirm `main.ts` is the only consumer. If anything else depends on the plugin's introspection (request validation, route schema doc generation), keep the plugin and use strategy A or C; B is only safe when the plugin is dead weight. — Confirmed: only `generators/main.ts` (ECS template) imports `@fastify/swagger`/`@fastify/swagger-ui`; nothing else calls `app.swagger()`. Strategy B is safe.

## 3. Extend build-conformance with a runtime assertion

- [x] 3.1 In `technical/cells/api-cell/test/fastify-conformance/build.test.ts` (or a new sibling `runtime.test.ts` in the same dir), add a runtime assertion for the ECS fixture:
  - Start the built api in the background on a free port.
  - Poll `GET /health` until 200 (30s timeout, fail loud on miss).
  - Hit `GET /docs`; assert HTTP 200 and response contains Redoc markup (`<redoc spec-url='/api-json'>`, the Redoc CDN script).
  - Hit `GET /api-json`; assert the response is JSON with `openapi: "3.x"` (or `swagger: "2.0"`) at the top level. (`paths` may be empty for the conformance fixture, which is intentional — it carries no endpoints — but the version field is the regression marker.)
  - Stop the server.
- [x] 3.2 Skip the runtime assertion for the lambda fixture (no long-running entrypoint). Document the asymmetry in a code comment.
- [x] 3.3 Pick a free port for each test run (use `net.createServer().listen(0)` to claim a free port, then close before passing it to the api via `PORT=`).
- [x] 3.4 Run with the in-memory store (set the env var the api-cell already honors for "no DATABASE_URL → in-memory") so the test doesn't need a Postgres dependency.

## 4. Verify against `dna-platform`

- [x] 4.1 Once this change ships, in `dna-platform` run `npm install` → `npx cba up dna-codes --env dev`. Confirm:
  - `curl http://localhost:3001/health` → `{"status":"ok"}` (already works)
  - `curl http://localhost:3001/docs` → 200, Redoc HTML (already works)
  - `curl http://localhost:3001/api-json` → 200, OpenAPI JSON with `/v1/text` and `/v1/usage` paths
  - `curl http://localhost:3001/` → 302 → `/docs`
  - In a browser, `http://localhost:3001/docs` renders the OpenAPI doc with `/v1/text` and `/v1/usage` paths, and each operation has a "Request samples" panel with a copy-curl button.

  Verified by user.
- [x] 4.2 Update `dna-platform/openspec/changes/launch-dna-platform/tasks.md` if any inline fastify-adapter notes track this fix. (Section 4.4 Health check is already done; no task there should regress.) — Audited `openspec/changes/launch-dna-platform/tasks.md`: no inline tasks reference Swagger UI / `@fastify/swagger`. Nothing to update.

## 5. Documentation

- [x] 5.1 Update the api-cell or root `README.md` "Generate and run" section: confirm the URLs the cell prints (`/`, `/docs`, `/api-json`) all work end-to-end, note that `/` redirects to `/docs`, and remove any caveat about Swagger UI being broken on v5 (it is no longer served). — Updated root README: adapter table footnote now distinguishes fastify (Redoc-only) from express/nestjs (Swagger UI + Redoc); the `compute` hint section drops `@fastify/swagger`/`@fastify/swagger-ui` from the pinned dep set; the build-conformance section explains both regression axes (version drift + wiring drift).
- [x] 5.2 Note in the adapter docs that docs are Redoc-only (no Swagger UI), `@fastify/swagger`/`@fastify/swagger-ui` are deliberately not in the dep set, and Redoc's built-in "Request samples" panel covers copy-curl — so a future contributor doesn't re-add the plugin pair "for parity" and reintroduce the v9/v5 wiring fragility. — Captured in two places: (a) the file-level comment on `generateMain` in `generators/main.ts` and (b) the comment on `baseDeps` in `generators/scaffold.ts`. README also has the user-facing version of the same explanation.
