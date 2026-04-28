## Why

The fastify api-cell adapter's generated output doesn't build out-of-the-box for either compute target it's supposed to support:

1. **Inconsistent fastify peer versions in `package.json`.** The template pins `fastify@^4.28.0` alongside plugins that span both major versions: `@fastify/swagger@^9` (requires fastify 5), `@fastify/cors@^9` (requires fastify 4), `@fastify/swagger-ui@^4` (requires fastify 4). No combination satisfies all four — startup crashes with `FST_ERR_PLUGIN_VERSION_MISMATCH` no matter which fastify version is installed.

2. **`src/handler.ts` is emitted unconditionally.** The Lambda entrypoint imports `@fastify/aws-lambda`, but that dep is only added to `package.json` when `config.compute === 'lambda'`. With the default ECS compute target, `tsc` fails at `src/handler.ts(6,30): error TS2307: Cannot find module '@fastify/aws-lambda'`.

Discovered while bringing up `dna-platform`'s api+db dev stack. Workaround applied locally: bump the four fastify deps to a v5-coherent set, delete `handler.ts`. Health check then passes (`GET /health → 200`, OpenAPI doc renders both `/v1/text` and `/v1/usage`).

This proposal makes the workaround unnecessary by fixing both issues at the adapter template.

## What Changes

### 1. Pin a coherent v5-aligned fastify dep set

Update the api-cell fastify adapter's generated `package.json` template:

| Dep | Old | New |
|---|---|---|
| `fastify` | `^4.28.0` | `^5.0.0` |
| `@fastify/cors` | `^9.0.0` | `^11.0.0` |
| `@fastify/swagger` | `^9.0.0` | `^9.0.0` *(unchanged — already v5-aligned)* |
| `@fastify/swagger-ui` | `^4.0.0` | `^5.0.0` |
| `@fastify/aws-lambda` *(when compute=lambda)* | `^4.0.0` | `^5.0.0` *(if needed; verify peer)* |

Why v5: `@fastify/swagger@^9` is already v5-only and is widely used; downgrading it loses features. The other three plugins all have v5-aligned major versions available. Fastify 5 also has the streaming SSE behavior the lambda compute target relies on (`reply.raw.write` with `awslambda.streamifyResponse`).

### 2. Emit `src/handler.ts` only when `compute: 'lambda'`

Gate the file write in the adapter on `config.compute === 'lambda'`. ECS compute targets get `src/main.ts` only. Lambda compute targets get both — `main.ts` for local dev, `handler.ts` as the Lambda entrypoint.

Symmetric: only write the lambda-specific `package.json` deps (`@fastify/aws-lambda`) when `compute === 'lambda'`. The current adapter already does this; the proposal just keeps the file emission consistent with the deps.

### 3. Adapter-conformance test asserts both compute targets build

Extend the existing fastify-adapter conformance suite to:
- Generate against a fixture for each compute target (`ecs`, `lambda`).
- For each, run `npm install --no-audit --no-fund && npm run build` in the generated dir.
- Assert exit 0 and the expected dist outputs (`dist/main.js` for both, `dist/handler.js` only for lambda).

Without this test, version drift in any of the four fastify deps will silently reintroduce the same class of failure.

## Capabilities

### Modified Capabilities
- `api-cell-fastify` — generated `package.json` is fastify-v5-aligned and internally consistent; `src/handler.ts` is emitted only when `compute === 'lambda'`.

### New Capabilities
- `api-cell-fastify-build-conformance` — both compute targets build cleanly from a clean install in CI.

## Impact

- **Affected paths**: `technical/cells/api-cell/src/adapters/node/fastify/` (templates + the file emission gate); existing fastify conformance test fixtures.
- **Backwards compatibility**: any consumer that was already silently broken on dep install gets unbroken. Anyone who was working around the version mismatch with manual `package.json` edits stops needing the workaround. There is no consumer who was successfully running the unmodified ECS output today.
- **Coordination**: `dna-platform` is the immediate beneficiary — once this lands, its `output/dna-codes/dev/api/` builds without the `package.json`/`handler.ts` patches and `cba up dna-codes --env dev` is fully hands-off through to the health check.
- **Risk profile**: low. Localized to the fastify adapter templates. The new conformance test is the safety net.
