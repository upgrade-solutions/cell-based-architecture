## Why

`cba`'s validator (and any other code path that imports `@dna-codes/*`) loads a stale registry-installed copy from `cell-based-architecture/node_modules/@dna-codes/core/` instead of the local sibling at `dna/packages/core/`. Even when a downstream consumer (e.g. `dna-platform`) carries `file:` deps + `overrides` for `@dna-codes/*` pointing at the local sibling, Node's module resolution from inside cba's dist (real path, not symlink path) walks up `cell-based-architecture/`'s tree first and binds to the registry copy.

Discovered while wiring `dna-platform` against `dna/openspec/changes/add-object-field-type` (which extended the Field schema with `type: "object"`). The local sibling had the new schema; cba's validator rejected it because it was reading the old schema from the shadow copy in cba's own workspace.

This is the same shape as the prior consumer-mode issues: cba assumes its workspace deps are satisfied by the registry, which works in-workspace but breaks the local-sibling chain a downstream consumer depends on. The `dna-platform` repo already pins `@dna-codes/*` via `file:../dna/packages/*` as the durable consumption stance; cba should mirror that for its **internal** deps so the chain is unbroken end-to-end.

Tactical workaround applied today: replace `cell-based-architecture/node_modules/@dna-codes/{core,schemas}` with manual symlinks to `../../dna/packages/{core,schemas}`. Survives the running `npm install` in dna-platform, but any `npm install` inside `cell-based-architecture` will re-pull the registry copies and clobber the symlinks. This proposal makes the symlink behavior the *intended* state.

## What Changes

### 1. Switch cba workspace's `@dna-codes/*` deps to `file:` references

In `cell-based-architecture/`'s top-level `package.json` (the workspace root) and any package within it that declares an `@dna-codes/*` dep — `packages/cba/package.json`, `technical/cells/api-cell/package.json` if applicable, and any other workspace member — replace:

```json
"@dna-codes/core": "^0.3.0",
"@dna-codes/schemas": "^0.3.0",
"@dna-codes/input-text": "^0.3.0"
```

with:

```json
"@dna-codes/core":       "file:../../../dna/packages/core",
"@dna-codes/schemas":    "file:../../../dna/packages/schemas",
"@dna-codes/input-text": "file:../../../dna/packages/input-text"
```

(Path levels per workspace member — workspace root uses `file:../dna/packages/*`, deeper members count up.)

### 2. Add `overrides` at the workspace root to lock transitive resolutions

```json
"overrides": {
  "@dna-codes/core":       "file:../dna/packages/core",
  "@dna-codes/schemas":    "file:../dna/packages/schemas",
  "@dna-codes/input-text": "file:../dna/packages/input-text"
}
```

This forces any transitive `@dna-codes/*` reference (from third-party deps, plugins, etc.) to also resolve to the local sibling. Mirrors the pattern `dna-platform`'s `package.json` already uses.

### 3. README: document the multi-repo workspace assumption

Add a short "Sibling repos" section to `README.md` explaining that `cell-based-architecture` consumes `@dna-codes/*` from a sibling `dna/` checkout under the same parent directory, and that running `npm install` inside `cell-based-architecture` requires the sibling to be present and built. Mirror the section that exists in `dna-platform`'s README.

### 4. CI: don't break

If any CI job runs `npm install` in `cell-based-architecture` without the `dna` sibling present, it will fail to resolve the `file:` paths. Two options:

- Check out both repos in CI before installing.
- Keep a small fallback to registry deps gated by an env var or `optionalDependencies`.

Recommendation: the first. The repos co-evolve; CI for cba already implicitly depends on `@dna-codes/*` matching, and a sibling checkout is a small step.

## Capabilities

### Modified Capabilities
- `cba-internal-deps` — `@cell/cba` and other cba workspace members consume `@dna-codes/*` via `file:` references to a sibling `dna/` checkout, identical to the pattern downstream consumers use.

### New Capabilities
- `cba-multi-repo-workspace` — explicit documentation of the multi-repo workspace assumption (cba beside dna beside dna-platform, all under one parent dir, all consuming each other via `file:`).

## Impact

- **Affected paths**: every `package.json` in `cell-based-architecture/` that declares a `@dna-codes/*` dep; the workspace root for `overrides`; `README.md`; CI workflow files if they exist.
- **Backwards compatibility**: anyone running `cell-based-architecture/` standalone (no sibling `dna/` checkout) will fail at `npm install`. Document the requirement; offer a fallback only if a real workflow needs it.
- **Coordination**: `dna-platform` is the immediate beneficiary — once this lands and `cba` is rebuilt, the local-sibling chain is unbroken end-to-end. The tactical symlink workaround in `dna-platform`'s sister proposal becomes unnecessary.
- **Risk profile**: low. Localized to `package.json`s; the runtime behavior is the same code, just resolved from the local sibling. The new test (below) is the safety net.

### New runtime test

Add a small assertion to the existing test suite (or a new test) that confirms `require.resolve('@dna-codes/core')` from inside cba's dist resolves to a path under `<workspace>/../dna/packages/core/` — not a registry copy. One assertion, fast, catches the next time someone reverts to a registry dep.
