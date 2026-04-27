## ADDED Requirements

### Requirement: Fastify adapter accepts the `compute` hint

The Fastify api-cell adapter at `technical/cells/api-cell/src/adapters/node/fastify/` SHALL read the `compute` hint from the cell config and adapt its emitted entrypoint accordingly. For `compute === 'ecs'` (or unset), the adapter MUST emit an entrypoint that calls `app.listen()` on the configured port. For `compute === 'lambda'`, the adapter MUST emit a handler entrypoint compatible with the `lambda-compute-target` capability and MUST NOT emit a server listener.

#### Scenario: ECS path retains existing server listener

- **WHEN** the Fastify adapter generates a cell without a `compute` hint
- **THEN** the generated entrypoint imports the Fastify app and calls `app.listen()` on the configured port
- **AND** no Lambda-related modules (`@fastify/aws-lambda`, `awslambda.streamifyResponse`) are imported

#### Scenario: Lambda path emits handler without listener

- **WHEN** the Fastify adapter generates a cell with `compute: 'lambda'`
- **THEN** the generated entrypoint exports a Lambda handler wrapping the Fastify app via `@fastify/aws-lambda` v4+ in streaming mode
- **AND** the entrypoint does not call `app.listen()`

### Requirement: Fastify adapter consumes OpenAPI when `compute === 'lambda'`

The Fastify adapter SHALL switch its DNA input source from `product.api.json` to the OpenAPI document emitted by `@dna-codes/output-openapi` when generating a Lambda-targeted cell. ECS-targeted cells MUST continue to consume `product.api.json` directly until separately migrated. This boundary is the architectural precedent for OpenAPI-as-contract in CBA.

#### Scenario: Lambda generation reads from the emitted OpenAPI document

- **WHEN** the adapter generates a Fastify cell with `compute: 'lambda'`
- **THEN** route definitions, schemas, and operation metadata are sourced from the OpenAPI document at the build path used by the Lambda compute target
- **AND** the generated code does not import or reference `product.api.json` directly

#### Scenario: ECS generation continues to read `product.api.json`

- **WHEN** the adapter generates a Fastify cell without a `compute` hint
- **THEN** the generator continues to read `product.api.json` directly as before this change
- **AND** no dependency on `@dna-codes/output-openapi` is introduced for that cell
