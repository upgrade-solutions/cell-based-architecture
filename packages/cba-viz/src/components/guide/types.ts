export type GuidePhase = 'discover' | 'define' | 'design'

export type PrimitiveType =
  | 'noun'
  | 'attribute'
  | 'verb'
  | 'capability'
  | 'position'
  | 'person'
  | 'task'
  | 'process'
  | 'rule'
  | 'cause'
  | 'outcome'
  | 'signal'
  | 'relationship'

export const PRIMITIVE_TYPES: PrimitiveType[] = [
  'noun', 'attribute', 'verb', 'capability',
  'position', 'person', 'task', 'process',
  'rule', 'cause', 'outcome', 'signal', 'relationship',
]

export const PRIMITIVE_COLORS: Record<PrimitiveType, string> = {
  noun: '#64748b',
  attribute: '#64748b',
  verb: '#10b981',
  capability: '#10b981',
  position: '#8b5cf6',
  person: '#8b5cf6',
  task: '#8b5cf6',
  process: '#f59e0b',
  rule: '#06b6d4',
  cause: '#f43f5e',
  outcome: '#f43f5e',
  signal: '#f43f5e',
  relationship: '#a855f7',
}

export interface Extraction {
  id: string
  text: string
  primitiveType: PrimitiveType
  confidence: 'manual' | 'suggested'
  approved: boolean
  parentNoun?: string
}

export interface DiscoverState {
  sourceText: string
  extractions: Extraction[]
}
