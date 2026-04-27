## ADDED Requirements

### Requirement: api-cell accepts a `compute` hint of `ecs` or `lambda`

The api-cell config schema SHALL accept a `compute` field with values `'ecs' | 'lambda'`, defaulting to `'ecs'`. Existing api-cells without a `compute` field MUST continue to generate ECS-targeted code with no behavior change.

#### Scenario: Default compute remains ECS for existing cells

- **WHEN** an existing api-cell configuration without a `compute` field is processed
- **THEN** the generator targets ECS exactly as it did prior to this change
- **AND** no Lambda-specific files (entrypoint shim, packaging metadata) are emitted

#### Scenario: Explicit `compute: 'lambda'` switches to the Lambda path

- **WHEN** an api-cell configuration sets `compute: 'lambda'`
- **THEN** the generator emits a Lambda entrypoint shim instead of an ECS server entry
- **AND** the cell skips emission of any artifacts that assume a long-running listener

### Requirement: Lambda entrypoint streams responses via `awslambda.streamifyResponse`

When `compute === 'lambda'`, the api-cell adapter SHALL emit an entrypoint that wraps the Fastify app with `@fastify/aws-lambda` v4+ using the streaming-friendly `awslambda.streamifyResponse` variant, so SSE responses are forwarded without buffering.

#### Scenario: Generated handler streams an SSE response

- **WHEN** a Lambda-compiled api-cell is invoked locally with a request that triggers an SSE route using `reply.raw.write()`
- **THEN** the response is delivered as a stream of events through the Lambda streaming interface
- **AND** the test runner observes events as they are written, not after the handler returns

### Requirement: Lambda compute target consumes OpenAPI as its DNA contract

When `compute === 'lambda'`, the api-cell adapter SHALL consume the OpenAPI document emitted by `@dna-codes/output-openapi` as the source of route, schema, and operation metadata, rather than reading `product.api.json` directly. ECS-targeted cells MUST continue to consume `product.api.json` directly until separately migrated.

#### Scenario: Build pipeline emits the OpenAPI document before the Lambda adapter runs

- **WHEN** `cba deploy` runs against a plan containing any api-cell with `compute: 'lambda'`
- **THEN** `output-openapi` runs against `product.api.json` and writes its result to a known build path
- **AND** the Lambda api-cell adapter reads the emitted OpenAPI document from that path during generation
- **AND** ECS-targeted api-cells in the same plan continue to read `product.api.json` directly
