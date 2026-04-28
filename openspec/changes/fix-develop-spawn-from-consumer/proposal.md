## Why

`cba develop` can't run from a downstream consumer (e.g. `dna-platform` which depends on `@cell/cba` via a `file:` reference). It silently fails with `✗ Cell "<name>" generation failed` and no further detail.

Discovered while bringing up the api+db slice of `dna-platform` for its first local docker stack. The cell generator itself works correctly against the consumer's DNA — direct invocation from inside the cba workspace produces the expected output. The bug is in `cba develop`'s spawn-from-consumer wiring.

This is the third in a series of consumer-mode issues found while wiring `dna-platform`:

1. ✅ (shipped) `@cell/cba` `dist/` requiring internal `@dna/*` workspace names — rebuilt against `@dna-codes/core` and `@dna-codes/schemas`.
2. ✅ (shipped) `bin/cba` bash wrapper requiring `ts-node` from the consumer's tree — falls back to the prebuilt `dist/`.
3. ❌ (this proposal) `cba develop` resolving cell workspaces via the consumer's repo root.

Each of the three is the same shape: a path that worked when cba ran from inside its own monorepo silently breaks when cba is consumed as an installed package. This proposal also tightens the failure mode so the next class of these doesn't masquerade as a cell-side bug.

## Root cause

`packages/cba/dist/develop.js`:

```javascript
function workspaceDir(workspace) {
  const { findRepoRoot } = require('./context');
  const root = findRepoRoot();                       // walks up from cwd looking for a `dna/` ancestor
  const name = workspace.replace('@cell/', '');
  if (name === 'cba') return path.join(root, 'packages', name);
  return path.join(root, 'technical/cells', name);   // ← non-existent under a consumer's repo
}
```

When cba is invoked from `dna-platform/`, `findRepoRoot()` finds `dna-platform/dna/` and returns `dna-platform/` — so `workspaceDir('api-cell')` resolves to `dna-platform/technical/cells/api-cell/`, which doesn't exist.

`spawnSync` is then called with that non-existent `cwd`. On macOS/Linux, this populates `result.error` with `ENOENT` and `result.status` becomes `null`. The current develop loop only inspects `result.status !== 0`, so it prints `✗ Cell "<name>" generation failed` with no detail and exits 1.

## What Changes

### 1. Resolve the cba workspace from `@cell/cba`'s install location, not from the consumer's cwd

Add a helper that finds the `cell-based-architecture` workspace root by:

1. Resolving `require.resolve('@cell/cba/package.json')`.
2. Calling `fs.realpathSync` on the result so a `file:` symlink in the consumer's `node_modules/` is followed back to the actual workspace.
3. Returning `path.resolve(path.dirname(realPkgPath), '..', '..')` — i.e. `<workspace>/packages/cba/package.json` → `<workspace>`.

`workspaceDir(name)` switches from `findRepoRoot()` to this helper. Behavior is identical when cba runs from inside its own workspace (the realpath of `packages/cba/package.json` is still `<workspace>/packages/cba/package.json`).

### 2. Surface `spawnSync` errors so silent ENOENTs don't reappear

In `cba develop`'s cell-spawn loop:

- After `spawnSync(...)`, if `result.error` is truthy, print it and exit. Don't fall through to the generic `✗ Cell "<name>" generation failed` message that hides the cause.
- This is purely additive — no existing failure path changes.

### 3. Test from a downstream consumer

Add a fixture-based test that:

- Stages a temporary directory containing a `dna/<domain>/` tree and a `package.json` with `"@cell/cba": "file:<repo>/packages/cba"`.
- Runs `npm install` then `npx cba develop <domain> --env <env>` from that directory.
- Asserts the cell output appears under `<tmp>/output/<domain>/<env>/<cell>/`.

This is the missing test that would have caught issues 1, 2, and 3. Mark it as the consumer-mode regression suite for cba.

## Capabilities

### Modified Capabilities
- `cba-develop` — resolves cell workspaces by `@cell/cba`'s install location; surfaces `spawnSync` errors.

### New Capabilities
- `cba-consumer-mode-test` — fixture-based test exercising `cba develop` from a downstream consumer.

## Impact

- **Affected paths**: `packages/cba/src/develop.ts` (workspaceDir + spawn error handling); `packages/cba/src/context.ts` (export the new helper if shared); a new test fixture under `packages/cba/test/` or equivalent.
- **Backwards compatibility**: fully additive. When cba runs from inside its own monorepo, the resolved workspace root is identical. The new error surfacing only adds detail to existing failure paths.
- **First downstream consumer**: `dna-platform`. Once this lands and `dna-platform` rebuilds against the new cba, `npx cba develop dna-codes --env dev` should generate the api + db cells into `dna-platform/output/dna-codes/dev/`.
- **Risk profile**: low. Localized change; behavior preserved inside the workspace; new test is the safety net.
