## Context

CBA today (per repo state at time of writing): ui-cell adapters for `vite/react`, `vite/vue`, `next/react`. api-cell adapters for `node/nestjs`, `node/express`, `node/fastify`, `python/fastapi`, `ruby/rails`. db-cell with Docker (local) and RDS (prod) emission. Delivery adapters: `docker-compose` and `terraform-aws`. The terraform-aws adapter already handles VPC, subnets, RDS, ECS, ALB, CloudFront for static UIs, S3, ECR, IAM, Secrets Manager.

The Marshall Fire deployment (`output/torts/marshall/prod/`) is the existing reference: ECS-based API behind ALB, static UI on CloudFront, RDS, RabbitMQ-via-SNS/SQS event bus. That deployment is the proof-of-concept this change builds on.

`dna-platform` adds three requirements that don't fit cleanly into the existing path:

- Astro for marketing+docs (no astro adapter exists).
- SSE on the API (ECS+Fastify can do SSE, but the platform's compute model leans toward scale-to-zero for usage-based billing).
- Lambda Function URLs (no lambda compute path exists in the terraform-aws adapter).

## Goals / Non-Goals

**Goals**
- Ship the three additive capabilities (`astro` ui-cell, `lambda` compute target, terraform-aws lambda path) such that `dna-platform` can `cba deploy dna-codes --env prod --adapter terraform/aws` end-to-end.
- Establish that **OpenAPI is the contract** between DNA's product layer and CBA's technical adapters. The new lambda compute target consumes OpenAPI emitted by `@dna-codes/output-openapi`.
- Preserve all existing adapters' behavior. No breaking changes; ECS path stays the default for api-cells without a `compute` hint.

**Non-Goals**
- Migrating the existing api-cell adapters (NestJS, Express, Rails, FastAPI) to consume OpenAPI. That's a separate, larger initiative — captured in this design as future direction, not in this change's tasks.
- Aurora Serverless v2 or other DB choice. RDS + Proxy is the v1 answer.
- API Gateway support. Function URLs + CloudFront covers the use case; API Gateway adds two product-blocking issues (response buffering, 30s cap) and zero unique benefit.
- Multi-region failover or blue/green deployment. v1 is single-region direct-replace.

## Decisions

### 1. Lambda compute is a hint on the existing fastify adapter, not a new adapter

Reason: the Fastify route handlers, schema validation, middleware, and the OpenAPI consumption logic are the same regardless of whether the host is an ECS container or a Lambda Function URL. Only the entrypoint and packaging differ:

- **ECS path**: `node server.js`, server listens on `:PORT`, ALB health check.
- **Lambda path**: `exports.handler = awsLambdaFastify(app)` with `@fastify/aws-lambda`, no listener, packaged as a zip.

Sharing the adapter avoids divergence (a feature added to the fastify adapter automatically works on lambda) and keeps the codebase smaller. The cell config gains `compute: 'ecs' | 'lambda'` (default `'ecs'` for backwards compat).

### 2. SSE through Lambda Function URL + CloudFront

Function URLs with `invoke_mode = 'RESPONSE_STREAM'` enable streamed responses. CloudFront passes them through transparently (no special CloudFront config needed beyond `cache_policy_id = Managed-CachingDisabled` for the API path so it doesn't try to buffer for cache).

The Fastify-on-Lambda shim must use the streaming-friendly variant (`awslambda.streamifyResponse`) and Fastify must use `reply.raw.write()` for SSE. `@fastify/aws-lambda` v4+ supports this.

### 3. Architectural clarification: OpenAPI as the contract

The new lambda adapter consumes the OpenAPI document emitted by `@dna-codes/output-openapi`, not `product.api.json` directly. This is captured as a fact in the proposal because:

- It establishes the right boundary: DNA owns the spec, OpenAPI is the contract, CBA owns the implementation.
- Every existing OpenAPI tool (codegen, mocking, validation, fuzzing) becomes available to CBA without bespoke work.
- It avoids re-deriving the DNA→framework mapping in every new api-cell adapter.

Existing adapters are not migrated in this change. Migration plan for them is a follow-on initiative; this change establishes the precedent.

### 4. Astro adapter ships two cells from one source

The astro adapter is parameterized by a `flavor: 'marketing' | 'starlight'` cell config. Both flavors generate an Astro project; `starlight` adds Starlight as a dependency and wires its content collection.

Both consume `product.ui.json` for pages, layouts, and blocks. The `starlight` flavor additionally consumes a path to the OpenAPI document (output of `@dna-codes/output-openapi`) for API reference rendering via the `starlight-openapi` plugin.

### 5. terraform-aws lambda emission

When `cell.compute === 'lambda'`:

```hcl
aws_lambda_function          # the function
aws_lambda_function_url      # invoke_mode=RESPONSE_STREAM, authorization_type=NONE
aws_cloudfront_distribution  # already exists; add origin pointing at Function URL
aws_wafv2_web_acl            # rate-based rule, attached to CloudFront
aws_db_proxy                 # if db-cell is in plan; in front of RDS
```

The `terraform-aws.ts` adapter loops over cells; the `compute` hint switches the emitted resource set. ALB and ECS task definitions are not emitted for lambda cells.

### 6. RDS Proxy when paired with lambda

Lambda + RDS without a proxy is a known footgun (cold connections at any concurrency). When any cell in the plan has `compute: 'lambda'` and a db-cell exists, the terraform-aws adapter emits `aws_db_proxy` and injects the proxy endpoint into the lambda's env vars in place of the direct RDS endpoint.

For ECS-only plans, the proxy is not emitted (existing behavior preserved).

## Open Questions

1. Does the existing fastify adapter cleanly support a `compute` hint, or does its current code structure assume a server listener? Audit during implementation.
2. Where in the build pipeline does `output-openapi` run? Two options: (a) `cba deploy` runs it as part of code generation; (b) `dna-platform` runs it in a `prebuild` script. (a) is cleaner; (b) is simpler. Lean: (a) — CBA already orchestrates code generation, this fits.
3. WAF rate limits — defaults? Probably 100 req / 5 min per IP for `/v1/text` is sane for v1; configurable per cell.
4. Lambda packaging — `zip` (smaller, faster cold starts) vs container image (more flexible). Lean: zip for v1; container image when bundle exceeds 250 MB or native deps force it.
