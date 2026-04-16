import type { Extraction, DiscoverState } from './types.ts'

// Marshall Fire case management transcript — aligned to dna/torts/marshall/
// operational.json. Covers all 9 Nouns, all 15 Capabilities (via their verbs),
// all 6 Positions, all 5 Processes, and the key condition Rules.
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
  // Positions (6) — all positions in marshall DNA
  { id: 'sx-pos-1', text: 'Partner Attorney', primitiveType: 'position', confidence: 'suggested', approved: true },
  { id: 'sx-pos-2', text: 'Case Manager', primitiveType: 'position', confidence: 'suggested', approved: true },
  { id: 'sx-pos-3', text: 'Intake Specialist', primitiveType: 'position', confidence: 'suggested', approved: true },
  { id: 'sx-pos-4', text: 'Associate Attorney', primitiveType: 'position', confidence: 'suggested', approved: true },
  { id: 'sx-pos-5', text: 'Paralegal', primitiveType: 'position', confidence: 'suggested', approved: true },
  { id: 'sx-pos-6', text: 'Firm Admin', primitiveType: 'position', confidence: 'suggested', approved: true },

  // Persons (4) — all persons in marshall DNA
  { id: 'sx-per-1', text: 'James Worthington', primitiveType: 'person', confidence: 'suggested', approved: true, parentNoun: 'Partner Attorney' },
  { id: 'sx-per-2', text: 'David Kim', primitiveType: 'person', confidence: 'suggested', approved: true, parentNoun: 'Case Manager' },
  { id: 'sx-per-3', text: 'Lisa Martinez', primitiveType: 'person', confidence: 'suggested', approved: true, parentNoun: 'Intake Specialist' },
  { id: 'sx-per-4', text: 'Rachel Torres', primitiveType: 'person', confidence: 'suggested', approved: true, parentNoun: 'Associate Attorney' },

  // Nouns (9) — all 9 nouns in marshall DNA
  { id: 'sx-noun-1', text: 'Intake Submission', primitiveType: 'noun', confidence: 'suggested', approved: true },
  { id: 'sx-noun-2', text: 'Claimant', primitiveType: 'noun', confidence: 'suggested', approved: true },
  { id: 'sx-noun-3', text: 'Claim', primitiveType: 'noun', confidence: 'suggested', approved: true },
  { id: 'sx-noun-4', text: 'Incident', primitiveType: 'noun', confidence: 'suggested', approved: true },
  { id: 'sx-noun-5', text: 'Property', primitiveType: 'noun', confidence: 'suggested', approved: true },
  { id: 'sx-noun-6', text: 'Evidence', primitiveType: 'noun', confidence: 'suggested', approved: true },
  { id: 'sx-noun-7', text: 'Case Status', primitiveType: 'noun', confidence: 'suggested', approved: true },
  { id: 'sx-noun-8', text: 'Firm', primitiveType: 'noun', confidence: 'suggested', approved: true },
  { id: 'sx-noun-9', text: 'Attorney', primitiveType: 'noun', confidence: 'suggested', approved: true },

  // Verbs (15) — one per capability in marshall DNA, linked to parent noun
  { id: 'sx-v-1',  text: 'Submit',       primitiveType: 'verb', confidence: 'suggested', approved: true, parentNoun: 'IntakeSubmission' },
  { id: 'sx-v-2',  text: 'Qualify',      primitiveType: 'verb', confidence: 'suggested', approved: true, parentNoun: 'IntakeSubmission' },
  { id: 'sx-v-3',  text: 'Register',     primitiveType: 'verb', confidence: 'suggested', approved: true, parentNoun: 'Claimant' },
  { id: 'sx-v-4',  text: 'View',         primitiveType: 'verb', confidence: 'suggested', approved: true, parentNoun: 'Claimant' },
  { id: 'sx-v-5',  text: 'Assign',       primitiveType: 'verb', confidence: 'suggested', approved: true, parentNoun: 'Claimant' },
  { id: 'sx-v-6',  text: 'Withdraw',     primitiveType: 'verb', confidence: 'suggested', approved: true, parentNoun: 'Claimant' },
  { id: 'sx-v-7',  text: 'File',         primitiveType: 'verb', confidence: 'suggested', approved: true, parentNoun: 'Claim' },
  { id: 'sx-v-8',  text: 'Review',       primitiveType: 'verb', confidence: 'suggested', approved: true, parentNoun: 'Claim' },
  { id: 'sx-v-9',  text: 'UpdateStatus', primitiveType: 'verb', confidence: 'suggested', approved: true, parentNoun: 'Claim' },
  { id: 'sx-v-10', text: 'Upload',       primitiveType: 'verb', confidence: 'suggested', approved: true, parentNoun: 'Evidence' },
  { id: 'sx-v-11', text: 'Verify',       primitiveType: 'verb', confidence: 'suggested', approved: true, parentNoun: 'Evidence' },
  { id: 'sx-v-12', text: 'Advance',      primitiveType: 'verb', confidence: 'suggested', approved: true, parentNoun: 'CaseStatus' },
  { id: 'sx-v-13', text: 'Onboard',      primitiveType: 'verb', confidence: 'suggested', approved: true, parentNoun: 'Firm' },
  { id: 'sx-v-14', text: 'Assign',       primitiveType: 'verb', confidence: 'suggested', approved: true, parentNoun: 'Attorney' },
  { id: 'sx-v-15', text: 'Assess',       primitiveType: 'verb', confidence: 'suggested', approved: true, parentNoun: 'Property' },

  // Processes (5) — all processes in marshall DNA
  { id: 'sx-proc-1', text: 'Claimant Intake', primitiveType: 'process', confidence: 'suggested', approved: true },
  { id: 'sx-proc-2', text: 'Case Preparation', primitiveType: 'process', confidence: 'suggested', approved: true },
  { id: 'sx-proc-3', text: 'Claim Resolution', primitiveType: 'process', confidence: 'suggested', approved: true },
  { id: 'sx-proc-4', text: 'Evidence Collection', primitiveType: 'process', confidence: 'suggested', approved: true },
  { id: 'sx-proc-5', text: 'Client Withdrawal', primitiveType: 'process', confidence: 'suggested', approved: true },

  // Rules — aligned to marshall DNA's condition rules
  { id: 'sx-rule-1', text: 'Only qualify submissions from Superior, Louisville, and Unincorporated Boulder County', primitiveType: 'rule', confidence: 'suggested', approved: true },
  { id: 'sx-rule-2', text: 'Cannot qualify submissions older than the two-year Colorado statute of limitations', primitiveType: 'rule', confidence: 'suggested', approved: true },
  { id: 'sx-rule-3', text: 'Only active attorneys can be assigned', primitiveType: 'rule', confidence: 'suggested', approved: true },
  { id: 'sx-rule-4', text: 'Evidence cannot be uploaded to claims that are already settled or dismissed', primitiveType: 'rule', confidence: 'suggested', approved: true },
  { id: 'sx-rule-5', text: 'Only the assigned attorney or an admin can process a withdrawal', primitiveType: 'rule', confidence: 'suggested', approved: true },
]

export const SAMPLE_DISCOVER_STATE: DiscoverState = {
  sourceText: SAMPLE_TRANSCRIPT,
  extractions: SAMPLE_EXTRACTIONS,
}
