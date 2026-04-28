## 1. Replace `findRepoRoot`-from-cwd with package-anchored workspace resolution

- [x] 1.1 In `packages/cba/src/develop.ts` (or wherever `workspaceDir` lives — currently in `dist/develop.js` at line 248), introduce `cbaWorkspaceRoot()`:
  ```typescript
  function cbaWorkspaceRoot(): string {
    const pkgPath = require.resolve('@cell/cba/package.json')
    const realPkgPath = fs.realpathSync(pkgPath)
    return path.resolve(path.dirname(realPkgPath), '..', '..')
  }
  ```
- [x] 1.2 Update `workspaceDir(workspace)` to call `cbaWorkspaceRoot()` instead of `findRepoRoot()`. Behavior unchanged when run from inside the cba workspace.
- [x] 1.3 Confirmed: only `develop.ts` used `findRepoRoot` for cba-internal paths. `agent.ts` uses it for AGENTS.md walking, but those files now live in `@dna-codes/core` (resolved via `require.resolve`) and the remaining repo walk is for in-workspace `cba agent list` only — out of scope here per design.md §2.

## 2. Surface `spawnSync` errors in `cba develop`

- [x] 2.1 In the cell-spawn loop, after `spawnSync(...)`, check `result.error` before `result.status`. If present, emit:
  ```
  Failed to spawn cell generator for "<name>": <error.message>
  ```
  Append `(cwd: <path>)` when `error.code === 'ENOENT'`.
- [x] 2.2 In `--json` mode, include the error in the JSON `results` payload (`{ cell, ok: false, error: error.message }`).
- [x] 2.3 Existing `result.status !== 0` handling stays intact for cell-side failures (where the cell ran but exited non-zero).

## 3. Consumer-mode regression test

- [x] 3.1 Created `packages/cba/test/consumer-mode/fixture/dna/lending/` with operational, product.api, product.ui copied from the in-workspace lending domain plus a single-cell `technical.json` targeting `node/fastify` (compute=lambda, mirroring dna-platform).
- [x] 3.2 Added `packages/cba/test/consumer-mode/fixture/package.json` with `"@cell/cba": "file:../../.."` (rewritten to an absolute path at test runtime).
- [x] 3.3 Added `packages/cba/test/consumer-mode/run.test.ts` that copies the fixture into a tmpdir, rewrites the `@cell/cba` dep to an absolute file: path, runs `npm install --no-audit --no-fund`, runs `npx cba develop`, asserts the api-cell's `output/lending/dev/api/package.json` exists, and cleans up in `afterAll`.
- [x] 3.4 Wired `test:consumer-mode` script and excluded `test/consumer-mode/` from the default `test` script via `--testPathIgnorePatterns`.
- [ ] 3.5 CI job — left for whoever owns the CI pipeline. Local script is in place.
- [x] 3.6 Documented under "Run from a downstream consumer" in `packages/cba/README.md`, with rationale.

## 4. Verify against `dna-platform`

- [ ] 4.1 Once this change ships, in the `dna-platform` repo run `npm install` (no version bump needed — `file:` deps re-resolve to current `dist/`) then `npx cba develop dna-codes --env dev`. Confirm cells generate into `dna-platform/output/dna-codes/dev/{api,db}/`.
- [ ] 4.2 In the `dna-platform` repo's `openspec/changes/launch-dna-platform/tasks.md`, mark task 4.1a (this blocker) resolved and re-attempt task 4.1.

## 5. Documentation

- [x] 5.1 Added "Run from a downstream consumer" section to `packages/cba/README.md`, including the file: dep pattern and the `bin/cba` dist-preference behavior shipped earlier in this consumer-mode series.
- [ ] 5.2 Audit follow-up `audit-consumer-mode-paths` — placeholder for a separate change. Not yet filed.
