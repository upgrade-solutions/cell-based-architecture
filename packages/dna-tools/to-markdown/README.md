# `@dna/to-markdown`

Render DNA documents as markdown — opinionated documentation output with configurable sections.

Zero runtime dependencies. Works against the DNA shapes described by [`@dna/core`](../../dna/) but doesn't import it, so callers can pass raw JSON directly without an install graph.

## Install

```bash
npm install @dna/to-markdown
```

## Usage

```ts
import { render } from '@dna/to-markdown'
import operational from './dna/acme/operational.json'

const md = render({ operational })
// → '# acme\n\nOur loan origination domain.\n\n## Summary\n...\n'
```

Pick specific sections:

```ts
render(
  { operational },
  { sections: ['summary', 'sops'], title: 'Acme SOP Handbook' },
)
```

## API

### `render(dna, options?)`

Returns a markdown string.

```ts
render(dna: DnaInput, options?: RenderOptions): string
```

**`DnaInput`** — any subset of the five DNA layers:

```ts
interface DnaInput {
  operational?: OperationalDna
  productCore?: ProductCoreDna
  productApi?: ProductApiDna
  productUi?: ProductUiDna
  technical?: TechnicalDna
}
```

v1 only consumes the operational layer; the other slots are reserved for future sections (`api`, `architecture`).

**`RenderOptions`**:

| Option | Default | Meaning |
|--------|---------|---------|
| `sections` | `DEFAULT_SECTIONS` | Ordered list of sections to include |
| `title` | domain's `path` or `name` | H1 title for the document |
| `headingLevel` | `1` | Top-level heading depth (`1` or `2`). Sections nest one level below. |

**`Section`** values:

| Section | What it renders |
|---------|-----------------|
| `summary` | Domain header, primitive counts, top-level nouns |
| `domain-model` | Each Noun with attribute table, verbs, outgoing relationships |
| `capabilities` | For every Capability: triggers (Causes), Rules, Outcomes, emitted Signals |
| `sops` | Each Process as a numbered playbook with resolved Position + Capability per step |
| `process-flow` | ASCII outline of each Process DAG with branch markers and dep arrows |

The default set is `['summary', 'domain-model', 'capabilities', 'sops', 'process-flow']`, exported as `DEFAULT_SECTIONS`.

## Section previews

### `summary`

```markdown
## Summary

**Domain:** `shop.books`

**Primitive counts:**

- Nouns: 1
- Capabilities: 2
- Rules: 2
- Outcomes: 1
- Signals: 1
- Relationships: 1
- Positions: 1
- Tasks: 3
- Processes: 1

**Top-level nouns:** `Book`
```

### `domain-model`

```markdown
## Domain Model

### Book

A book for sale.

| Attribute | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes | Unique identifier |
| `title` | string | yes | Book title |
| `status` | enum | yes | draft | active | retired |

**Verbs:** `Publish`, `Retire`

**Relationships:**
- `Book.author` — many-to-one → `Author` (via `author_id`)
```

### `capabilities`

```markdown
## Capabilities

### Book.Publish

Publish a draft book to the storefront.

**Triggered by:**
- user (Editor publishes a book.)

**Rules:**
- *Access:* role `editor`
- *Condition:* book.status == "draft"

**Outcomes:**
- Sets `book.status` → `"active"`
- Emits `shop.Book.Published`
```

### `sops`

```markdown
## SOPs

### PublishFlow

How a draft book becomes live.

**Operator:** `Editor`

1. **review** — `Editor` does `Book.Publish`
   Editor reviews the draft.
2. **approve** — `Editor` does `Book.Publish` (when: passed) — after: `review`
   Editor approves and publishes.
3. **reject** — `Editor` does `Book.Retire` (else) — after: `review`
   Editor rejects the draft.
```

### `process-flow`

````markdown
## Process Flows

### PublishFlow

```
├── review: ReviewBook
├── approve: ApproveBook [when: passed] ← review
└── reject: RejectBook [else] ← review
```
````

The outline is intentionally simple — each step prints on one line with its dependencies called out with `←`. A richer ASCII DAG (with aligned branches and converging arms) is a v1.1 candidate.

## Roadmap

Planned sections, not yet shipped:

- `signals` — a flat catalog of all signals with payload tables (currently nested under each Capability)
- `equations` — named computations with typed inputs and output
- `api` — Product API as endpoint reference, grouped by resource
- `architecture` — Technical DNA as an ASCII cell/construct diagram
- `erd` — ASCII entity-relationship diagram

## License

MIT.
