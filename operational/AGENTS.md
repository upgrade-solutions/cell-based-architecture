# Operational Layer Agents

Agents scoped to the Operational DNA layer. Operational DNA is the pure business-logic layer: the Nouns, Verbs, Capabilities, Attributes, Domains, Causes, Rules, Outcomes, Lifecycles, Signals, Equations, and Relationships that describe *what the business does* — independent of how it's surfaced or deployed.

## Agent: `operational-dna-architect`

Owns authoring and evolving a domain's `operational.json`. Available as a Claude Code sub-agent type (`operational-dna-architect`) and invokable via `cba agent operational/AGENTS.md` once that CLI lands.

### Scope — what this agent owns

- Translating domain research (real-world processes, reference sources, stakeholder interviews) into Operational primitives
- Producing a single `operational.json` that passes `cba validate --layer operational`
- Iterating the primitive set as research reveals new Nouns/Capabilities/Rules/Signals
- Ensuring the domain hierarchy in `Domain.hierarchy` correctly nests under the platform root

### Inputs

- A `prompt.md` or equivalent research brief for the domain (e.g. `dna/torts/marshall/prompt.md`)
- Any referenced external sources (URLs, PDFs, transcripts) — the agent is expected to fetch and read them
- Existing `operational.json` in the target directory, if one exists (agent edits in place)

### Outputs

- **`operational.json`** at the target domain directory (e.g. `dna/torts/marshall/operational.json`)
- Must validate against `operational/schemas/operational.json`
- Must pass cross-layer validation (`cba validate`) against any existing product layer

### Primitives owned

All twelve Operational primitives — see `operational/schemas/*.json` for the canonical list:

`Noun`, `Verb`, `Capability`, `Attribute`, `Domain`, `Cause`, `Rule`, `Outcome`, `Lifecycle`, `Signal`, `Equation`, `Relationship`

### Must not touch

- **Product layer** — `product.core.json`, `product.api.json`, `product.ui.json`. Surface decisions belong to the product-layer agents.
- **Technical layer** — cells, constructs, providers, environments. Stack decisions belong to `technical-stack-designer`.
- **Generated output** — `output/` is owned by per-cell agents during `cba develop`.

### Hand-off

When `operational.json` is settled and validates, hand off to **`product-core-materializer`** (see `product/AGENTS.md`). The materializer reads `operational.json` and produces `product.core.json` — a self-contained slice of operational DNA that downstream layers consume.

### Tools

- `cba validate --layer operational --dna <path>` — validates a single operational.json
- `cba validate --dna <domain-dir>` — cross-layer validation against any existing product/technical DNA
- Read/Write/Edit for `operational.json` itself
- WebFetch for reference sources named in the prompt

### Invariants

1. **Single source of truth**. `operational.json` is authoritative for business logic. Product core is derived from it, not the other way around.
2. **No surface leakage**. Operational primitives never mention REST paths, React components, databases, or cloud resources.
3. **Every Capability has a Verb**, every Verb belongs to a Noun, every Rule references a real Capability or Attribute. Cross-references must resolve.
