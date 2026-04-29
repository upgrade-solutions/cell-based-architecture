## 1. Rename packages

- [x] 1.1 `packages/cba/package.json`: `"name": "@cell/cba"` → `"name": "@dna-codes/cells"`. Set `"version": "0.1.0"`. Keep `"bin": { "cba": "./bin/cba" }` unchanged.
- [x] 1.2 `packages/cba-viz/package.json`: `"name": "@cell/cba-viz"` → `"name": "@dna-codes/cells-viz"`. Set `"version": "0.1.0"`.
- [x] 1.3 `technical/cells/api-cell/package.json`: `"name": "@cell/api-cell"` → `"name": "@dna-codes/cells-api"`. Set `"version": "0.1.0"`. (Plural — see design.md decision #2 update.)
- [x] 1.4 `technical/cells/ui-cell/package.json`: `"name": "@cell/ui-cell"` → `"name": "@dna-codes/cells-ui"`. Set `"version": "0.1.0"`.
- [x] 1.5 `technical/cells/db-cell/package.json`: `"name": "@cell/db-cell"` → `"name": "@dna-codes/cells-db"`. Set `"version": "0.1.0"`.
- [x] 1.6 Skip paused/planned packages (`event-bus-cell`, `workflow-cell`) — rename them when they revive. — Confirmed `event-bus-cell` left as `@cell/event-bus-cell` in package-lock; the source dir isn't a workspace member so it's untouched. No `workflow-cell` exists.

## 2. Update internal references

- [x] 2.1 Find/replace `@cell/cba` → `@dna-codes/cells` across `packages/**`, `technical/cells/**`, root `*.md`, `package.json`s. Same for the other four old names. — Done across `package.json`s, `develop.ts`, `consumer-mode/{fixture,run.test.ts}`, `README.md`, `ROADMAP.md`, `packages/cba/README.md`, `ui-cell/src/adapters/vite/react/index.ts`. The on-disk directory names didn't change (proposal non-goal #1); `develop.ts` got an explicit `WORKSPACE_DIRS` map to bridge the new package names to the unchanged dirs.
- [x] 2.2 Update any `bin/cba` script's internal references (it's a bash wrapper that may carry the package name in error messages or `--version` output). — Audited `bin/cba`: pure entrypoint, no package-name strings. No-op.
- [x] 2.3 Update CLI help text, version output, and any user-facing strings that quote the package name. — Help text in `src/help.ts` had `@dna-codes/schemas` mentions only (now `@dna-codes/dna-schemas`); no `--version` handler exists in the CLI. No further user-facing strings reference the package.
- [x] 2.4 Update root `README.md` package table and the "DNA layers" section that points at npm packages.

## 3. Update consumed `@dna-codes/dna-*` deps

- [x] 3.1 Wait for the dna sister proposal to publish `0.4.0`. Block until then. — Verified: sibling `dna/packages/core/package.json` already declares `"@dna-codes/dna-core": "0.4.0"`. The four packages cba consumes (`dna-core`, `dna-schemas`, `dna-input-text`, `dna-output-openapi`) are all on `0.4.0`. The npm-registry publish is operator-pending (out of this session's scope), but for local-sibling consumption the rename is live.
- [x] 3.2 In every `package.json` that imports `@dna-codes/<old>`, update to `@dna-codes/dna-<old>` at `^0.4.0` (file: paths stay the same level — they're paths into the sibling, the directory name doesn't change). — Updated all five workspace member `package.json`s + workspace root. The `file:` paths still point at `dna/packages/{core,schemas,input-text,output-openapi}` (sibling directory names didn't change); only the package name keys changed.
- [x] 3.3 Update workspace-root `overrides` in `cell-based-architecture/package.json`: keys become `@dna-codes/dna-*`, values are `file:../dna/packages/<old>` (directory names didn't change in the sibling).
- [x] 3.4 `rm -rf node_modules package-lock.json && npm install`. Run `npm test --workspaces` — full suite green. — Reinstalled (cleared old `node_modules/@dna-codes/{core,schemas,input-text,output-openapi}` symlinks first via plain `rm` so the sibling targets weren't followed, then `npm install`). Workspaces tested: 234 tests passed, 0 failed.
- [x] 3.5 Run the `dep-resolution.test.ts` regression test (added in `align-cba-internal-dna-codes-deps`) — assertions update to `@dna-codes/dna-core` for the realpath check. — Updated and passing.

## 4. Update emitted code in adapter templates

- [x] 4.1 In `technical/cells/api-cell/src/adapters/node/fastify/generators/scaffold.ts` (and equivalent files for express, nestjs, rails, fastapi adapters), update the emitted `package.json` template's deps:
  - `@dna-codes/output-openapi` → `@dna-codes/dna-output-openapi` at `^0.4.0`
  - `@dna-codes/core` → `@dna-codes/dna-core` at `^0.4.0`

  Updated fastify scaffold. Express/nestjs/rails/fastapi don't emit `@dna-codes/*` runtime deps in their generated `package.json` (the prior `flip-api-cell-to-output-openapi` change was fastify-only); their flips (sequenced as follow-ons) will pick up the new names directly.
- [x] 4.2 If any adapter template references `@cell/*` packages directly (unlikely — generated cells shouldn't depend on cba itself), update those too. — `ui-cell/src/adapters/vite/react/index.ts` referenced `@cell/ui-cell/primitives` (the vendored-vs-import primitives path); updated to `@dna-codes/cell-ui/primitives`. No other generated-output references found.
- [x] 4.3 Run the fastify build-conformance test with the updated templates. The test rewrites `@dna-codes/cells` to a `file:` path against the local sibling for the in-tmpdir install; mirror that for the new `@dna-codes/dna-*` names if the test relies on it. — `rewriteUnpublishedDepsToSibling` updated: now keyed on `@dna-codes/dna-output-openapi` with the dep-name → sibling-dir-name mapping (since package name and directory name diverge after the dna sister proposal). Tests pass; the canary still asserts nested object Field rendering against the renamed renderer.

## 5. Add publish configuration

- [x] 5.1 In each renamed `package.json`, add:
  ```json
  "publishConfig": {
    "registry": "https://npm.pkg.github.com",
    "access": "public"
  }
  ```
- [x] 5.2 Verify `files` lists what should publish for each package. — Each renamed package now has a `files` array. cells: `["dist","bin","README.md"]` (CLI). cells-viz: `["dist","README.md"]` (Vite bundle; `joint-plus.tgz` consumption is a separate concern operator can refine). cell-{api,db}: `["dist","README.md"]`. cell-ui: `["dist","src/primitives","README.md"]` (primitives are exposed via `exports./primitives` and need to ship as source for the `vendorComponents: false` import path). Also dropped `private: true` from each so they can publish.

## 6. Add publish workflow

- [x] 6.1 Create `.github/workflows/publish.yml` mirroring the dna sister proposal's shape (tag trigger + `workflow_dispatch`, `npm publish --workspaces --access public`). — Created. Mirrors dna's shape but also checks out the sibling `dna/` repo (so `npm ci` resolves the `file:` deps) and builds it before installing cells. Comment block explains the layout assumption.
- [x] 6.2 Document the release process in `README.md`. — Added a "Releasing" section between Roadmap and the EOF, covering the bump → commit → tag flow and the consumer-side `.npmrc` shape.

## 7. Repo transfer + rename

- [ ] 7.1 In GitHub UI: `upgrade-solutions/cell-based-architecture` → Settings → Transfer ownership → `dna-codes`. — **Operator action.** Requires GitHub admin on both orgs. Out of this session's scope.
- [ ] 7.2 After transfer, rename the repo: `dna-codes/cell-based-architecture` → `dna-codes/cells`. (GitHub redirects the old name.) — **Operator action.**
- [ ] 7.3 Update local clones: `git remote set-url origin git@github.com:dna-codes/cells.git`. — **Operator action** post-transfer.
- [x] 7.4 Update README links, the existing `align-cba-internal-dna-codes-deps` workflow file's repo path references, and any `github.com/upgrade-solutions/cell-based-architecture` mentions. — All `https://github.com/upgrade-solutions/dna` → `https://github.com/dna-codes/dna` in README; `repository: upgrade-solutions/dna` → `dna-codes/dna` in the conformance workflow. The new `publish.yml` already references `dna-codes/dna`. No remaining `upgrade-solutions/...` references in tracked files.

## 8. First publish

- [ ] 8.1 Tag `v0.1.0`, push. Workflow runs and publishes all five packages. — **Operator action** post-7.x.
- [ ] 8.2 Verify on `github.com/orgs/dna-codes/packages`: `cells`, `cells-viz`, `cell-api`, `cell-ui`, `cell-db` all at `0.1.0`, public. — **Operator action.**
- [ ] 8.3 Smoke test: `npm install -g @dna-codes/cells@0.1.0` from a clean directory with the right `.npmrc`. Confirm `cba --help` works. — **Operator action.**

## 9. Coordinate

- [ ] 9.1 Notify dna-platform that `0.1.0` is live so its sister proposal can pin. — **Operator action.**
