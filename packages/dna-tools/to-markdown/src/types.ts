/**
 * Loose structural types describing the DNA shapes this renderer reads.
 *
 * These are intentionally a subset of the canonical schemas in @dna/core —
 * only fields the renderer consumes are modeled. That keeps this package
 * zero-dependency and lets callers hand in partially-populated DNA without
 * tripping type errors on unrelated fields.
 */

export interface DnaInput {
  operational?: OperationalDna
  productCore?: ProductCoreDna
  productApi?: ProductApiDna
  productUi?: ProductUiDna
  technical?: TechnicalDna
}

export interface OperationalDna {
  domain: OperationalDomain
  capabilities?: Capability[]
  rules?: Rule[]
  outcomes?: Outcome[]
  causes?: Cause[]
  signals?: Signal[]
  equations?: Equation[]
  relationships?: Relationship[]
  positions?: Position[]
  persons?: Person[]
  tasks?: Task[]
  processes?: Process[]
}

export interface OperationalDomain {
  name: string
  path?: string
  description?: string
  nouns?: Noun[]
  domains?: OperationalDomain[]
}

export interface Noun {
  name: string
  description?: string
  attributes?: Attribute[]
  verbs?: Verb[]
}

export interface Attribute {
  name: string
  type?: string
  required?: boolean
  description?: string
}

export interface Verb {
  name: string
  description?: string
}

export interface Capability {
  name: string
  noun: string
  verb: string
  description?: string
}

export interface Rule {
  name?: string
  capability: string
  type?: 'access' | 'condition'
  description?: string
  allow?: RuleAllow[]
  condition?: string
}

export interface RuleAllow {
  role?: string
  ownership?: string
  flags?: string[]
}

export interface Outcome {
  capability: string
  description?: string
  changes?: OutcomeChange[]
  initiate?: string[]
  emits?: string[]
}

export interface OutcomeChange {
  attribute: string
  set?: unknown
}

export interface Cause {
  capability: string
  source: string
  description?: string
  signal?: string
}

export interface Signal {
  name: string
  capability: string
  description?: string
  payload?: Field[]
}

export interface Equation {
  name: string
  description?: string
  inputs?: Field[]
  output?: Field
}

export interface Field {
  name: string
  type: string
  required?: boolean
  description?: string
}

export interface Relationship {
  name: string
  from: string
  to: string
  attribute: string
  cardinality: string
  description?: string
}

export interface Position {
  name: string
  description?: string
  roles?: string[]
  reports_to?: string
}

export interface Person {
  name: string
  position: string
}

export interface Task {
  name: string
  position: string
  capability: string
  description?: string
}

export interface Process {
  name: string
  description?: string
  operator?: string
  emits?: string[]
  steps?: ProcessStep[]
}

export interface ProcessStep {
  id: string
  task: string
  depends_on?: string[]
  branch?: ProcessBranch
}

export interface ProcessBranch {
  when?: string
  else?: boolean
}

/** Product/technical layers modeled loosely — unused in v1 but reserved. */
export type ProductCoreDna = Record<string, unknown>
export type ProductApiDna = Record<string, unknown>
export type ProductUiDna = Record<string, unknown>
export type TechnicalDna = Record<string, unknown>
