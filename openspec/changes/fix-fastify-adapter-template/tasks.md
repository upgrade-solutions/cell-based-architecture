## 1. Align fastify dep set in the generated `package.json`

- [x] 1.1 In `technical/cells/api-cell/src/adapters/node/fastify/` (the package.json template emission — likely a `templates/` directory or a `writePackageJson` helper), update the dep major versions:
  - `fastify`: `^4.28.0` → `^5.0.0`
  - `@fastify/cors`: `^9.0.0` → `^11.0.0`
  - `@fastify/swagger`: stays `^9.0.0`
  - `@fastify/swagger-ui`: `^4.0.0` → `^5.0.0`
- [x] 1.2 Verify `@fastify/aws-lambda`'s peer dependency on fastify and pick a v5-aligned major (likely `^5.x`; fall back to `^4.x` only if its peer accepts both — we cannot ship a peer that conflicts with fastify@5).
- [x] 1.3 Generate a fixture (use the existing lending or torts/marshall fastify cell), run `npm install --no-audit --no-fund && npm run build`, confirm exit 0 and no `FST_ERR_PLUGIN_VERSION_MISMATCH` at startup. *(Verified via the locked conformance fixtures — both compute targets pass `npm install` + `npm run build` cleanly. Surfaced and fixed a v5-only typing issue in the generated handler.ts where `awsLambdaFastify`'s callback overload was preferred — narrowed the cached handler's type explicitly. See `src/adapters/node/fastify/generators/main.ts`.)*

## 2. Gate `handler.ts` emission on `compute === 'lambda'`

- [x] 2.1 In the same adapter, find where `src/handler.ts` is written (likely a `writeHandler(outDir)` call sitting next to `writeMain(outDir)`). Wrap the call in `if (config.compute === 'lambda')`.
- [x] 2.2 Re-run the ECS fixture generation. Confirm `src/handler.ts` does **not** appear, and `npm run build` succeeds. *(Asserted by `fastify build-conformance — fixture-ecs` in `test/fastify-conformance/build.test.ts`.)*
- [x] 2.3 Re-run the Lambda fixture generation. Confirm `src/handler.ts` **does** appear, and `npm run build` succeeds. *(Asserted by `fastify build-conformance — fixture-lambda`. Note: design called for emitting `main.ts` in the lambda case as well so contributors can run a local listener; updated `fastify.test.ts` assertion accordingly.)*

## 3. Build-conformance test for both compute targets

- [x] 3.1 Create `technical/cells/api-cell/test/fastify-conformance/fixture-ecs/` containing minimal product.api + technical (one cell with `node/fastify` adapter, no `compute` field set so it exercises the default).
- [x] 3.2 Create `technical/cells/api-cell/test/fastify-conformance/fixture-lambda/` — same product.api, but the cell has `config.compute = 'lambda'`.
- [x] 3.3 Add `technical/cells/api-cell/test/fastify-conformance/build.test.ts` that:
  - For each fixture, copies it to a tmpdir.
  - Runs the api-cell generator against the fixture's technical config.
  - Runs `npm install --no-audit --no-fund` and `npm run build` in the generated dir.
  - Asserts exit 0.
  - Asserts `dist/main.js` exists in both; `dist/handler.js` exists only in the lambda case.
  - Cleans up tmpdir on pass and fail.
- [x] 3.4 Wire as `npm run test:fastify-build` in `technical/cells/api-cell/package.json`. Exclude from default `npm test` (it's slow — real installs). *(Dedicated `jest.fastify-build.config.js` with a 10-minute test timeout.)*
- [x] 3.5 CI: add a job that runs `npm run test:fastify-build` on push to main and PRs that touch `technical/cells/api-cell/`. *(`.github/workflows/api-cell-fastify-conformance.yml`. Repo had no prior `.github/` — this is the first workflow.)*
- [x] 3.6 Document the conformance suite in `technical/cells/api-cell/README.md` under "Conformance tests" — note that this is the regression net for adapter-template version drift. *(Documented in the root `README.md` under "Adapter conformance tests > Fastify build-conformance suite" — task 5.1 explicitly allowed root-README placement, and there is no existing api-cell README.)*

## 4. Verify against `dna-platform`

- [ ] 4.1 Once this change ships, in `dna-platform` run `npm install` (refreshes the symlinked cba) → `rm -rf output/dna-codes/dev/api && npx cba develop dna-codes --env dev` → confirm the generated api builds without manual `package.json` edits or file deletions.
- [ ] 4.2 `npx cba up dna-codes --env dev`, then `curl http://localhost:3001/health`. Should return `{"status":"ok"}` end-to-end with no in-the-middle patches.
- [ ] 4.3 Update `dna-platform/openspec/changes/launch-dna-platform/tasks.md` to mark the fastify-adapter follow-ups (currently tracked as inline notes in section 4) resolved.

## 5. Documentation

- [x] 5.1 Update `technical/cells/api-cell/README.md` (or the cba root README's api-cell section) to call out the v5 peer alignment and the conditional handler emission. Include a one-line "if you see `FST_ERR_PLUGIN_VERSION_MISMATCH`, regenerate against this version of cba" note for anyone hitting an older generated tree. *(Updated root `README.md` `compute` hint section.)*
- [x] 5.2 Note in the cba root README that the lambda compute target is the only adapter that emits `handler.ts`; ECS targets get `main.ts` only. *(Added a "Files emitted" row to the ECS-vs-Lambda table.)*
