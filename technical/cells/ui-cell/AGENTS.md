# ui-cell Agent

Agent responsible for generating the UI layer for a platform. Owns invocation of `cba develop <platform> --cell <ui-cell-name>` and iteration on the generated output.

## Scope

- Select the adapter specified in technical DNA (`vite/react`, `vite/vue`, `next/react`)
- Generate a runnable UI from `product.core.json` + `product.ui.json`
- Generate layout, routes, pages, blocks, and API client bindings
- Support multiple UI cells per platform — each targeting a distinct Product UI surface (e.g. public marketing + staff admin)

## Inputs

- `product.core.json` + `product.ui.json` for the target platform
- The cell's entry in `technical.json` (adapter type, layout features, API base URL)
- The Product UI surface identifier (when more than one surface is declared in `product.ui.json`)

## Outputs

- A generated application directory under `output/<platform>-ui[-<surface>]/`
- Contains: app source, layout shell, pages per route, blocks, DNA copied to `src/dna/`, Dockerfile, build manifest

## Adapters

| Adapter | Framework | Status | Notes |
|---------|-----------|--------|-------|
| `vite/react` | React 18 + Vite + Radix + Tailwind | shipped | Universal layout, XState machine, white-label theme |
| `vite/vue` | Vue 3 + Vite | shipped | Parity with React adapter for list/detail/form flows |
| `next/react` | Next.js (SSR/SSG) | shipped | Server-rendered pages |

## Layouts

Each cell picks a layout from `product/schemas/web/layout.json`:

- `universal` (shipped) — app shell with sidebar, profile, tenant picker, theme toggle, nested nav
- `marketing` (planned) — header nav + hero + footer for public marketing surfaces
- `auth` (planned) — centered card for login/register
- `wizard` (planned) — step-based flow with progress indicator
- `dashboard` (planned) — grid of resizable panels

The Marshall Fire demo needs both `universal` (admin) and `marketing` (public intake). Marketing layout work is tracked under Phase 5a.

## Selecting the Product UI surface

When `product.ui.json` declares multiple surfaces (public + admin), the cell's entry in `technical.json` must name which surface it targets:

```json
{
  "name": "ui-cell-public",
  "adapter": { "type": "vite/react", "surface": "public" },
  "...": "..."
}
```

If no `surface` is specified and only one surface exists, the agent picks that surface automatically.

## Must not touch

- `operational.json` — cells only read product core
- `technical.json` — read-only from the cell's perspective
- Sibling ui-cell output directories

## Iteration loop

When generation or build fails:

1. Read the error and the generator source in `src/adapters/<runtime>/<framework>/`
2. Fix the generator, not the generated output
3. Re-run `cba develop <platform> --cell <name>`
4. If the build fails at runtime (Vite errors, missing imports), check the generated `src/routes/`, `src/pages/`, `src/blocks/` — mismatches between product.ui.json and the renderer are common regressions
