/**
 * Operational DNA mutations.
 *
 * Pure helpers — data-in / data-out — for adding/removing primitives in
 * the new operational model. No JointJS, no React, so they stay
 * trivially unit-testable.
 *
 * Identity is UUID-based — every primitive carries a stable `id` field
 * assigned on first load. Rename is just a display-name edit; references
 * and layout keys never need rewriting.
 */

import { generateId } from '../utils/uuid.ts'
import type {
  OperationalDNA,
  Domain,
  NounLike,
  Resource,
  Person,
  Role,
  Group,
  Operation,
  Trigger,
  TriggerSource,
  Rule,
  RuleType,
  Task,
  Process,
  Membership,
} from '../loaders/operational-loader.ts'

// ── Kinds we can create / delete ───────────────────────────────────────

export type NounPrimitiveKind = 'resource' | 'person' | 'role' | 'group'

export type OperationalPrimitiveKind =
  | NounPrimitiveKind
  | 'operation'
  | 'trigger'
  | 'rule'
  | 'task'
  | 'process'
  | 'membership'

// ── Internal helpers ───────────────────────────────────────────────────

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/**
 * Walk the domain hierarchy to the first leaf that carries any noun
 * primitives. Mirrors `pickLeafDomain` in operational-to-graph.ts so
 * additions land in the lane the canvas is currently rendering.
 */
function findTargetLeafDomain(root: Domain): Domain {
  if (anyNouns(root)) return root
  for (const child of root.domains ?? []) {
    const found = findLeafWithNouns(child)
    if (found) return found
  }
  return findDeepestLeaf(root)
}

function findLeafWithNouns(domain: Domain): Domain | null {
  if (anyNouns(domain)) return domain
  for (const child of domain.domains ?? []) {
    const found = findLeafWithNouns(child)
    if (found) return found
  }
  return null
}

function findDeepestLeaf(domain: Domain): Domain {
  if (!domain.domains || domain.domains.length === 0) return domain
  return findDeepestLeaf(domain.domains[domain.domains.length - 1])
}

function anyNouns(domain: Domain): boolean {
  return (
    (domain.resources?.length ?? 0) > 0 ||
    (domain.persons?.length ?? 0) > 0 ||
    (domain.roles?.length ?? 0) > 0 ||
    (domain.groups?.length ?? 0) > 0
  )
}

// ── Add helpers ────────────────────────────────────────────────────────

export interface AddNounInput {
  kind: NounPrimitiveKind
  name: string
  description?: string
}

export function addNoun(dna: OperationalDNA, input: AddNounInput): OperationalDNA {
  const next = clone(dna)
  const leaf = findTargetLeafDomain(next.domain)
  const newNoun: NounLike = {
    id: generateId(),
    name: input.name,
    description: input.description,
    domain: leaf.path ?? leaf.name,
    attributes: [],
    actions: [],
  }
  switch (input.kind) {
    case 'resource':
      leaf.resources = leaf.resources ?? []
      leaf.resources.push(newNoun as Resource)
      break
    case 'person':
      leaf.persons = leaf.persons ?? []
      leaf.persons.push(newNoun as Person)
      break
    case 'role':
      leaf.roles = leaf.roles ?? []
      leaf.roles.push(newNoun as Role)
      break
    case 'group':
      leaf.groups = leaf.groups ?? []
      leaf.groups.push(newNoun as Group)
      break
  }
  return next
}

export interface AddOperationInput {
  target: string
  action: string
  description?: string
}

export function addOperation(dna: OperationalDNA, input: AddOperationInput): OperationalDNA {
  const next = clone(dna)
  next.operations = next.operations ?? []
  const name = `${input.target}.${input.action}`
  next.operations.push({
    id: generateId(),
    name,
    target: input.target,
    action: input.action,
    description: input.description,
  })
  return next
}

export interface AddTriggerInput {
  source: TriggerSource
  operation?: string
  process?: string
  description?: string
  schedule?: string
  event?: string
  after?: string
}

export function addTrigger(dna: OperationalDNA, input: AddTriggerInput): OperationalDNA {
  const next = clone(dna)
  next.triggers = next.triggers ?? []
  const trigger: Trigger = {
    id: generateId(),
    source: input.source,
    operation: input.operation,
    process: input.process,
    description: input.description,
    schedule: input.schedule,
    event: input.event,
    after: input.after,
  }
  next.triggers.push(trigger)
  return next
}

export interface AddRuleInput {
  operation: string
  type: RuleType
  description?: string
}

export function addRule(dna: OperationalDNA, input: AddRuleInput): OperationalDNA {
  const next = clone(dna)
  next.rules = next.rules ?? []
  const rule: Rule = {
    id: generateId(),
    operation: input.operation,
    type: input.type,
    description: input.description,
  }
  if (input.type === 'access') {
    rule.allow = [{ role: 'admin' }]
  } else {
    rule.conditions = []
  }
  next.rules.push(rule)
  return next
}

export interface AddTaskInput {
  name: string
  actor: string
  operation: string
  description?: string
}

export function addTask(dna: OperationalDNA, input: AddTaskInput): OperationalDNA {
  const next = clone(dna)
  next.tasks = next.tasks ?? []
  const task: Task = {
    id: generateId(),
    name: input.name,
    actor: input.actor,
    operation: input.operation,
    description: input.description,
  }
  next.tasks.push(task)
  return next
}

export interface AddProcessInput {
  name: string
  operator: string
  description?: string
}

export function addProcess(dna: OperationalDNA, input: AddProcessInput): OperationalDNA {
  const next = clone(dna)
  next.processes = next.processes ?? []
  const process: Process = {
    id: generateId(),
    name: input.name,
    operator: input.operator,
    description: input.description,
    startStep: '',
    steps: [],
  }
  next.processes.push(process)
  return next
}

export interface AddMembershipInput {
  name: string
  person: string
  role: string
  group?: string
}

export function addMembership(dna: OperationalDNA, input: AddMembershipInput): OperationalDNA {
  const next = clone(dna)
  next.memberships = next.memberships ?? []
  const membership: Membership = {
    id: generateId(),
    name: input.name,
    person: input.person,
    role: input.role,
    group: input.group,
  }
  next.memberships.push(membership)
  return next
}

// ── Delete with cascade ────────────────────────────────────────────────

export interface RemovedPrimitive {
  kind: OperationalPrimitiveKind
  name: string
}

/**
 * Compute which primitives would be removed by deleting (kind, key)
 * without actually mutating anything. Drives the confirmation dialog.
 *
 * `key` is the primitive's UUID `id`.
 */
export function previewCascade(
  dna: OperationalDNA,
  kind: OperationalPrimitiveKind,
  key: string,
): RemovedPrimitive[] {
  const removed: RemovedPrimitive[] = []

  if (isNounKind(kind)) {
    const noun = findNounById(dna.domain, kind, key)
    removed.push({ kind, name: noun?.name ?? key })
    if (noun) {
      const doomedOps = (dna.operations ?? []).filter((o) => o.target === noun.name)
      for (const op of doomedOps) {
        removed.push({ kind: 'operation', name: op.name })
        for (const rule of dna.rules ?? []) {
          if (rule.operation === op.name) {
            removed.push({ kind: 'rule', name: rule.name ?? `${op.name} ${rule.type ?? 'access'}` })
          }
        }
      }
    }
    return removed
  }

  if (kind === 'operation') {
    const op = (dna.operations ?? []).find((o) => o.id === key)
    const opName = op?.name ?? key
    removed.push({ kind: 'operation', name: opName })
    for (const rule of dna.rules ?? []) {
      if (rule.operation === opName) {
        removed.push({ kind: 'rule', name: rule.name ?? `${opName} ${rule.type ?? 'access'}` })
      }
    }
    return removed
  }

  if (kind === 'trigger') {
    const trigger = (dna.triggers ?? []).find((t) => t.id === key)
    const label = trigger?.operation ?? trigger?.process ?? trigger?.source ?? key
    removed.push({ kind: 'trigger', name: `trigger:${label}` })
    return removed
  }

  if (kind === 'rule') {
    const rule = (dna.rules ?? []).find((r) => r.id === key)
    removed.push({ kind: 'rule', name: rule ? (rule.name ?? `${rule.operation} ${rule.type ?? 'access'}`) : key })
    return removed
  }

  if (kind === 'task') {
    const task = (dna.tasks ?? []).find((t) => t.id === key)
    removed.push({ kind: 'task', name: task?.name ?? key })
    return removed
  }

  if (kind === 'process') {
    const process = (dna.processes ?? []).find((p) => p.id === key)
    removed.push({ kind: 'process', name: process?.name ?? key })
    return removed
  }

  if (kind === 'membership') {
    const m = (dna.memberships ?? []).find((m) => m.id === key)
    removed.push({ kind: 'membership', name: m?.name ?? key })
    return removed
  }

  return removed
}

/**
 * Remove a primitive (and its cascades) from the DNA.
 */
export function deleteOperationalPrimitive(
  dna: OperationalDNA,
  kind: OperationalPrimitiveKind,
  key: string,
): { dna: OperationalDNA; removed: RemovedPrimitive[] } {
  const next = clone(dna)
  const removed: RemovedPrimitive[] = []

  if (isNounKind(kind)) {
    let nounName: string | undefined
    walkDomains(next.domain, (domain) => {
      const arr = nounArrayOn(domain, kind)
      if (arr) {
        const found = arr.find((n) => n.id === key)
        if (found) nounName = found.name
        const filtered = arr.filter((n) => n.id !== key)
        setNounArrayOn(domain, kind, filtered)
      }
    })
    removed.push({ kind, name: nounName ?? key })

    if (nounName) {
      const doomedOpNames = new Set<string>()
      next.operations = (next.operations ?? []).filter((op) => {
        if (op.target === nounName) {
          doomedOpNames.add(op.name)
          removed.push({ kind: 'operation', name: op.name })
          return false
        }
        return true
      })
      next.rules = (next.rules ?? []).filter((rule) => {
        if (doomedOpNames.has(rule.operation)) {
          removed.push({ kind: 'rule', name: rule.name ?? `${rule.operation} ${rule.type ?? 'access'}` })
          return false
        }
        return true
      })
      next.triggers = (next.triggers ?? []).filter((trigger) => {
        if (trigger.operation && doomedOpNames.has(trigger.operation)) return false
        if (trigger.after && doomedOpNames.has(trigger.after)) return false
        return true
      })
      next.tasks = (next.tasks ?? []).filter((task) => !doomedOpNames.has(task.operation))
    }
    return { dna: next, removed }
  }

  if (kind === 'operation') {
    const op = (next.operations ?? []).find((o) => o.id === key)
    const opName = op?.name
    next.operations = (next.operations ?? []).filter((o) => o.id !== key)
    if (opName) removed.push({ kind: 'operation', name: opName })

    if (opName) {
      next.rules = (next.rules ?? []).filter((rule) => {
        if (rule.operation === opName) {
          removed.push({ kind: 'rule', name: rule.name ?? `${opName} ${rule.type ?? 'access'}` })
          return false
        }
        return true
      })
      next.triggers = (next.triggers ?? []).filter((trigger) => {
        if (trigger.operation === opName) return false
        if (trigger.after === opName) return false
        return true
      })
      next.tasks = (next.tasks ?? []).filter((task) => task.operation !== opName)
    }
    return { dna: next, removed }
  }

  if (kind === 'trigger') {
    const target = (next.triggers ?? []).find((t) => t.id === key)
    if (target) {
      next.triggers = (next.triggers ?? []).filter((t) => t.id !== key)
      const label = target.operation ?? target.process ?? target.source ?? key
      removed.push({ kind: 'trigger', name: `trigger:${label}` })
    }
    return { dna: next, removed }
  }

  if (kind === 'rule') {
    const target = (next.rules ?? []).find((r) => r.id === key)
    if (target) {
      next.rules = (next.rules ?? []).filter((r) => r.id !== key)
      removed.push({ kind: 'rule', name: target.name ?? `${target.operation} ${target.type ?? 'access'}` })
    }
    return { dna: next, removed }
  }

  if (kind === 'task') {
    const target = (next.tasks ?? []).find((t) => t.id === key)
    if (target) {
      next.tasks = (next.tasks ?? []).filter((t) => t.id !== key)
      removed.push({ kind: 'task', name: target.name })
    }
    return { dna: next, removed }
  }

  if (kind === 'process') {
    const target = (next.processes ?? []).find((p) => p.id === key)
    if (target) {
      next.processes = (next.processes ?? []).filter((p) => p.id !== key)
      removed.push({ kind: 'process', name: target.name })
      next.triggers = (next.triggers ?? []).filter((t) => t.process !== target.name)
    }
    return { dna: next, removed }
  }

  if (kind === 'membership') {
    const target = (next.memberships ?? []).find((m) => m.id === key)
    if (target) {
      next.memberships = (next.memberships ?? []).filter((m) => m.id !== key)
      removed.push({ kind: 'membership', name: target.name })
    }
    return { dna: next, removed }
  }

  return { dna: next, removed }
}

// ── Helpers ───────────────────────────────────────────────────────────

function isNounKind(kind: OperationalPrimitiveKind): kind is NounPrimitiveKind {
  return kind === 'resource' || kind === 'person' || kind === 'role' || kind === 'group'
}

function nounArrayOn(domain: Domain, kind: NounPrimitiveKind): NounLike[] | undefined {
  switch (kind) {
    case 'resource': return domain.resources
    case 'person':   return domain.persons
    case 'role':     return domain.roles
    case 'group':    return domain.groups
  }
}

function setNounArrayOn(domain: Domain, kind: NounPrimitiveKind, arr: NounLike[]): void {
  switch (kind) {
    case 'resource': domain.resources = arr as Resource[]; break
    case 'person':   domain.persons   = arr as Person[]; break
    case 'role':     domain.roles     = arr as Role[]; break
    case 'group':    domain.groups    = arr as Group[]; break
  }
}

function findNounById(domain: Domain, kind: NounPrimitiveKind, id: string): NounLike | null {
  const arr = nounArrayOn(domain, kind) ?? []
  for (const noun of arr) {
    if (noun.id === id) return noun
  }
  for (const child of domain.domains ?? []) {
    const found = findNounById(child, kind, id)
    if (found) return found
  }
  return null
}

function walkAllNouns(domain: Domain, fn: (noun: NounLike, kind: NounPrimitiveKind) => void): void {
  for (const r of domain.resources ?? []) fn(r, 'resource')
  for (const p of domain.persons ?? [])  fn(p, 'person')
  for (const r of domain.roles ?? [])    fn(r, 'role')
  for (const g of domain.groups ?? [])   fn(g, 'group')
  for (const child of domain.domains ?? []) walkAllNouns(child, fn)
}

function walkDomains(domain: Domain, fn: (domain: Domain) => void): void {
  fn(domain)
  for (const child of domain.domains ?? []) walkDomains(child, fn)
}

// ── Convenience: enumerate existing primitives ────────────────────────

export interface ListedNoun {
  noun: NounLike
  kind: NounPrimitiveKind
}

export function listNouns(dna: OperationalDNA): ListedNoun[] {
  const out: ListedNoun[] = []
  walkAllNouns(dna.domain, (noun, kind) => out.push({ noun, kind }))
  return out
}

export function listOperations(dna: OperationalDNA): Operation[] {
  return dna.operations ?? []
}

export function listProcesses(dna: OperationalDNA): Process[] {
  return dna.processes ?? []
}
