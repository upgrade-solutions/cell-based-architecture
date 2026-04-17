# `@dna/core`

DNA is a JSON description language for business systems. This package ships the canonical JSON schemas, TypeScript bindings, and layer docs for the three DNA layers.

| Layer | What it captures | Analogous to |
|-------|------------------|--------------|
| **Operational DNA** | What the business does | Domain-Driven Design |
| **Product DNA** | What gets built | OpenAPI + Atomic Design |
| **Technical DNA** | How it gets built | Terraform / AWS SAM |

DNA is a *contract*, not a runtime. Producers (authoring agents, humans) emit JSON that conforms to these schemas; consumers (validators, viewers, code-generation cells) read the JSON and do something useful with it.

- [`docs/operational.md`](./docs/operational.md) — authoring contract for operational DNA
- [`docs/product.md`](./docs/product.md) — authoring contract for product DNA (core + api + ui)
- [`docs/technical.md`](./docs/technical.md) — authoring contract for technical DNA
- [`AGENTS.md`](./AGENTS.md) — agent contract for working with DNA at large

## Installation

```bash
npm install @dna/core
```

## API

### `schemas`

Nested object of every per-primitive JSON schema, keyed by layer:

```ts
import { schemas } from '@dna/core'

schemas.operational.noun           // 15 operational primitives
schemas.product.core.role          // 5 product-core primitives
schemas.product.api.endpoint       // 4 product-api primitives
schemas.product.web.page           // 4 product-web (UI) primitives
schemas.technical.cell             // 11 technical primitives
```

Each schema is a JSON Schema Draft-07 document with a stable `$id`:

```ts
schemas.operational.noun.$id
// → 'https://dna.local/operational/noun'
```

### `documents`

Aggregate schemas describing the shape of a full DNA document per layer:

```ts
import { documents } from '@dna/core'

documents.operational              // shape of operational.json
documents.productCore              // shape of product.core.json
documents.productApi               // shape of product.api.json
documents.productUi                // shape of product.ui.json
documents.technical                // shape of technical.json
```

### `allSchemas()`

Flat array of every schema (primitives + aggregates). Convenient for bulk-registering with a JSON Schema validator:

```ts
import Ajv from 'ajv'
import { allSchemas } from '@dna/core'

const ajv = new Ajv({ strict: false, allErrors: true })
for (const s of allSchemas()) ajv.addSchema(s)

const validate = ajv.getSchema('https://dna.local/operational/noun')
validate({ name: 'Loan' })         // → true
```

### `resolveSchemaFile(family, name)`

Returns the on-disk path of a schema file, or `null` if it doesn't exist. Useful for dev servers or tooling that needs to serve raw schema files:

```ts
import { resolveSchemaFile } from '@dna/core'

resolveSchemaFile('operational', 'noun')
// → '/abs/.../node_modules/@dna/core/schemas/operational/noun.json'

resolveSchemaFile('product', 'api/endpoint')      // nested path
// → '/abs/.../schemas/product/api/endpoint.json'

resolveSchemaFile('operational', 'ghost')         // missing
// → null
```

### `SCHEMA_ROOT`, `layerDirs`

Filesystem roots for consumers that walk the tree themselves:

```ts
import { SCHEMA_ROOT, layerDirs } from '@dna/core'

SCHEMA_ROOT                        // .../node_modules/@dna/core/schemas
layerDirs.operational              // .../schemas/operational
layerDirs.product                  // .../schemas/product
layerDirs.technical                // .../schemas/technical
```

### Subpath imports

Individual JSON schemas are also reachable directly through the package's subpath exports (Node 16+):

```ts
import nounSchema from '@dna/core/schemas/operational/noun.json'
```

## Validating a DNA document

`@dna/core` is schemas-only. Pair it with [`@dna/validator`](../dna-validator) for the reference per-layer + cross-layer validator:

```ts
import { DnaValidator } from '@dna/validator'
import operational from './dna/lending/operational.json'

const validator = new DnaValidator()
const result = validator.validate(operational, 'operational/operational')
if (!result.valid) {
  for (const err of result.errors) console.error(err.instancePath, err.message)
}

// Cross-layer: verify Product references valid Operational Nouns, etc.
const cross = validator.validateCrossLayer({ operational, productApi })
if (!cross.valid) for (const err of cross.errors) console.error(err)
```

## Using schemas from non-JS languages

The JSON files ship at the package root. Point any JSON-Schema validator (Python `jsonschema`, Ruby `json-schema`, Rust `jsonschema` crate, etc.) at:

```
node_modules/@dna/core/schemas/
  operational/*.json              # 15 primitive + 1 aggregate
  product/core/*.json             # 5 primitives
  product/api/*.json              # 4 primitives
  product/web/*.json              # 4 primitives
  product/product.{core,api,ui}.json   # 3 aggregates
  technical/*.json                # 11 primitives + 1 aggregate
```

Schemas cross-reference each other by absolute URI (e.g. `https://dna.local/operational/attribute`), so your validator must register **all** schemas before validating any one of them. The `allSchemas()` helper does this for you in JS; see the corresponding pattern in your target language's validator.

## Primitive vocabulary

| Layer | Primitives |
|-------|-----------|
| Operational | `Noun`, `Verb`, `Capability`, `Attribute`, `Domain`, `Relationship`, `Cause`, `Rule`, `Outcome`, `Signal`, `Equation`, `Position`, `Person`, `Task`, `Process` |
| Product | `Resource`, `Action`, `Operation`, `Role`, `Layout`, `Page`, `Route`, `Block`, `Field`, `Namespace`, `Endpoint`, `Schema`, `Param` |
| Technical | `Environment`, `Cell`, `Construct`, `Provider`, `Variable`, `Output`, `Script`, `View`, `Node`, `Connection`, `Zone` |

No primitive name is shared across layers. See each layer's doc in [`docs/`](./docs/) for full semantics.

## What this package does *not* include

- **A validator.** See [`@dna/validator`](../dna-validator).
- **A CLI.** See [`@cell/cba`](../cba) (command: `cba`) for the full authoring lifecycle.
- **Cell runtimes.** Cells are separate consumers of DNA — see `technical/cells/*`.

## Versioning

DNA schemas are the contract; breaking changes require a major version bump. `$id` URIs (`https://dna.local/<layer>/<primitive>`) are stable identifiers and will not change without a deprecation path.

## License

MIT.
