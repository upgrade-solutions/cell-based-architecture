## Why

`dna-platform` (the deployed `dna.codes` product) is the first hosted production workload to be built on Cell-Based Architecture. To ship it, CBA needs three additive capabilities and one architectural clarification:

1. **An `astro` ui-cell adapter** — the marketing site (`dna.codes`) and docs site (`docs.dna.codes`) both want Astro (with Starlight for docs). One adapter, two cells.
2. **A `lambda` compute target on api-cell** — the API service (`api.dna.codes`) wraps `@dna-codes/input-text` and needs SSE streaming. Lambda Function URLs with `RESPONSE_STREAM` invocation mode are the right primitive; Lambda + API Gateway is not (API Gateway buffers responses by default and caps at 30s, both fatal for SSE + long LLM calls).
3. **A terraform-aws extension for Lambda Function URLs + CloudFront origin behavior + WAF rate-based rules + RDS Proxy** — to deploy (2) to AWS without API Gateway, alongside CBA's existing ECS path.
4. **Architectural clarification: api-cell adapters consume OpenAPI, not `product.api.json`** — DNA owns the product spec; `@dna-codes/output-openapi` is the contract layer; CBA's technical adapters consume the OpenAPI contract. This split is forced now by the new lambda adapter, but it is the right shape going forward for all api-cell adapters.

Sister proposals: the `dna` repo's [`launch-dna-platform`](https://github.com/dna-codes/dna/blob/main/openspec/changes/archive/2026-04-26-launch-dna-platform/proposal.md) (which shipped `@dna-codes/output-openapi`), and the new `dna-platform` repo's `launch-dna-platform` (the deployed product itself).

## What Changes

### `astro` ui-cell adapter

- New adapter at `technical/cells/ui-cell/src/adapters/astro/`.
- Generates an Astro SSG project from `product.ui.json` (pages, layouts, blocks).
- Two configurations: **plain Astro** (for marketing) and **Astro + Starlight** (for docs).
- Starlight configuration includes the `starlight-openapi` plugin, which consumes the OpenAPI document emitted by `@dna-codes/output-openapi` (a new dependency on a DNA package — first time CBA depends on a `@dna-codes/output-*` package, but the right architectural direction).
- Build output is static HTML; terraform-aws delivers via S3 + CloudFront (already supported for vite/* adapters; reuse the same path).

### `lambda` compute target on api-cell

- Decision required: **new adapter (`lambda/node`) vs compute hint on existing fastify adapter (`compute: 'lambda' | 'ecs'`)**. Recommendation: hint on fastify adapter. Rationale: the application code is the same Fastify routes; only the entrypoint shim and packaging differ. A hint shares 95% of the adapter and avoids drift.
- The shim wraps Fastify with `@fastify/aws-lambda` (the standard adapter, ~50 LOC). The handler is exported as the Lambda entrypoint; the rest of the api-cell generated code is identical to the ECS path.
- The api-cell adapter consumes the OpenAPI document emitted by `@dna-codes/output-openapi` — this is the architectural shift mentioned above. For v1 of this change, the lambda compute target is the only adapter that consumes OpenAPI; the existing NestJS/Express/Rails/FastAPI adapters continue to consume `product.api.json` directly. Migration of those to OpenAPI is a follow-on, not a blocker.

### terraform-aws extension for lambda

- When a cell has `compute: 'lambda'`, emit:
  - `aws_lambda_function` with `package_type = 'Zip'`, code from a `lambda.zip` build artifact.
  - `aws_lambda_function_url` with `invoke_mode = 'RESPONSE_STREAM'` and `authorization_type = 'NONE'` (auth happens inside the function).
  - CloudFront `origin` block pointing at the Function URL; `ordered_cache_behavior` with `cache_policy_id` set to `Managed-CachingDisabled` for the API path.
  - `aws_wafv2_web_acl` with rate-based rule attached to the CloudFront distribution.
  - When db-cell is in the same plan and any cell has `compute: 'lambda'`, emit `aws_db_proxy` in front of RDS and inject the proxy endpoint into the lambda's env vars.

### `db-cell` RDS Proxy support

- Already partially scoped in the terraform-aws extension above. db-cell may also need a small change to emit IAM auth credentials, depending on existing implementation — verify in implementation.

## Capabilities

### New Capabilities
- `astro-ui-cell-adapter` — generate Astro SSG project (plain or Starlight) from `product.ui.json`.
- `lambda-compute-target` — produce a Fastify-on-Lambda entrypoint for any cell flagged `compute: 'lambda'`.
- `lambda-cloudfront-delivery` — terraform-aws extension emitting Lambda Function URL + CloudFront + WAF + RDS Proxy.

### Modified Capabilities
- `terraform-aws-delivery` — gains lambda compute path alongside ECS.
- `api-cell-fastify` — gains optional `compute` hint and OpenAPI consumption when compute=lambda.

## Impact

- **Affected paths**: `technical/cells/ui-cell/src/adapters/astro/` (new); `technical/cells/api-cell/src/adapters/fastify/` (extended with compute hint and OpenAPI consumption); `packages/cba/src/deliver/adapters/terraform-aws.ts` (extended); `technical/cells/db-cell/` (minor, RDS Proxy auth path).
- **Dependencies**: new dev/build dependency on `@dna-codes/output-openapi` (consumed at build time of api-cell, not at CBA runtime).
- **Backwards compatibility**: fully additive. Existing ECS-based deployments unchanged. Existing api-cell adapters continue consuming `product.api.json` directly until separately migrated.
- **First production user**: `dna-platform`. CBA bugs found by this change show up on `dna.codes`. Mitigation: pin a CBA git SHA in `dna-platform`, bump deliberately.
- **Risk profile**: moderate. Three substantial additions to a working framework. Each is testable in isolation against the existing test infra.
