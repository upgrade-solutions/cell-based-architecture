# db-cell Agent

Agent responsible for generating the database layer for a platform. Owns invocation of `cba develop <platform> --cell <db-cell-name>` and iteration on the generated schema and migrations.

## Scope

- Select the adapter specified in technical DNA (`postgres` today; other engines as they are built)
- Generate schema, migrations, and role/privilege configuration from `product.core.json`
- Produce artifacts consumed by delivery adapters (`docker-compose` mounts init scripts, `terraform/aws` provisions RDS)

## Inputs

- `product.core.json` — Nouns become tables, Attributes become columns, Relationships become foreign keys
- The cell's entry in `technical.json` — adapter type, engine version, role config

## Outputs

- A generated directory under `output/<platform>-db/`
- Contains: SQL schema, migration files, optional seed data, role/grant statements, and a Dockerfile or init-script artifact

## Adapters

| Adapter | Engine | Status |
|---------|--------|--------|
| `postgres` | Postgres 15+ | shipped |

The Marshall Fire demo uses the `postgres` adapter.

## What the agent does during `cba develop`

1. Reads the cell's entry from `technical.json`
2. Walks `product.core.json` Nouns and Attributes to derive tables and columns
3. Walks `product.core.json` Relationships to derive foreign keys and indexes
4. Emits SQL DDL and any supporting migration tooling
5. Does **not** run the migrations itself — migration execution is the responsibility of the api-cell at startup (where the database credentials live)

## Coordination with api-cell

The api-cell adapters (Express, NestJS, FastAPI, Rails, Django) generate their own Drizzle/SQLModel/ActiveRecord/ORM schemas directly from `product.core.json` — they do not read the SQL the db-cell emits. The db-cell output is for delivery-adapter consumption only:

- `docker-compose` uses db-cell output as the init-script layer for the Postgres service
- `terraform/aws` uses it to produce RDS parameter groups and post-creation bootstrap scripts

This split is intentional. The api-cell owns runtime migrations (so the API can start against any Postgres, including one it didn't provision). The db-cell owns provisioning-time schema (so the DBA can inspect and version the canonical DDL).

## Must not touch

- `operational.json`
- api-cell or ui-cell output
- Runtime database data — the cell generates DDL, it does not connect or mutate

## Iteration loop

When schema generation fails or produces invalid SQL:

1. Read the error and the generator source in `src/adapters/postgres/`
2. Fix the generator
3. Re-run `cba develop <platform> --cell <name>`
4. Validate generated SQL with `psql --dry-run` or an equivalent parser
