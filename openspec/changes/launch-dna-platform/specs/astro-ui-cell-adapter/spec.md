## ADDED Requirements

### Requirement: Astro adapter generates a static site from `product.ui.json`

The ui-cell SHALL ship an `astro` adapter at `technical/cells/ui-cell/src/adapters/astro/` that reads `product.ui.json` and emits an Astro project. The generated project MUST build with `npm run build` and produce a static `dist/` directory suitable for delivery via S3 + CloudFront.

#### Scenario: Generate marketing-flavor project from a fixture DNA

- **WHEN** the astro adapter runs against a fixture `product.ui.json` with one or more `Page` definitions and `flavor: 'marketing'` (or default flavor)
- **THEN** the adapter writes `astro.config.mjs`, `src/pages/`, `src/layouts/`, and `src/components/` files
- **AND** each DNA `Page` becomes a `.astro` page, each `Layout` becomes an Astro layout component, and each `Block` becomes an Astro component
- **AND** running `npm run build` in the generated project succeeds and emits files under `dist/`

### Requirement: Adapter supports `marketing` and `starlight` flavors

The astro adapter SHALL accept a `flavor` cell config value of `'marketing'` (default) or `'starlight'`. The `starlight` flavor MUST add `@astrojs/starlight` as a dependency, configure Starlight in `astro.config.mjs`, and wire the `starlight-openapi` plugin against an OpenAPI document path supplied via cell config.

#### Scenario: Starlight flavor wires an OpenAPI reference

- **WHEN** the astro adapter runs with `flavor: 'starlight'` and a cell config providing an `openapiPath` pointing at a document emitted by `@dna-codes/output-openapi`
- **THEN** the generated `package.json` lists `@astrojs/starlight` as a dependency
- **AND** the generated `astro.config.mjs` registers the Starlight integration with the `starlight-openapi` plugin pointing at `openapiPath`
- **AND** the built site renders an API reference page sourced from the OpenAPI document

### Requirement: Adapter is registered for ui-cell discovery

The astro adapter SHALL be discoverable through the ui-cell adapter registry alongside `next` and `vite`, so that `cba` tooling and documentation list it as a supported choice.

#### Scenario: `cba` lists `astro` as a ui-cell adapter

- **WHEN** a developer inspects the available ui-cell adapters via `cba` (CLI listing or generated docs)
- **THEN** `astro` appears in the registry alongside `next` and `vite`
- **AND** the README or adapter docs describe both `marketing` and `starlight` flavors
