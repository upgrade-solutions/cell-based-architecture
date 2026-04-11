---
name: Marshall demo — next phase agents needed
description: After operational DNA is complete, three product-layer agents must run to update product.core.json, product.api.json, and product.ui.json before Phase 2 cells can be generated.
type: project
---

After Phase 1 operational DNA was finalized (2026-04-11), the following downstream updates are needed before `cba develop torts/marshall` will produce a full Phase 2 stack:

1. **product-core-materializer** — regenerate `product.core.json` from `operational.json`. Must include all 9 Nouns and 13 Capabilities (currently only IntakeSubmission.Submit is materialized).

2. **product-api-designer** — update `product.api.json` to add endpoints for:
   - `PATCH /marshall/intakes/:id/qualify` → IntakeSubmission.Qualify
   - `GET /marshall/claimants`, `GET /marshall/claimants/:id` → Claimant
   - `PATCH /marshall/claimants/:id/assign` → Claimant.Assign
   - `POST /marshall/claimants/:id/claims` → Claim.File
   - `GET /marshall/claims/:id`, `PATCH /marshall/claims/:id/status` → Claim
   - `POST /marshall/claims/:id/evidence` → Evidence.Upload (multipart)
   - `GET /marshall/firms`, `POST /marshall/firms` → Firm.Onboard
   - `POST /marshall/firms/:id/attorneys` → Attorney.Assign

3. **product-ui-designer** — update `product.ui.json` to add the staff admin surface (ui-cell-admin) covering intake queue, claimants list/detail/assign, claims list/detail/status, evidence upload, firms/attorneys admin.

**Why:** Operational DNA is the source of truth; product and technical layers derive from it. The three product agents must run in order before technical cells can generate working code for Phase 2+.
