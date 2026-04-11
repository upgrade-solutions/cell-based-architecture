---
name: CLI requires name field for all primitive types
description: The cba operational add CLI checks for a name field on every primitive, but Cause/Rule/Outcome have no name in their schemas — add these directly to operational.json instead.
type: feedback
---

The `cba operational add` CLI rejects any primitive JSON without a `name` field (line ~220 in `packages/cba/src/design.ts`). This applies even to Cause, Rule, and Outcome primitives whose schemas don't define a `name` property.

**Why:** The CLI was designed for named primitives (Noun, Capability, Lifecycle, etc.) and the guard is blanket. There's no escape hatch for unnamed top-level array items.

**How to apply:** When adding Causes, Rules, or Outcomes in bulk, write them directly into the operational.json `causes`/`rules`/`outcomes` arrays rather than calling `cba operational add`. Signals also lack CLI support (not in the PRIMITIVES registry in `primitives.ts`). Add signals directly under the top-level `signals` array in the JSON file. Relationships and Equations ARE supported by the CLI.
