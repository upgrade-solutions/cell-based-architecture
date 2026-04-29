## Context

`@cell/*` was a placeholder scope while cba developed in isolation. The scope was never published anywhere — packages are consumed via `file:` from sibling checkouts (in dna-platform and the in-repo workspace). Now that the toolkit consolidates under `dna-codes`, this repo joins the shared scope with a `cells-*` / `cell-*` prefix that mirrors the dna-side `dna-*` prefix.

This proposal also flips two consumption paths:
- **Internally**: cba consumes `@dna-codes/dna-core`, `@dna-codes/dna-schemas`, etc. (the renamed dna-side packages from the sister proposal). The `file:`-based local-sibling consumption stays for development; deploy/publish pulls from GitHub Packages.
- **Externally**: cba's own packages publish to GitHub Packages so dna-platform can consume them via the registry instead of `file:` symlinks.

## Goals / Non-Goals

**Goals**
- Every package in this repo publishes as `@dna-codes/cells*` or `@dna-codes/cell-*` to GitHub Packages.
- The `cba` CLI binary remains invokable as `cba` / `npx cba` — no break to the user-facing surface.
- The api-cell, ui-cell, db-cell adapters emit `package.json` files that reference the new dna-side names so cells generated for downstream consumers (dna-platform) install cleanly from the registry.
- Publish workflow mirrors the dna-side shape for consistency.

**Non-Goals**
- Refactoring how cells consume each other. The internal workspace structure stays — `packages/*` for libraries, `technical/cells/*` for the cell engines. Only names change.
- Migrating off `cba` as the binary name. The package is `@dna-codes/cells`; the binary is `cba`. Decoupling them is the whole point.
- Republishing every prior `@cell/*` version under the new name. Prior versions never shipped to a registry — there's nothing to migrate. Start at `0.1.0` under the new name.

## Decisions

### 1. Package-name vs binary-name decoupling

`@dna-codes/cells/package.json` declares:

```json
{
  "name": "@dna-codes/cells",
  "bin": { "cba": "./bin/cba" }
}
```

`npm install -g @dna-codes/cells` installs the package and exposes `cba` on the PATH. `npx @dna-codes/cells` runs `cba` (npm's `bin` resolution). The CLI's name is the binary, not the package — same pattern as `@anthropic-ai/claude-code` shipping `claude` on the PATH.

### 2. Naming nuance: everything scoped to `cells-*`

| Pattern | Use for |
|---|---|
| `cells` | the framework + CLI itself |
| `cells-*` | every other package (viewer + each cell type) |

`@dna-codes/cells` is the framework + CLI. `@dna-codes/cells-viz` is the viewer. `@dna-codes/cells-api`, `@dna-codes/cells-ui`, `@dna-codes/cells-db` are the individual cell types. The unified `cells-*` prefix makes the scope visually obvious — every package in this repo lives under one logical namespace, mirroring how the dna-side packages all live under `dna-*`.

(Earlier draft of this design carried a singular-vs-plural distinction — `cells-*` for aggregates, `cell-*` for individual cells. Discarded after implementation: the visual coherence of one prefix beats the grammatical accuracy of two.)

### 3. Internal `@dna-codes/dna-*` consumption

Internal package.json deps + the workspace-root `overrides` (from the prior `align-cba-internal-dna-codes-deps` change) point at `@dna-codes/dna-*` (renamed) at version `0.4.0`. The `file:../../../dna/packages/<name>` paths stay for in-workspace development; the path levels don't change. Once the dna sister proposal publishes `0.4.0` to GitHub Packages, the `file:` references become an optional override (for local dev) and the published versions become the canonical source.

### 4. api-cell / ui-cell / db-cell template updates

Each adapter emits a `package.json` for the generated output. Today those templates contain hardcoded `@dna-codes/output-openapi` (etc.) at `^0.1.0`. Update to:

```jsonc
{
  "@dna-codes/dna-output-openapi": "^0.4.0",
  "@dna-codes/dna-core": "^0.4.0"
  // ...
}
```

The version range here can be caret because the *generated* output ships to consumers (like dna-platform) that pin exact versions in their *own* `package.json` if they want to. The template's purpose is to declare a working baseline.

### 5. CLI internal references

The `cba` source code refers to `@cell/cba` in package metadata, error messages, help text. Find/replace to `@dna-codes/cells`. Help output, README examples, `cba --version` (if it embeds the package name) — all update.

### 6. Publish workflow

Identical shape to the dna sister proposal's. Same triggers (tag push), same scope (`@dna-codes`), same auth (`GITHUB_TOKEN`).

## Open Questions

1. **Should the repo be renamed `dna-codes/cells` or `dna-codes/cba`?** The repo's contents are *the cells framework*; `cells` is the conceptual name. `cba` is just the CLI. Lean: `dna-codes/cells`, mirroring `dna-codes/dna`. Anyone looking for the CLI source ends up at `dna-codes/cells/packages/cells/bin/cba`.
2. **Does `@dna-codes/cells` need an `unpkg` field for browser-bundled use?** No — it's a CLI / Node-only package. The viz package might need this; address there if it becomes relevant.
3. **What about `event-bus-cell` and `workflow-cell` that are listed as "planned" / "paused"?** Skip in this rename; rename them when they revive. Adding placeholder packages to the rebrand is dead weight.
