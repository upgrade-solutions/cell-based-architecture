---
name: Marshall Fire mass-tort domain — operational DNA
description: Phase-1 operational DNA for the marshall mass-tort demo domain is complete with all 9 nouns, 13 capabilities, 20 rules, 12 outcomes, 5 lifecycles, 4 signals, 2 equations, and 7 relationships.
type: project
---

The `dna/torts/marshall/operational.json` domain `justice.masstort.marshall` is fully built out as of 2026-04-11.

**Counts:** 9 Nouns, 13 Capabilities, 13 Causes, 20 Rules, 12 Outcomes, 5 Lifecycles, 4 Signals, 2 Equations, 7 Relationships.

**Nouns:** IntakeSubmission (existing), Claimant, Claim, Incident, Property, Evidence, CaseStatus, Firm, Attorney.

**Signals:** `marshall.IntakeSubmission.Received`, `marshall.Claimant.Qualified`, `marshall.Claimant.Registered`, `marshall.Claim.Filed`.

**Why:** AWS meetup demo showing prompt → DNA → full deployed AWS architecture in phases. Phase 1 is marketing-only (ui-cell only, mock-submit), Phase 2 adds live intake backend, Phase 3 adds staff admin, Phase 4 demos adapter swap.

**How to apply:** Product-layer agents (product-core-materializer, product-api-designer, product-ui-designer) need to be run next to materialize product.core.json from this operational DNA and update product.api.json + product.ui.json to surface the new nouns and capabilities.
