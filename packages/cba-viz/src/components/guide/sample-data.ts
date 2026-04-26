import type { Extraction, DiscoverState } from './types.ts'

// Marshall Fire case management transcript — aligned to dna/torts/marshall/
// operational.json under the new operational model. Demonstrates Resources
// + Persons + Roles + Operations + Processes + Rules.
export const SAMPLE_TRANSCRIPT = `Meeting: Marshall Fire Case Management Review
Attendees: James Worthington (Partner Attorney), David Kim (Case Manager), Lisa Martinez (Intake Specialist), Rachel Torres (Associate Attorney)

James: Let's walk through the full case lifecycle end-to-end. Start with intake.

Lisa: Every case starts as an Intake Submission from the public marketing site. The claimant submits the form themselves. As Intake Specialist, I review each submission and either qualify it or reject it. When we qualify one, the system automatically registers a Claimant record.

Lisa: Two hard rules on qualification — we only qualify submissions from Superior, Louisville, and Unincorporated Boulder County, since that's the affected fire zone. And we cannot qualify submissions older than the two-year Colorado statute of limitations. Every Claim traces back to the Marshall Fire Incident record where that date lives.

David: Once a Claimant is registered, as Case Manager I assign an Associate Attorney to represent them. We only assign active attorneys — that's enforced at the system level.

James: That completes the Claimant Intake process. After assignment, we move into Case Preparation. This is the interesting part — it runs three workstreams in parallel.

David: Right — the Paralegal assesses the Property damage from county records or insurance reports, the Paralegal uploads supporting Evidence, and the Paralegal advances the Case Status through the milestones. All three have to converge before the Associate Attorney reviews the claim package.

Rachel: When I review a claim, I need verified Evidence and a current Property assessment. The case is ready for filing at that point.

James: Then we move into Claim Resolution. The Paralegal files the formal Claim with the court. I review the filed claim for legal sufficiency. If it passes review, we update the claim status to settled or dismissed based on the negotiation. If not, we abort and send it back.

David: Evidence Collection runs as a standalone, repeatable workflow. The Paralegal uploads each document, then I verify it for authenticity. One important rule: Evidence cannot be uploaded to claims that are already settled or dismissed.

Lisa: What about withdrawals?

David: Client Withdrawal is its own process. When a Claimant decides to exit, as Case Manager I process the withdrawal, dismiss any open claims, and advance the case status to closed. Only the assigned attorney or an admin can process a withdrawal.

James: One more thing — firm management. The Firm Admin onboards new participating Firms and assigns Attorneys to them. Every Attorney belongs to exactly one Firm, and each Firm can have many Attorneys. We also need to be able to view any Claimant's full case details at any point during litigation.

James: That covers all five processes: Claimant Intake, Case Preparation, Claim Resolution, Evidence Collection, and Client Withdrawal. Let's document everything.`

export const SAMPLE_EXTRACTIONS: Extraction[] = [
  // Roles (6)
  { id: 'sx-role-1', text: 'Partner Attorney',  primitiveType: 'role', confidence: 'suggested', approved: true },
  { id: 'sx-role-2', text: 'Case Manager',      primitiveType: 'role', confidence: 'suggested', approved: true },
  { id: 'sx-role-3', text: 'Intake Specialist', primitiveType: 'role', confidence: 'suggested', approved: true },
  { id: 'sx-role-4', text: 'Associate Attorney', primitiveType: 'role', confidence: 'suggested', approved: true },
  { id: 'sx-role-5', text: 'Paralegal',          primitiveType: 'role', confidence: 'suggested', approved: true },
  { id: 'sx-role-6', text: 'Firm Admin',         primitiveType: 'role', confidence: 'suggested', approved: true },

  // Persons (4)
  { id: 'sx-per-1', text: 'James Worthington', primitiveType: 'person', confidence: 'suggested', approved: true, parentNoun: 'Partner Attorney' },
  { id: 'sx-per-2', text: 'David Kim',         primitiveType: 'person', confidence: 'suggested', approved: true, parentNoun: 'Case Manager' },
  { id: 'sx-per-3', text: 'Lisa Martinez',     primitiveType: 'person', confidence: 'suggested', approved: true, parentNoun: 'Intake Specialist' },
  { id: 'sx-per-4', text: 'Rachel Torres',     primitiveType: 'person', confidence: 'suggested', approved: true, parentNoun: 'Associate Attorney' },

  // Resources (9)
  { id: 'sx-res-1', text: 'Intake Submission', primitiveType: 'resource', confidence: 'suggested', approved: true },
  { id: 'sx-res-2', text: 'Claimant',          primitiveType: 'resource', confidence: 'suggested', approved: true },
  { id: 'sx-res-3', text: 'Claim',             primitiveType: 'resource', confidence: 'suggested', approved: true },
  { id: 'sx-res-4', text: 'Incident',          primitiveType: 'resource', confidence: 'suggested', approved: true },
  { id: 'sx-res-5', text: 'Property',          primitiveType: 'resource', confidence: 'suggested', approved: true },
  { id: 'sx-res-6', text: 'Evidence',          primitiveType: 'resource', confidence: 'suggested', approved: true },
  { id: 'sx-res-7', text: 'Case Status',       primitiveType: 'resource', confidence: 'suggested', approved: true },
  { id: 'sx-res-8', text: 'Firm',              primitiveType: 'resource', confidence: 'suggested', approved: true },
  { id: 'sx-res-9', text: 'Attorney',          primitiveType: 'resource', confidence: 'suggested', approved: true },

  // Actions (15) — one per Operation in marshall DNA, linked to parent resource
  { id: 'sx-a-1',  text: 'Submit',       primitiveType: 'action', confidence: 'suggested', approved: true, parentNoun: 'IntakeSubmission' },
  { id: 'sx-a-2',  text: 'Qualify',      primitiveType: 'action', confidence: 'suggested', approved: true, parentNoun: 'IntakeSubmission' },
  { id: 'sx-a-3',  text: 'Register',     primitiveType: 'action', confidence: 'suggested', approved: true, parentNoun: 'Claimant' },
  { id: 'sx-a-4',  text: 'View',         primitiveType: 'action', confidence: 'suggested', approved: true, parentNoun: 'Claimant' },
  { id: 'sx-a-5',  text: 'Assign',       primitiveType: 'action', confidence: 'suggested', approved: true, parentNoun: 'Claimant' },
  { id: 'sx-a-6',  text: 'Withdraw',     primitiveType: 'action', confidence: 'suggested', approved: true, parentNoun: 'Claimant' },
  { id: 'sx-a-7',  text: 'File',         primitiveType: 'action', confidence: 'suggested', approved: true, parentNoun: 'Claim' },
  { id: 'sx-a-8',  text: 'Review',       primitiveType: 'action', confidence: 'suggested', approved: true, parentNoun: 'Claim' },
  { id: 'sx-a-9',  text: 'UpdateStatus', primitiveType: 'action', confidence: 'suggested', approved: true, parentNoun: 'Claim' },
  { id: 'sx-a-10', text: 'Upload',       primitiveType: 'action', confidence: 'suggested', approved: true, parentNoun: 'Evidence' },
  { id: 'sx-a-11', text: 'Verify',       primitiveType: 'action', confidence: 'suggested', approved: true, parentNoun: 'Evidence' },
  { id: 'sx-a-12', text: 'Advance',      primitiveType: 'action', confidence: 'suggested', approved: true, parentNoun: 'CaseStatus' },
  { id: 'sx-a-13', text: 'Onboard',      primitiveType: 'action', confidence: 'suggested', approved: true, parentNoun: 'Firm' },
  { id: 'sx-a-14', text: 'Assign',       primitiveType: 'action', confidence: 'suggested', approved: true, parentNoun: 'Attorney' },
  { id: 'sx-a-15', text: 'Assess',       primitiveType: 'action', confidence: 'suggested', approved: true, parentNoun: 'Property' },

  // Processes (5)
  { id: 'sx-proc-1', text: 'Claimant Intake',    primitiveType: 'process', confidence: 'suggested', approved: true },
  { id: 'sx-proc-2', text: 'Case Preparation',   primitiveType: 'process', confidence: 'suggested', approved: true },
  { id: 'sx-proc-3', text: 'Claim Resolution',   primitiveType: 'process', confidence: 'suggested', approved: true },
  { id: 'sx-proc-4', text: 'Evidence Collection', primitiveType: 'process', confidence: 'suggested', approved: true },
  { id: 'sx-proc-5', text: 'Client Withdrawal',  primitiveType: 'process', confidence: 'suggested', approved: true },

  // Rules
  { id: 'sx-rule-1', text: 'Only qualify submissions from Superior, Louisville, and Unincorporated Boulder County', primitiveType: 'rule', confidence: 'suggested', approved: true },
  { id: 'sx-rule-2', text: 'Cannot qualify submissions older than the two-year Colorado statute of limitations',     primitiveType: 'rule', confidence: 'suggested', approved: true },
  { id: 'sx-rule-3', text: 'Only active attorneys can be assigned',                                                  primitiveType: 'rule', confidence: 'suggested', approved: true },
  { id: 'sx-rule-4', text: 'Evidence cannot be uploaded to claims that are already settled or dismissed',            primitiveType: 'rule', confidence: 'suggested', approved: true },
  { id: 'sx-rule-5', text: 'Only the assigned attorney or an admin can process a withdrawal',                        primitiveType: 'rule', confidence: 'suggested', approved: true },
]

export const SAMPLE_DISCOVER_STATE: DiscoverState = {
  sourceText: SAMPLE_TRANSCRIPT,
  extractions: SAMPLE_EXTRACTIONS,
}
