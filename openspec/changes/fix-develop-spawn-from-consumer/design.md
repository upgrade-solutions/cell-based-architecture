## Context

`cba` is consumed two ways today:

1. **In-workspace** — invoked from inside `cell-based-architecture/`, which has `dna/` and `technical/cells/` as siblings. This is how every existing test runs.
2. **From a downstream consumer** — `dna-platform` (and any future consumer) depends on `@cell/cba` via `file:../cell-based-architecture/packages/cba` and runs `npx cba <command>` from its own root. The consumer has its own `dna/<domain>/` tree but no `technical/cells/`.

`cba develop`'s in-workspace path works. The downstream-consumer path silently fails because the cell-generator spawn targets a path inside the consumer, not inside cba.

This proposal locks down the consumer-mode path with a fix and a regression test.

## Goals / Non-Goals

**Goals**
- `cba develop` works from a downstream consumer with the same UX as in-workspace.
- Spawn errors (ENOENT on cwd, missing binary, etc.) surface to the user instead of being swallowed.
- A test enforces the consumer-mode contract going forward.

**Non-Goals**
- No change to the cell generators themselves — they're verified working against `dna-platform`'s DNA via direct invocation.
- No change to `cba deploy`, `cba up`, `cba run`, `cba status` in this proposal. Audit them after this lands; if any have the same `findRepoRoot`-from-cwd pattern, treat as a follow-up.
- No change to how `findRepoRoot()` is used to locate the *consumer's* DNA. That's correct — the consumer is the source of DNA. The bug is using it to locate cba's *own* workspace.

## Decisions

### 1. Resolve cba's workspace from `@cell/cba`'s package.json, with realpath

```typescript
import * as fs from 'fs'
import * as path from 'path'

function cbaWorkspaceRoot(): string {
  const pkgPath = require.resolve('@cell/cba/package.json')
  const realPkgPath = fs.realpathSync(pkgPath)
  // realPkgPath is <workspace>/packages/cba/package.json — walk up two levels.
  return path.resolve(path.dirname(realPkgPath), '..', '..')
}

function workspaceDir(workspace: string): string {
  const name = workspace.replace('@cell/', '')
  const root = cbaWorkspaceRoot()
  if (name === 'cba') return path.join(root, 'packages', name)
  return path.join(root, 'technical/cells', name)
}
```

**Why realpath:** When cba is consumed via a `file:` dep, npm symlinks `consumer/node_modules/@cell/cba → cell-based-architecture/packages/cba`. Without `realpathSync`, `require.resolve` may follow Node's preserved-symlink semantics and return a path under the consumer's `node_modules/`, which doesn't have `technical/cells/` siblings. `realpathSync` collapses the symlink to the actual workspace location so the join works.

**Why not `__dirname`:** Equivalent on the happy path, but `require.resolve('@cell/cba/package.json')` is the public Node API for "where does this package live" and survives bundlers/path mangling that `__dirname` doesn't.

**In-workspace behavior:** identical. Inside cba, `require.resolve` returns `<workspace>/packages/cba/package.json` directly; `realpathSync` is a no-op.

### 2. Surface `spawnSync` errors

```typescript
const result = spawnSync('npx', [...], { cwd: workspaceDir(p.workspace), ... })

if (result.error) {
  emitError(
    `Failed to spawn cell generator for "${p.name}": ${result.error.message}` +
    (result.error.code === 'ENOENT' ? ` (cwd: ${workspaceDir(p.workspace)})` : ''),
    opts,
    { results: [{ cell: p.name, ok: false, error: result.error.message }] }
  )
  process.exit(1)
}

if (result.status !== 0) {
  // existing handling
}
```

**Why include the cwd in the ENOENT message:** the only ENOENT class spawnSync raises here is "cwd doesn't exist", and the cwd is exactly the diagnostic the user needs. Don't make them grep the source.

### 3. Consumer-mode regression test

Test layout:

```
packages/cba/test/consumer-mode/
  fixture/
    dna/lending/
      operational.json
      product.api.json
      product.ui.json
      product.core.json   (or rely on materialize step)
      technical.json      (one api cell, one db cell)
    package.json          (declares "@cell/cba": "file:../../../../"
                           — resolved from the test temp dir)
  run.test.ts             (jest test that copies fixture into a tmpdir,
                           runs npm install + npx cba develop, asserts output)
```

The test:

1. Copies `fixture/` into `os.tmpdir()/cba-consumer-mode-<rand>/`.
2. Rewrites the temp `package.json`'s `@cell/cba` dep to an absolute `file:` path pointing at the cba workspace under test.
3. Runs `npm install --no-audit --no-fund` in the temp dir.
4. Runs `npx cba develop lending --env dev` in the temp dir.
5. Asserts `output/lending/dev/api/package.json` exists (or whichever artifacts the api-cell adapter emits at minimum).
6. Cleans up the temp dir.

This is slow (a real `npm install`), so it goes in a separate `npm run test:consumer-mode` script and runs in CI but not on every local `npm test`. Document the script in `packages/cba/README.md`.

## Open Questions

1. **Audit other commands now or as a follow-up?** `cba deploy`, `cba run`, `cba up`, `cba status`, `cba views` may have the same `findRepoRoot`-from-cwd pattern for cba-internal paths. Lean: scope this proposal to `cba develop` (the immediate blocker for `dna-platform`) and file a follow-up `audit-consumer-mode-paths` after this lands. Auditing now expands scope and delays the unblock.
2. **Should the consumer-mode test fixture live in `dna-platform`'s repo or in cba's repo?** Lean: in cba's repo. The test asserts cba's contract; living in cba keeps the contract close to the implementation. A separate end-to-end test from `dna-platform` is fine but is a different concern.
