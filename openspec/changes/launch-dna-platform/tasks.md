## 1. astro ui-cell adapter

- [ ] 1.1 Create `technical/cells/ui-cell/src/adapters/astro/` mirroring the structure of the existing `vite/react/` adapter.
- [ ] 1.2 Implement `flavor: 'marketing' | 'starlight'` switch on the cell config schema. Default `'marketing'`.
- [ ] 1.3 Marketing flavor: generate Astro project skeleton (`astro.config.mjs`, `src/pages/`, `src/layouts/`, `src/components/`) from `product.ui.json`. Map DNA `Page` → Astro `.astro` page; `Layout` → Astro layout component; `Block` → Astro component.
- [ ] 1.4 Starlight flavor: add `@astrojs/starlight` dependency to generated `package.json`; configure `astro.config.mjs` with Starlight integration; wire `starlight-openapi` plugin to consume an OpenAPI document path provided in cell config (path is to a file emitted by `@dna-codes/output-openapi`).
- [ ] 1.5 Build output is static; reuse the existing `vite/*` S3 + CloudFront delivery path in terraform-aws — no new delivery work for the static side.
- [ ] 1.6 Tests: parameterized over both flavors; assert generated project builds (`npm run build`) and emits expected files under `dist/`.
- [ ] 1.7 Add `astro` to the ui-cell adapter registry / docs.

## 2. lambda compute target on api-cell (fastify hint)

- [ ] 2.1 Add `compute: 'ecs' | 'lambda'` to the cell config schema, default `'ecs'`. Audit the existing fastify adapter (`technical/cells/api-cell/src/adapters/node/fastify/`) for any code that assumes a server listener.
- [ ] 2.2 When `compute === 'lambda'`, generate an entrypoint shim using `@fastify/aws-lambda` v4+ with streaming response support (`awslambda.streamifyResponse`).
- [ ] 2.3 Switch the api-cell adapter to consume the OpenAPI document emitted by `@dna-codes/output-openapi` (when `compute === 'lambda'`) instead of `product.api.json` directly. For ECS path, retain the existing direct consumption — no migration in this change.
- [ ] 2.4 Add `@dna-codes/output-openapi` as a build-time dependency of CBA (consumed during `cba deploy` code generation). Confirm no runtime CBA dependency on it.
- [ ] 2.5 Wire the OpenAPI emission step into `cba deploy`: when any cell has `compute === 'lambda'`, run `output-openapi` against `product.api.json` and write the result to a known build path; api-cell adapter reads from there.
- [ ] 2.6 Tests: generate a lambda-targeted api-cell from a fixture, assert package builds, handler invokes locally via `aws-lambda-ric` or equivalent test runner.

## 3. terraform-aws lambda + CloudFront extension

- [ ] 3.1 In `packages/cba/src/deliver/adapters/terraform-aws.ts`, add a branch in the cell loop for `cell.compute === 'lambda'`. Skip ECS task definition / target group / ALB listener rule emission for these cells.
- [ ] 3.2 Emit `aws_lambda_function` resource (zip package, IAM role, env vars, handler).
- [ ] 3.3 Emit `aws_lambda_function_url` with `invoke_mode = 'RESPONSE_STREAM'` and `authorization_type = 'NONE'`.
- [ ] 3.4 Extend the existing CloudFront block: add `origin` for the Function URL; add `ordered_cache_behavior` for the API path with `cache_policy_id = Managed-CachingDisabled`, all methods allowed, viewer protocol policy `redirect-to-https`.
- [ ] 3.5 Emit `aws_wafv2_web_acl` with one rate-based rule (default 100 req / 5 min per IP, configurable via cell config). Attach to the CloudFront distribution.
- [ ] 3.6 Emit `aws_lambda_permission` allowing CloudFront to invoke the function URL.
- [ ] 3.7 Tests: terraform-aws fixture with a lambda cell + a static UI cell + a db-cell; assert the generated `.tf` files terraform-validate successfully.

## 4. db-cell RDS Proxy when paired with lambda

- [ ] 4.1 Detect: in terraform-aws delivery, if any cell has `compute: 'lambda'` AND a db-cell is in the plan, enable RDS Proxy emission.
- [ ] 4.2 Emit `aws_db_proxy` with appropriate auth config (Secrets Manager-backed credentials).
- [ ] 4.3 Inject the proxy endpoint (not the direct RDS endpoint) into lambda env vars `DATABASE_URL` / `DATABASE_HOST`.
- [ ] 4.4 ECS-only plans: no proxy emitted, existing behavior preserved.
- [ ] 4.5 Tests: fixture with lambda + db-cell asserts proxy resource emitted; fixture with ECS + db-cell asserts proxy NOT emitted.

## 5. Documentation

- [ ] 5.1 Update CBA README / docs with the `astro` ui-cell adapter, both flavors.
- [ ] 5.2 Document the `compute` hint on api-cell, with the lambda-vs-ECS decision matrix.
- [ ] 5.3 Document the OpenAPI-as-contract architectural direction. Note that existing adapters are not migrated in this change.
- [ ] 5.4 Update terraform-aws adapter docs with the lambda emission path and WAF defaults.

## 6. Coordination

- [ ] 6.1 `@dna-codes/output-openapi@0.1.0` must be published to npm before this change's tasks 2.x can be tested end-to-end. Coordinate with the dna repo's `launch-dna-platform` change.
- [ ] 6.2 `dna-platform` will be the first consumer of all four new capabilities. Coordinate the first end-to-end deploy with that repo's `launch-dna-platform` change.
