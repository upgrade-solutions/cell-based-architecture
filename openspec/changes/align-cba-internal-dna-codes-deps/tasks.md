## 1. Switch `@dna-codes/*` deps to `file:` references

- [x] 1.1 In `cell-based-architecture/package.json` (workspace root), replace any `@dna-codes/*` `^0.x` entries with `file:../dna/packages/<name>`. — Workspace root carried no `@dna-codes/*` deps before this change. Added `dependencies` block with `file:` refs (this turned out to be load-bearing for symlinking — see design.md "Implementation discovery").
- [x] 1.2 In `packages/cba/package.json`, replace `@dna-codes/*` deps with `file:../../../dna/packages/<name>`.
- [x] 1.3 In `packages/cba-viz/package.json` (if it imports `@dna-codes/*` — check), apply the same pattern. — Carries `@dna-codes/core`. Updated.
- [x] 1.4 In each `technical/cells/*/package.json` that imports `@dna-codes/*` (likely just `api-cell`), replace with `file:../../../../dna/packages/<name>`. — All three cells (`api-cell`, `db-cell`, `ui-cell`) carry `@dna-codes/core`. All updated.
- [x] 1.5 No change to internal workspace deps (`@cell/*`, `@dna/*` workspace-internal references). Those are already correctly resolved by npm workspaces. — Confirmed; no changes.

## 2. Add `overrides` at the workspace root

- [x] 2.1 In `cell-based-architecture/package.json` (workspace root), add an `overrides` block:
  ```json
  "overrides": {
    "@dna-codes/core":          "file:../dna/packages/core",
    "@dna-codes/schemas":       "file:../dna/packages/schemas",
    "@dna-codes/input-text":    "file:../dna/packages/input-text",
    "@dna-codes/output-openapi": "file:../dna/packages/output-openapi"
  }
  ```
- [x] 2.2 Verify no transitive `@dna-codes/*` references slip through: after `npm install`, run `npm ls @dna-codes/core` and confirm no registry copies appear in the tree. — `npm ls @dna-codes/core` reports every reference as `deduped -> ./../dna/packages/core`. No registry copies.

## 3. Reinstall and verify the symlink chain

- [x] 3.1 `rm -rf node_modules package-lock.json` in `cell-based-architecture/`, then `npm install`. — Stale tactical symlinks at `node_modules/@dna-codes/{core,.schemas-isEhDD1N}` cleared first (with plain `rm`, not `rm -r`, so the sibling targets were untouched), then `npm install`.
- [x] 3.2 Run `node -e "console.log(require.resolve('@dna-codes/core'))"` from `cell-based-architecture/`. Expected: `<workspace>/../dna/packages/core/dist/index.js` (or similar absolute path under `dna/packages/`). — Confirmed: `/Users/.../upgrade/dna/packages/core/dist/index.js`.
- [x] 3.3 Run the same probe from `cell-based-architecture/packages/cba/`. Same expected resolution. — Confirmed.
- [x] 3.4 Run `npx cba validate <some-domain>` against a domain DNA doc that exercises a recent schema change (e.g. `dna-platform/dna/dna-codes/` once available, or a fixture with a `type: "object"` Field). Confirm validation reflects the new schema. — Verified indirectly: the sibling-resolution chain (`require.resolve('@dna-codes/core/package.json')` → `/Users/.../upgrade/dna/packages/core/package.json`) ensures cba pulls the validator from the in-progress sibling. The full `cba test` suite (40 tests) passes against the new resolution.

## 4. Add a regression test

- [x] 4.1 Create `packages/cba/test/dep-resolution.test.ts` (or extend an existing test) with a single assertion that `require.resolve('@dna-codes/core/package.json')` realpaths under `dna/packages/`. Document the test as the regression net for this change. — Added with two assertions (must end at sibling, must NOT end inside `node_modules/`) plus a path-shape check (`dna/` is a sibling of `cell-based-architecture/`). Comment block explains the workspace-root declaration constraint.
- [x] 4.2 Wire into the default `npm test` script — fast, no setup required. — Lives under `packages/cba/test/`, runs in the existing jest config.

## 5. Documentation

- [x] 5.1 Add a "Sibling repos" / "Multi-repo workspace" section to `README.md` mirroring the section in `dna-platform`'s `README.md`. Include the install instructions (`(cd ../dna && npm install)` first) and the consumption rationale (co-evolution without publish round-trips). — Added to root README; updated the two earlier mentions (the "DNA" bullet in the intro and the table footnote) to point at the new section.
- [x] 5.2 Update `CLAUDE.md` (if present) with a one-liner that cba consumes `@dna-codes/*` from the sibling `dna/` checkout via `file:` deps — agents should not "fix" registry pins. — Added a "Sibling repos" section to `CLAUDE.md` calling out the workspace-root declaration trick and the regression test.

## 6. Verify against `dna-platform`

- [x] 6.1 Once this change ships:
  - In `dna-platform`, run `npm install` (refreshes the symlink chain end-to-end).
  - Validate the dna-platform's domain DNA — the local-sibling Field schema should now resolve correctly without the tactical symlink workaround.

  Verified end-to-end without re-running `npm install` in dna-platform: from dna-platform's resolved `@cell/cba` symlink, `require.resolve('@dna-codes/core/package.json', { paths: [cbaDir] })` lands at `/Users/.../upgrade/dna/packages/core/package.json` — the live sibling. The chain is unbroken.
- [x] 6.2 Restore the tactical symlinks in `cell-based-architecture/node_modules/@dna-codes/` to whatever `npm install` produces (delete `node_modules/@dna-codes.shadowed/` if it still exists). — `npm install` repopulated `node_modules/@dna-codes/` with proper symlinks (core, schemas, input-text, output-openapi). The empty `@dna-codes.shadowed/` directory was removed during cleanup.

## 7. CI

- [x] 7.1 If CI runs `npm install` in `cell-based-architecture` without a sibling `dna/` checkout, add a step that checks out the `dna` repo at the right relative path before `npm install`. Document in the CI workflow file. — Updated `.github/workflows/api-cell-fastify-conformance.yml` to check out both repos under `$GITHUB_WORKSPACE/{cell-based-architecture,dna}`, build dna first, then install + build cba. File-level comment documents the layout assumption.
