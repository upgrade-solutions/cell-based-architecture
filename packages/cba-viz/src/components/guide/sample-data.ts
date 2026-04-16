import type { Extraction, DiscoverState } from './types.ts'

export const SAMPLE_TRANSCRIPT = `Meeting: Marshall Fire Case Management Kickoff
Attendees: James Worthington (Partner Attorney), David Kim (Case Manager), Lisa Martinez (Intake Specialist), Rachel Torres (Associate Attorney)

James: Let's walk through how a claim moves through our firm, start to finish.

David: Every Claimant starts as an Intake Submission from the public website. Lisa's team reviews each one. The Intake Specialist either qualifies it or rejects it. When we qualify, the system automatically registers a Claimant record.

Lisa: We only qualify submissions from the three affected cities — Superior, Louisville, and Unincorporated Boulder County. That's a hard rule. Also, we can't qualify submissions that are older than the two-year statute of limitations.

James: After qualification, the Case Manager assigns an Associate Attorney to represent the Claimant. Only active attorneys can be assigned. From there, we start Case Preparation.

David: Case Preparation runs three things in parallel — the Paralegal assesses the Property damage, uploads supporting Evidence, and advances the Case Status through milestones. All three have to complete before the attorney reviews the claim.

Rachel: When I review a filed Claim, I need verified Evidence and a current damage assessment. If the claim qualifies, we move to resolution. If not, we send it back for more preparation.

James: Resolution is either settlement or dismissal. The Paralegal files the formal Claim with the court, then I review it for legal sufficiency. Once reviewed, we update the claim status.

David: Evidence Collection is a separate process that can run anytime — the Paralegal uploads a document, then the Case Manager verifies it. Evidence cannot be uploaded to settled or dismissed claims.

Lisa: What about Client Withdrawal?

David: When a Claimant wants to withdraw, the Case Manager processes the withdrawal, dismisses any open claims, and advances the case status to closed. Only the assigned attorney or an admin can process a withdrawal.

James: That covers Intake, Case Preparation, Claim Resolution, Evidence Collection, and Client Withdrawal. Five core processes. Let's get them documented.`

export const SAMPLE_EXTRACTIONS: Extraction[] = [
  // Positions (5)
  { id: 'sx-pos-1', text: 'Partner Attorney', primitiveType: 'position', confidence: 'suggested', approved: true },
  { id: 'sx-pos-2', text: 'Case Manager', primitiveType: 'position', confidence: 'suggested', approved: true },
  { id: 'sx-pos-3', text: 'Intake Specialist', primitiveType: 'position', confidence: 'suggested', approved: true },
  { id: 'sx-pos-4', text: 'Associate Attorney', primitiveType: 'position', confidence: 'suggested', approved: true },
  { id: 'sx-pos-5', text: 'Paralegal', primitiveType: 'position', confidence: 'suggested', approved: true },

  // Persons (4)
  { id: 'sx-per-1', text: 'James Worthington', primitiveType: 'person', confidence: 'suggested', approved: true, parentNoun: 'Partner Attorney' },
  { id: 'sx-per-2', text: 'David Kim', primitiveType: 'person', confidence: 'suggested', approved: true, parentNoun: 'Case Manager' },
  { id: 'sx-per-3', text: 'Lisa Martinez', primitiveType: 'person', confidence: 'suggested', approved: true, parentNoun: 'Intake Specialist' },
  { id: 'sx-per-4', text: 'Rachel Torres', primitiveType: 'person', confidence: 'suggested', approved: true, parentNoun: 'Associate Attorney' },

  // Nouns (6)
  { id: 'sx-noun-1', text: 'Intake Submission', primitiveType: 'noun', confidence: 'suggested', approved: true },
  { id: 'sx-noun-2', text: 'Claimant', primitiveType: 'noun', confidence: 'suggested', approved: true },
  { id: 'sx-noun-3', text: 'Claim', primitiveType: 'noun', confidence: 'suggested', approved: true },
  { id: 'sx-noun-4', text: 'Property', primitiveType: 'noun', confidence: 'suggested', approved: true },
  { id: 'sx-noun-5', text: 'Evidence', primitiveType: 'noun', confidence: 'suggested', approved: true },
  { id: 'sx-noun-6', text: 'Case Status', primitiveType: 'noun', confidence: 'suggested', approved: true },

  // Verbs (9) — linked to parent nouns
  { id: 'sx-v-1', text: 'Qualify', primitiveType: 'verb', confidence: 'suggested', approved: true, parentNoun: 'IntakeSubmission' },
  { id: 'sx-v-2', text: 'Register', primitiveType: 'verb', confidence: 'suggested', approved: true, parentNoun: 'Claimant' },
  { id: 'sx-v-3', text: 'Assign', primitiveType: 'verb', confidence: 'suggested', approved: true, parentNoun: 'Claimant' },
  { id: 'sx-v-4', text: 'Withdraw', primitiveType: 'verb', confidence: 'suggested', approved: true, parentNoun: 'Claimant' },
  { id: 'sx-v-5', text: 'File', primitiveType: 'verb', confidence: 'suggested', approved: true, parentNoun: 'Claim' },
  { id: 'sx-v-6', text: 'Review', primitiveType: 'verb', confidence: 'suggested', approved: true, parentNoun: 'Claim' },
  { id: 'sx-v-7', text: 'Upload', primitiveType: 'verb', confidence: 'suggested', approved: true, parentNoun: 'Evidence' },
  { id: 'sx-v-8', text: 'Verify', primitiveType: 'verb', confidence: 'suggested', approved: true, parentNoun: 'Evidence' },
  { id: 'sx-v-9', text: 'Assess', primitiveType: 'verb', confidence: 'suggested', approved: true, parentNoun: 'Property' },

  // Processes (5)
  { id: 'sx-proc-1', text: 'Claimant Intake', primitiveType: 'process', confidence: 'suggested', approved: true },
  { id: 'sx-proc-2', text: 'Case Preparation', primitiveType: 'process', confidence: 'suggested', approved: true },
  { id: 'sx-proc-3', text: 'Claim Resolution', primitiveType: 'process', confidence: 'suggested', approved: true },
  { id: 'sx-proc-4', text: 'Evidence Collection', primitiveType: 'process', confidence: 'suggested', approved: true },
  { id: 'sx-proc-5', text: 'Client Withdrawal', primitiveType: 'process', confidence: 'suggested', approved: true },

  // Rules (4)
  { id: 'sx-rule-1', text: 'Only qualify submissions from Superior, Louisville, and Unincorporated Boulder County', primitiveType: 'rule', confidence: 'suggested', approved: true },
  { id: 'sx-rule-2', text: 'Cannot qualify submissions older than the two-year statute of limitations', primitiveType: 'rule', confidence: 'suggested', approved: true },
  { id: 'sx-rule-3', text: 'Only active attorneys can be assigned', primitiveType: 'rule', confidence: 'suggested', approved: true },
  { id: 'sx-rule-4', text: 'Evidence cannot be uploaded to settled or dismissed claims', primitiveType: 'rule', confidence: 'suggested', approved: true },
]

export const SAMPLE_DISCOVER_STATE: DiscoverState = {
  sourceText: SAMPLE_TRANSCRIPT,
  extractions: SAMPLE_EXTRACTIONS,
}
