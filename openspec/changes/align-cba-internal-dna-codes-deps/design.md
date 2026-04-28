## Context

The local-sibling consumption stance is well-defined for downstream consumers (`dna-platform`'s README and AGENTS.md spell it out). But cba itself sits in the *middle* of the dep chain — `dna-platform` → `cba` → `@dna-codes/*` — and cba's own `@dna-codes/*` deps were left as registry version pins.

Effect: from inside cba's dist, Node's module resolution starts at cba's *real* path (`cell-based-architecture/packages/cba/dist/`) and walks up looking for `node_modules`. The first `node_modules/@dna-codes/core` it finds is in `cell-based-architecture/node_modules/`, populated by `npm install` from the npm registry. That copy shadows everything else, including the consumer's symlinked sibling.

This is the same root cause as the previous consumer-mode bugs (workspace path assumptions; bin/cba ts-node lookup; fastify dep alignment): an internal assumption that worked when cba ran in-workspace, broken once cba was consumed downstream. The fix this time is at the dep declaration, not the runtime code.

## Goals / Non-Goals

**Goals**
- `require.resolve('@dna-codes/core')` from anywhere inside `cell-based-architecture/` (including `packages/cba/dist/`) lands at `dna/packages/core/dist/index.js` — the same path a downstream consumer would resolve.
- A single source of truth for `@dna-codes/*` versions across the multi-repo workspace: the local sibling.
- An assertion that survives future contributors who don't know the multi-repo convention and try to "clean up" the deps with version pins.

**Non-Goals**
- Vendoring `@dna-codes/*` into `cell-based-architecture/`. The whole point is to consume from the sibling.
- Publishing `@cell/*` packages or changing how cba's own packages reference each other internally (those are workspace deps, already resolved correctly).
- Changing how downstream consumers (dna-platform) declare their own deps. They already use `file:` + overrides; this proposal extends the pattern to cba's internal deps.

## Decisions

### 1. Path style — relative `file:` references, not symlinks committed to the repo

Two ways to express "consume from the sibling":

- **A. `file:` deps in `package.json`.** npm/pnpm install creates the symlink in `node_modules`; the lockfile records the relative path.
- **B. Commit the symlink directly in `node_modules/`.** Skip npm; manage manually.

A is the standard. The lockfile + `package.json` records the intent; npm install is reproducible. B is what the tactical workaround does today and is fragile (any `npm install` clobbers it).

Pick A. The tactical symlinks in `dna-platform`'s sister proposal go away once this lands.

### 2. Path levels

`cell-based-architecture/package.json` (workspace root): `file:../dna/packages/*`
`cell-based-architecture/packages/cba/package.json`: `file:../../../dna/packages/*`
`cell-based-architecture/technical/cells/api-cell/package.json` (if it carries `@dna-codes/*` deps): `file:../../../../dna/packages/*`

Each member's `file:` path is from its own location. `npm install` from any of them resolves the path correctly. This is exactly how `dna-platform`'s `package.json` is structured (`file:../dna/packages/*`); just deeper for cba's nested workspaces.

### 3. Overrides at the workspace root

```json
{
  "overrides": {
    "@dna-codes/core":       "file:../dna/packages/core",
    "@dna-codes/schemas":    "file:../dna/packages/schemas",
    "@dna-codes/input-text": "file:../dna/packages/input-text",
    "@dna-codes/output-openapi": "file:../dna/packages/output-openapi"
  }
}
```

Catches transitive references (e.g., a third-party dep that lists `@dna-codes/core` as a peer). Without this, npm could install a registry copy alongside the file copy, and Node's resolution would pick whichever appeared first in the walk.

### 4. Test gate

Add a unit test in `packages/cba/test/` or a new `packages/cba/test/dep-resolution.test.ts`:

```typescript
import { resolve } from 'path'
import { realpathSync } from 'fs'

test('@dna-codes/core resolves to the local sibling', () => {
  const resolved = realpathSync(require.resolve('@dna-codes/core/package.json'))
  expect(resolved).toMatch(/\/dna\/packages\/core\/package\.json$/)
  expect(resolved).not.toMatch(/node_modules\/@dna-codes\/core\/package\.json$/)
})
```

Runs in the existing `npm test` job. Fast (sub-millisecond). Fails loud if anyone reverts to a registry pin or drops the override.

## Open Questions

1. **Should `technical/cells/*` workspace members declare their own `@dna-codes/*` deps, or hoist?** The workspace root's `overrides` makes this moot for resolution, but the per-package declarations document intent. Lean: declare per-package where the import actually exists; rely on overrides for transitives.
2. **What about `@dna-codes/output-openapi`?** Currently not a runtime dep of cba (only build-time consumed by api-cell adapters in some paths). Add to `overrides` as a precaution; declare per-package only if/when it becomes a real dep.
3. **CI matrix.** If CI runs cba tests on a clean checkout without the `dna` sibling, `npm install` fails. Two options: (a) check out both repos in CI; (b) cache a vendored copy of `dna/` somewhere CI can reach. Lean: (a). Coupling is real; explicit is better than vendored drift.

## Implementation discovery — workspace-root declaration is required for symlinking

**Problem found during apply.** Declaring `@dna-codes/core: file:../../../dna/packages/core` only in workspace member `package.json`s (per the proposal) caused npm 11 to **copy** the package into `node_modules/@dna-codes/core` rather than symlink it. `realpath` on the resolved path returned the copy, not the sibling — defeating the change's primary goal. `install-links=false` in `.npmrc` had no effect: per npm docs, "this option has no effect on workspaces."

**Fix.** Declare `@dna-codes/*` ALSO at the workspace root's `dependencies`. The root is itself a non-workspace package, so its `file:` deps follow non-workspace rules — npm symlinks instead of copying. Workspace members keep their per-package declarations (documents the import site, satisfies static analysis), and they dedupe to the root's symlinked copy. The `overrides` block at the root catches transitives the same way it would have anyway.

**Net change to the proposed shape.** The proposal called for per-member `file:` deps + workspace-root `overrides`. The shipped shape adds a third moving piece: per-member `file:` deps + workspace-root `dependencies` (file: refs) + workspace-root `overrides`. The regression test (`packages/cba/test/dep-resolution.test.ts`) asserts the realpath lands at the sibling — if a future contributor "cleans up" by dropping the root `dependencies` block, the test fails loud, surfacing this constraint at edit time rather than at runtime.

**Side effects discovered while running tests.** The sibling `@dna-codes/core` ships an `AGENTS.md` and a richer set of layer docs than the registry @0.3.0 copy. `cba agent dna-core` now resolves successfully (was expected to error against the registry copy), and the JSON file path emitted by `cba agent <layer> --json` traces through the sibling (e.g. `../dna/packages/core/docs/operational.md`) instead of `node_modules/@dna-codes/core/docs/operational.md`. Both behaviors reflect reality more accurately; `agent.test.ts` was updated accordingly.
