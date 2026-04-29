## Why

The `@cell/*` scope was a stand-in while cba was developed in isolation. Now that the toolkit consolidates under `dna-codes` with a single npm scope (`@dna-codes/*`), this repo's packages adopt `@dna-codes/cells-*` and `@dna-codes/cell-*` so they live in the shared scope while staying visually distinct from the dna-side packages (which take a `dna-*` prefix in the sister proposal).

Forcing function: GitHub Packages requires the npm scope to match the GitHub org. The new `dna-codes` org will host this repo as `dna-codes/cells` (renamed from `cell-based-architecture`), so packages must publish under `@dna-codes/*`.

Sister proposals: `dna/openspec/changes/rebrand-to-dna-prefix/` (renames the DNA-side packages and publishes to GitHub Packages — must ship first; this proposal pulls them via the new names) and `dna-platform/openspec/changes/consume-from-github-packages/` (consumes both sides via the new names).

## What Changes

### 1. Rename every package in `packages/*` and `technical/cells/*`

| Old | New |
|---|---|
| `@cell/cba` | `@dna-codes/cells` |
| `@cell/cba-viz` | `@dna-codes/cells-viz` |
| `@cell/api-cell` | `@dna-codes/cells-api` |
| `@cell/ui-cell` | `@dna-codes/cells-ui` |
| `@cell/db-cell` | `@dna-codes/cells-db` |

`cba` stays as the **CLI binary name** (`bin: { "cba": "./bin/cba" }` in `@dna-codes/cells/package.json`). Users still type `npx cba …` — the binary is the public surface; the package is the install target. No reason to break the muscle memory.

For each renamed package: rename in `package.json`, update internal cross-package imports (`@cell/cba` → `@dna-codes/cells` everywhere), update README + AGENTS.md mentions, update tests.

### 2. Update consumed `@dna-codes/dna-*` deps to the new names

Every internal package that imports `@dna-codes/core`, `@dna-codes/schemas`, etc. updates to `@dna-codes/dna-core`, `@dna-codes/dna-schemas`, etc. Pin to the published `0.4.0` from the dna sister proposal. The `file:` deps + `overrides` from `align-cba-internal-dna-codes-deps` move to point at the new package names; the path levels stay the same.

### 3. Update emitted code in api-cell / ui-cell / db-cell adapters

The adapter generators emit `package.json` files containing `@dna-codes/*` deps in the *generated* output that ships to consumers like `dna-platform`. Update those templates to emit the new prefixed names (`@dna-codes/dna-output-openapi` instead of `@dna-codes/output-openapi`, etc.) at versions that exist on GitHub Packages.

### 4. Add `publishConfig` + publish workflow

Same shape as the dna sister proposal: `publishConfig.registry: https://npm.pkg.github.com`, `.github/workflows/publish.yml` triggered on tag push.

### 5. Repo transfer + rename

`upgrade-solutions/cell-based-architecture` → transfer to dna-codes org → rename to `dna-codes/cells`. GitHub redirects keep old URLs working. Update README links, the `cba` README's "github:upgrade-solutions/…" example, and any cross-references to the new path.

### 6. Publish v0.1.0 of the renamed packages

These have never been published before. Tag `v0.1.0` after the transfer and let the workflow publish all `@dna-codes/cells*` and `@dna-codes/cell-*` packages to GitHub Packages. dna-platform pins against `0.1.0`.

## Capabilities

### Modified Capabilities
- `cells-package-naming` — every cells/CBA package lives at `@dna-codes/cells*` or `@dna-codes/cell-*`, sharing the dna-codes scope with the dna-side packages.
- `cells-package-publishing` — packages publish to GitHub Packages on tag push.

### New Capabilities
- `cells-cli-binary-stable` — the `cba` CLI binary name is preserved through the rename so existing muscle memory and docs survive.

## Impact

- **Affected paths**: every `package.json` under `packages/` and `technical/cells/`, every internal import that referenced `@cell/*` or the old unprefixed `@dna-codes/*` names, the api-cell / ui-cell / db-cell template files that emit downstream `package.json`s, README, AGENTS.md, `.github/workflows/publish.yml` (new).
- **Backwards compatibility**: hard break. `@cell/*` was never published, so no existing consumers outside this monorepo. The local-sibling consumers (`dna-platform`) update via the platform sister proposal.
- **Coordination**: depends on `dna/.../rebrand-to-dna-prefix/` shipping first (cells imports `@dna-codes/dna-core`). Blocks `dna-platform/.../consume-from-github-packages/` (platform imports `@dna-codes/cells*` for the CLI).
- **Risk profile**: medium. Larger rename surface than dna's proposal because the @cell-prefix touches both library packages and the technical-cells emission templates.
