# event-bus-cell Agent

Agent responsible for generating the event bus client, schema registry, and subscriber routing for a platform. Owns invocation of `cba develop <platform> --cell <event-bus-cell-name>`.

## Scope

- Read Signals from `product.core.json` across all surfaced domains
- Emit a typed publisher library (used by api-cell adapters)
- Emit a subscriber routing config (used by api-cell signal receivers and standalone workers)
- Support multiple transports via `engine` selection (RabbitMQ in dev, SNS+SQS in prod)

## Inputs

- `product.core.json` — Signal definitions and their payload schemas
- The cell's entry in `technical.json` — adapter type, engine, transport config

## Outputs

- A generated directory under `output/<platform>-event-bus/`
- Contains: schema registry (JSON), typed publisher (TypeScript), subscriber routing config, optional worker skeleton

The event bus cell is a **code generator**, not a runtime service. At deployment time, the delivery adapter (`docker-compose` or `terraform/aws`) provisions the actual transport:

- `docker-compose` with `engine: "rabbitmq"` runs a RabbitMQ container (management UI on :15672)
- `terraform/aws` with `engine: "sns+sqs"` provisions SNS topics per Signal + SQS queues per subscriber + IAM policies

## Adapters

| Adapter | Engines | Status |
|---------|---------|--------|
| `node/event-bus` | `rabbitmq`, `sns+sqs` | shipped |

## What the agent does during `cba develop`

1. Reads the cell's entry from `technical.json` to resolve engine + transport config
2. Collects all Signals from `product.core.json`
3. Generates the schema registry as a JSON file
4. Generates the typed publisher module (one function per Signal, payload typed from Signal's field schema)
5. Generates the subscriber config — maps Signal names to subscriber cell endpoints (for Pattern A HTTP push) or queue names (for Pattern B worker)
6. If `engine === "rabbitmq"`, generates an amqplib-based client (connection, channel, publish, subscribe with ack/nack)

## Delivery-adapter integration

The cell does not itself produce a runtime service. Delivery adapters must:

- **docker-compose**: detect event-bus-cell and skip it as a runtime service (already implemented — see `packages/cba/src/deliver/adapters/docker-compose.ts`). The RabbitMQ service comes from the `event-bus` Construct, not the cell.
- **terraform/aws**: same — the event-bus-cell produces client code, while SNS/SQS infrastructure comes from the `storage/queue` Construct.

## Must not touch

- `operational.json`
- Other cells' output directories
- Runtime transport state — the cell generates client code, it does not connect at generate time

## Iteration loop

When generation fails:

1. Read the error and the generator source in `src/adapters/node/event-bus/generators/`
2. Fix the generator
3. Re-run `cba develop <platform> --cell <name>`
4. Verify the generated client against the Signal payload schemas in `product.core.json`

## Future engines

Planned engines (not yet built):

- `kafka` — for high-throughput platforms
- `redis-streams` — for lower-overhead single-region setups
- `eventbridge` — for AWS-native event routing without the SNS+SQS fan-out pattern
