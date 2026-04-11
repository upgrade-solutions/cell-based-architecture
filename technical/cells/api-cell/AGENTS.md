# api-cell Agent

Agent responsible for generating the API layer for a platform. Owns invocation of `cba develop <platform> --cell <api-cell-name>` and iteration on the generated output.

## Scope

- Select the adapter specified in technical DNA (`node/express`, `node/nestjs`, `python/fastapi`, `ruby/rails`, and — when built — `python/django`)
- Generate a runnable API from `product.core.json` + `product.api.json` + `product.ui.json`
- Wire auth, validation, routing, database, signal middleware, and signal receiver endpoints
- Iterate on generated output when a build/test fails

## Inputs

- `product.core.json` + `product.api.json` for the target platform
- The cell's entry in `technical.json` (adapter type, auth provider, signal dispatch config)

## Outputs

- A generated application directory under `output/<platform>-api/` (or a name derived from the cell name)
- Contains: app source, DNA copied to `src/dna/`, Dockerfile, package manifest, migrations (if Postgres), signal middleware, signal receiver

## Adapters

| Adapter | Engine | Status | Notes |
|---------|--------|--------|-------|
| `node/express` | TypeScript + Express | shipped | Runtime interpreter — reloads DNA on file change, hot-swaps router |
| `node/nestjs` | TypeScript + NestJS | shipped | Static code generation (controllers, services, DTOs, Drizzle schema) |
| `python/fastapi` | Python + FastAPI | shipped | Pydantic models + SQLModel |
| `ruby/rails` | Ruby + Rails API | shipped | ActiveRecord models + RSpec scaffolds |
| `python/django` | Python + Django REST Framework | **planned (Phase 5b)** | Required for the Marshall Fire demo |

## What the agent does during `cba develop`

1. Reads the cell's entry from `technical.json`
2. Resolves auth provider config (if any) and signal dispatch config from the cell's adapter config
3. Invokes the adapter's `generate(api, core, outputDir, authConfig, signalDispatch)` function
4. Writes generated files to the output directory
5. If the adapter produces a Docker artifact, copies `Dockerfile` + `.dockerignore` alongside

## Signal middleware contract

Generated APIs automatically publish Signals declared in `Outcome.emits`. The signal middleware:

- Reads `product.core.json` at startup to resolve each route's Capability → Outcome → emits chain
- Wraps `res.json()` to capture response entities on 2xx
- Publishes to the configured event bus (RabbitMQ in dev, SNS+SQS in prod) with typed payloads
- HTTP-POSTs to subscriber `/_signals/:signalName` endpoints listed in `dna/signal-dispatch.json` (Pattern A)

## Signal receiver contract

Generated APIs also expose receiver endpoints for every `Cause` with `source: "signal"`:

- `POST /_signals/:signalName` — validates payload, dispatches to the Capability handler
- No auth — inbound signals are trusted (caller is another cell on the same VPC / private network)

## Must not touch

- `operational.json` — cells only read product core
- `technical.json` — technical-stack-designer owns it; the cell agent reads its own section read-only
- Other cells' output directories

## Iteration loop

When generation fails (TypeScript compile errors, missing imports, adapter bug):

1. Read the error and the generator source in `src/adapters/<lang>/<framework>/`
2. Fix the generator, not the generated output (generated output is always recreated)
3. Re-run `cba develop <platform> --cell <name>`
4. Repeat until the output builds and starts

If the adapter itself is missing or insufficient (e.g. no `python/django` yet), escalate to the user — don't try to retrofit a different adapter.
