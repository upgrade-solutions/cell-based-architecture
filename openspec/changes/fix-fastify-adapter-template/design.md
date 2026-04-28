## Context

The fastify api-cell adapter has two compute targets:

- `compute: 'ecs'` (default) — long-running fastify server, container shipped via Docker → ECS Fargate or local docker-compose. Entrypoint: `src/main.ts` calling `app.listen()`.
- `compute: 'lambda'` — same fastify routes wrapped with `@fastify/aws-lambda` v4+ in streaming mode. Entrypoint: `src/handler.ts` exporting a Lambda handler. Packaging: `lambda.zip`.

Both targets share the same routes, schemas, and middleware. They differ only in the entrypoint shim and packaging. The bugs in this proposal are in the *template emission* — the part of the adapter that decides what files and deps go into the generated output.

## Goals / Non-Goals

**Goals**
- The default (ECS) compute target generates a directory that runs `npm install && npm run build` cleanly with zero manual edits.
- The lambda compute target also runs cleanly with zero manual edits.
- A conformance test enforces both, in CI, on every change to the fastify adapter.

**Non-Goals**
- Migrating the existing nestjs / express / rails / fastapi adapters off their fastify-4 templates. Those adapters don't ship `@fastify/swagger` and aren't affected. Any modernization there is a separate change.
- Changing the OpenAPI consumption path. The fastify adapter still reads `product.api.json` directly for now (per the existing in-flight `launch-dna-platform` proposal). When that flips to OpenAPI consumption, this template work doesn't change.

## Decisions

### 1. Pin to a coherent fastify-5 set

Survey of plugin compatibility (verified at proposal time):

| Plugin | Fastify 4 line | Fastify 5 line |
|---|---|---|
| `@fastify/cors` | `^9` (current template) | `^11` |
| `@fastify/swagger` | `^8` | `^9` (current template — already v5-aligned) |
| `@fastify/swagger-ui` | `^4` (current template) | `^5` |
| `@fastify/aws-lambda` | `^4` | `^5` *(verify before pinning; the lambda compute target relies on `streamifyResponse` which is v4+)* |

The current template is internally inconsistent: `swagger@^9` requires fastify 5, but `cors@^9` and `swagger-ui@^4` require fastify 4. Whichever fastify version installs, at least one plugin throws `FST_ERR_PLUGIN_VERSION_MISMATCH` at startup.

Pinning fastify@5 + the v5 plugin majors gets a coherent set. Downgrading swagger to ^8 (the fastify-4 line) would also work but loses features and trends against the ecosystem.

**Why caret ranges and not exact pins:** the adapter template is consumed transitively by every fastify-using cell. Caret ranges let downstream consumers pick up patch releases without a fresh `cba develop`. Exact pins would force a regen for every patch bump. The coherence we care about is *major* peer alignment.

### 2. Conditional `handler.ts` emission

Today's adapter (paraphrased):

```typescript
function emit(outDir: string, config: FastifyConfig) {
  writeMain(outDir)
  writeHandler(outDir)                              // ← always
  writePackageJson(outDir, {
    deps: {
      ...baseDeps,
      ...(config.compute === 'lambda' ? lambdaDeps : {}),  // ← gated
    },
  })
}
```

The fix:

```typescript
function emit(outDir: string, config: FastifyConfig) {
  writeMain(outDir)
  if (config.compute === 'lambda') writeHandler(outDir)   // ← gated
  writePackageJson(outDir, {
    deps: {
      ...baseDeps,
      ...(config.compute === 'lambda' ? lambdaDeps : {}),
    },
  })
}
```

The two emissions move in lockstep. ECS gets `main.ts` only; Lambda gets both.

**Why not always emit `handler.ts` and always include `@fastify/aws-lambda`:** the dep adds ~50KB of unused code to every ECS bundle, and emitting a file that imports an unused-in-this-target package is a footgun that future contributors will keep tripping on. Conditional emission matches the conditional packaging that already exists.

### 3. Build-conformance test for both compute targets

Two fixtures under `technical/cells/api-cell/test/fastify-conformance/`:
- `fixture-ecs/` — minimal product.api + technical with `compute: 'ecs'` (or no `compute` set, exercising the default).
- `fixture-lambda/` — same product.api with `compute: 'lambda'`.

Test runner (jest):

1. For each fixture, generate into a tmpdir.
2. `npm install --no-audit --no-fund` in the tmpdir.
3. `npm run build` in the tmpdir.
4. Assert exit 0 and:
   - ECS: `dist/main.js` exists, `dist/handler.js` does NOT exist.
   - Lambda: both `dist/main.js` and `dist/handler.js` exist.
5. Clean up the tmpdir.

This is slow (npm install per fixture), so it runs as `npm run test:fastify-build` in `technical/cells/api-cell/`, separate from the default `npm test`. CI runs both.

## Open Questions

1. **Exact peer for `@fastify/aws-lambda`.** v5 should align with fastify 5; verify by reading the package's peer declaration before pinning. If v5 isn't available yet, stay on v4 (still supports the streaming wrapper) — but only if its peer is `>=4 || >=5`, otherwise we re-introduce the mismatch.
2. **Lock the conformance fixtures or let them drift with the canonical examples?** Lean: lock — the conformance test asserts the *current* adapter's output, not whatever the lending example happens to be. A fixture diverging from the example is not a bug.
3. **Should this test live in the api-cell workspace or in the cba workspace?** Lean: api-cell, since it tests the api-cell adapter. Mirrors the existing api-cell conformance suite.
