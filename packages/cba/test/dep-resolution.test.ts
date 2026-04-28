/**
 * Regression net for the openspec change `align-cba-internal-dna-codes-deps`.
 *
 * cba consumes `@dna-codes/*` from a sibling `dna/` checkout under the same
 * parent dir, via `file:` deps. The whole point is that `require.resolve`
 * lands at the sibling — not at a registry copy in `node_modules/`.
 *
 * Why this is fragile: npm's default behavior for workspace member `file:`
 * deps is to *copy* (not symlink), so per-member declarations alone produce
 * a node_modules copy that shadows the sibling. The fix is to declare
 * `@dna-codes/*` at the workspace **root** (a non-workspace package) — that
 * triggers symlinking, and workspace members dedupe to the symlink. If a
 * future contributor "cleans up" by dropping the root declaration or
 * reverting a member to a `^0.x` registry pin, this test fails loud.
 *
 * If this test fails:
 *   - Confirm `cell-based-architecture/package.json` still declares
 *     `@dna-codes/*` under `dependencies` with `file:../dna/packages/*`.
 *   - Confirm the sibling `dna/` checkout exists at `../dna/`.
 *   - Run `npm install` from the workspace root.
 */
import { realpathSync } from 'fs'
import * as path from 'path'

test('@dna-codes/core resolves to the local sibling, not a node_modules copy', () => {
  const resolved = realpathSync(require.resolve('@dna-codes/core/package.json'))
  // Land under .../dna/packages/core/package.json, not under .../node_modules/.
  expect(resolved).toMatch(/\/dna\/packages\/core\/package\.json$/)
  expect(resolved).not.toMatch(/node_modules\/@dna-codes\/core\/package\.json$/)

  // And the resolved sibling lives outside cell-based-architecture/ entirely.
  // Walk up from the resolved package.json: parent is `core/`, then `packages/`,
  // then `dna/`. That `dna/` must be a sibling of cell-based-architecture/, not
  // nested inside it.
  const dnaRoot = path.resolve(path.dirname(resolved), '..', '..')
  const repoRoot = path.resolve(__dirname, '..', '..', '..')
  expect(path.dirname(dnaRoot)).toBe(path.dirname(repoRoot))
})
