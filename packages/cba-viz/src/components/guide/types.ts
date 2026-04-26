export type GuidePhase = 'discover' | 'design'

export type PrimitiveType =
  | 'resource'
  | 'person'
  | 'role'
  | 'group'
  | 'attribute'
  | 'action'
  | 'operation'
  | 'task'
  | 'process'
  | 'rule'
  | 'trigger'
  | 'membership'
  | 'relationship'

export const PRIMITIVE_TYPES: PrimitiveType[] = [
  'resource', 'person', 'role', 'group',
  'attribute', 'action', 'operation',
  'task', 'process',
  'rule', 'trigger', 'membership', 'relationship',
]

export const PRIMITIVE_COLORS: Record<PrimitiveType, string> = {
  resource: '#64748b',
  person: '#fbbf24',
  role: '#a78bfa',
  group: '#34d399',
  attribute: '#64748b',
  action: '#10b981',
  operation: '#10b981',
  task: '#bef264',
  process: '#6366f1',
  rule: '#f59e0b',
  trigger: '#f43f5e',
  membership: '#a855f7',
  relationship: '#a855f7',
}

export interface Extraction {
  id: string
  text: string
  primitiveType: PrimitiveType
  confidence: 'manual' | 'suggested'
  approved: boolean
  /** When the extraction is an attribute/action, this names the parent noun. */
  parentNoun?: string
}

export interface DiscoverState {
  sourceText: string
  extractions: Extraction[]
}
