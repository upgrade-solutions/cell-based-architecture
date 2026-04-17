# `@dna/core`

DNA is a JSON description language for business systems. This package ships the canonical JSON schemas, TypeScript bindings, and manifest for the three DNA layers.

- **Operational DNA** — *what the business does*: nouns, verbs, capabilities, rules, outcomes, signals, equations, SOPs
- **Product DNA** — *what gets built*: resources, operations, endpoints, pages, blocks
- **Technical DNA** — *how it gets built*: cells, constructs, providers, variables, environments

See [`docs/`](./docs/) for the full primitive vocabulary per layer.

## Installation

```bash
npm install @dna/core
```

## Usage

### TypeScript / JavaScript

```ts
import { schemas, documents, SCHEMA_ROOT, resolveSchemaFile } from '@dna/core'

// Per-primitive schemas
schemas.operational.noun          // → { $id: 'https://dna.local/operational/noun', ... }
schemas.product.api.endpoint
schemas.technical.cell

// Layer-aggregate schemas (the shape of a full DNA document)
documents.operational
documents.productApi
documents.technical

// Filesystem paths — useful for dev servers and tooling that
// needs to serve raw schema files
resolveSchemaFile('operational', 'noun')
// → '/abs/path/to/node_modules/@dna/core/schemas/operational/noun.json'
```

### Raw JSON (any language)

Schemas ship as plain `.json` files at the package root. Python, Ruby, Rust,
or any other language can read them directly:

```
node_modules/@dna/core/schemas/
  operational/*.json
  product/{core,api,web}/*.json
  product/product.{core,api,ui}.json
  technical/*.json
```

Or via the package's subpath export (Node 16+):

```ts
import nounSchema from '@dna/core/schemas/operational/noun.json'
```

## What this package *does not* include

- **A validator.** See [`@dna/validator`](../dna-validator) for the ajv-based reference implementation.
- **A CLI.** See [`@dna/cli`](../cba) (planned).
- **Cell runtimes.** Cells are separate consumers of DNA — see the cell-based architecture packages.

## Contract

DNA schemas are language-agnostic. The three layers are intentionally decoupled, and cross-layer references (e.g. a Product `Resource` pointing at an Operational `Noun`) are validated outside this package by a dedicated validator. See each layer's document in [`docs/`](./docs/) for the authoring rules.
