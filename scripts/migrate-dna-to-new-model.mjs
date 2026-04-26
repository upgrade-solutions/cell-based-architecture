#!/usr/bin/env node
/**
 * Migrate operational/product.api/product.ui/technical JSON documents
 * from the old DNA model to the new @dna-codes/schemas model.
 *
 * Old → New transformations:
 *
 *  Operational:
 *    domain.nouns[] → split into domain.{resources,persons,roles,groups}[]
 *      (heuristic-based; see classifyNoun)
 *    nouns[].verbs → nouns[].actions
 *    attributes[].noun → attributes[].resource
 *    capabilities[] → operations[] (capability.noun + verb → operation.target + action)
 *    outcomes[] → folded into operations[].changes[]
 *    causes[] → triggers[] (cause.source 'capability' → 'operation'; drop 'signal' source)
 *    rules[].capability → rules[].operation
 *    drop: signals[], equations[], lifecycles[], positions[], persons[] (instance shape)
 *    tasks[].position → tasks[].actor; tasks[].capability → tasks[].operation
 *    processes[] add startStep, drop emits, rename branch → conditions+else
 *
 *  Product API:
 *    resources[].noun → resources[].resource
 *    actions[].verb → actions[].action
 *
 *  Product UI: minimal changes
 *
 *  Technical:
 *    drop cells whose adapter.type === 'node/event-bus'
 *    drop adapter.config.signal_dispatch / event_bus_engine
 *
 *  Product Core: replaced with empty stub (rematerialized via CLI)
 *
 * Usage:
 *   node scripts/migrate-dna-to-new-model.mjs <domain-path>
 *   e.g. node scripts/migrate-dna-to-new-model.mjs lending
 *        node scripts/migrate-dna-to-new-model.mjs torts/marshall
 */

import fs from 'node:fs'
import path from 'node:path'

const REPO_ROOT = path.resolve(import.meta.dirname, '..')

// ── Heuristics for classifying a noun into one of the four new collections ──

// PERSON patterns identify human-actor templates. Demo-domain entities
// like Borrower/Customer/Patient have historically been modeled as
// Resources (they appear in product API as REST resources). We keep
// them as Resources to preserve the existing surface; explicitly-named
// "Person", "Employee", "User" etc. become Person primitives.
// Conservative: match only literal generic-actor terms. Domain-specific
// human entities (Borrower, Customer, Patient, Claimant) stay classified
// as Resources because the demo APIs already expose them as REST resources.
const PERSON_PATTERNS = [/^employee$/i, /^staff$/i, /^user$/i, /^person$/i]
const ROLE_PATTERNS   = [/underwriter/i, /admin(istrator)?$/i, /^manager$/i, /counsel/i, /attorney/i, /lawyer/i, /paralegal/i, /reviewer/i, /approver/i, /operator/i, /staff(member)?$/i, /agent$/i, /advisor/i]
const GROUP_PATTERNS  = [/^case$/i, /workspace/i, /department/i, /^team$/i, /^firm$/i, /^office$/i, /branch$/i, /family$/i, /listing$/i, /booking$/i, /class$/i, /tenant$/i, /organization$/i, /group$/i]

function classifyNoun(noun) {
  const name = noun.name ?? ''
  if (PERSON_PATTERNS.some((re) => re.test(name))) return 'persons'
  if (ROLE_PATTERNS.some((re) => re.test(name)))   return 'roles'
  if (GROUP_PATTERNS.some((re) => re.test(name)))  return 'groups'
  return 'resources'
}

// ── Operational migration ───────────────────────────────────────────────

function pascalize(s) {
  // Strip non-alphanumeric, then ensure first char is uppercase. Used to
  // bring legacy snake_case names into the new model's PascalCase pattern.
  return s.replace(/[^a-zA-Z0-9]+(.)/g, (_m, c) => c.toUpperCase())
          .replace(/^./, (c) => c.toUpperCase())
}

function migrateNoun(noun, kind) {
  const out = { name: pascalize(noun.name) }
  if (noun.id)          out.id = noun.id
  if (noun.description) out.description = noun.description
  if (noun.parent)      out.parent = noun.parent
  if (noun.attributes)  out.attributes = noun.attributes.map(migrateAttribute)
  // verbs → actions
  const actionsSrc = noun.actions ?? noun.verbs ?? []
  if (actionsSrc.length > 0) out.actions = actionsSrc.map(migrateAction)
  // Role/Person/Group schemas don't allow `examples`; only Resource does.
  if (noun.examples && kind === 'resources') out.examples = noun.examples
  return out
}

function migrateAttribute(attr) {
  const out = { ...attr }
  // Old model had two reference patterns:
  //   { type: 'reference', noun: 'Foo' }
  //   { type: 'string',    reference: 'Foo' }
  // Both become { type: 'reference', resource: 'Foo' } in the new model.
  if (attr.noun !== undefined) {
    out.resource = attr.noun
    out.type = 'reference'
    delete out.noun
  }
  if (attr.reference !== undefined) {
    out.resource = attr.reference
    out.type = 'reference'
    delete out.reference
  }
  return out
}

function migrateAction(verbOrAction) {
  // Action schema is strict: only name + optional description/type/idempotent.
  // Drop verb-era input/output fields.
  const out = { name: verbOrAction.name }
  if (verbOrAction.description) out.description = verbOrAction.description
  if (verbOrAction.type)        out.type = verbOrAction.type
  if (verbOrAction.idempotent !== undefined) out.idempotent = verbOrAction.idempotent
  return out
}

function migrateDomain(d) {
  const out = { name: d.name }
  if (d.path) out.path = d.path
  if (d.description) out.description = d.description

  // Split nouns into the four buckets
  const resources = []
  const persons = []
  const roles = []
  const groups = []
  for (const noun of d.nouns ?? []) {
    const bucket = classifyNoun(noun)
    const migrated = migrateNoun(noun, bucket)
    if (bucket === 'persons')      persons.push(migrated)
    else if (bucket === 'roles')   roles.push(migrated)
    else if (bucket === 'groups')  groups.push(migrated)
    else                           resources.push(migrated)
  }

  // Carry forward already-split collections (idempotent)
  for (const r of d.resources ?? []) resources.push(migrateNoun(r, 'resources'))
  for (const p of d.persons ?? [])   persons.push(migrateNoun(p, 'persons'))
  for (const r of d.roles ?? [])     roles.push(migrateNoun(r, 'roles'))
  for (const g of d.groups ?? [])    groups.push(migrateNoun(g, 'groups'))

  if (resources.length) out.resources = resources
  if (persons.length)   out.persons = persons
  if (roles.length)     out.roles = roles
  if (groups.length)    out.groups = groups
  if (d.domains)        out.domains = d.domains.map(migrateDomain)
  return out
}

function migrateOperational(doc) {
  const out = migrateOperationalCore(doc)
  normalizeActorReferences(out)
  return out
}

function migrateOperationalCore(doc) {
  const out = { domain: migrateDomain(doc.domain) }

  // Build operations from old capabilities, folding in outcomes' changes
  const outcomesByCapability = new Map()
  for (const o of doc.outcomes ?? []) {
    const list = outcomesByCapability.get(o.capability) ?? []
    list.push(o)
    outcomesByCapability.set(o.capability, list)
  }

  if (doc.capabilities || doc.operations) {
    const ops = []
    for (const op of doc.operations ?? []) {
      // Already-new shape — pass through
      ops.push(op)
    }
    for (const cap of doc.capabilities ?? []) {
      const name = cap.name ?? `${cap.noun}.${cap.verb}`
      const newOp = {
        name,
        target: cap.noun,
        action: cap.verb,
      }
      if (cap.id)          newOp.id = cap.id
      if (cap.description) newOp.description = cap.description
      // Fold outcomes' changes into operation.changes
      const matching = outcomesByCapability.get(name) ?? []
      const changes = []
      for (const oc of matching) {
        for (const c of oc.changes ?? []) changes.push({ attribute: c.attribute, set: c.set })
      }
      if (changes.length) newOp.changes = changes
      ops.push(newOp)
    }
    if (ops.length) out.operations = ops
  }

  // causes → triggers
  if (doc.causes || doc.triggers) {
    const triggers = []
    for (const t of doc.triggers ?? []) triggers.push(t) // already-new shape
    for (const c of doc.causes ?? []) {
      // Drop signal-sourced causes; signals are removed
      if (c.source === 'signal') continue
      const newTrigger = {
        source: c.source === 'capability' ? 'operation' : c.source,
      }
      // The cause's `capability` field becomes the trigger's `operation`
      if (c.capability) newTrigger.operation = c.capability
      if (c.id)          newTrigger.id = c.id
      if (c.description) newTrigger.description = c.description
      if (c.schedule)    newTrigger.schedule = c.schedule
      if (c.event)       newTrigger.event = c.event
      if (c.after)       newTrigger.after = c.after
      triggers.push(newTrigger)
    }
    if (triggers.length) out.triggers = triggers
  }

  // rules: rename capability → operation
  if (doc.rules) {
    out.rules = doc.rules.map((r) => {
      const out = { ...r }
      if (r.capability !== undefined) {
        out.operation = r.capability
        delete out.capability
      }
      return out
    })
  }

  // tasks: position → actor, capability → operation
  if (doc.tasks) {
    out.tasks = doc.tasks.map((t) => {
      const out = { name: t.name }
      if (t.id)          out.id = t.id
      if (t.description) out.description = t.description
      out.actor     = t.actor ?? t.position
      out.operation = t.operation ?? t.capability
      if (t.domain)      out.domain = t.domain
      return out
    })
  }

  // processes: add startStep, restructure steps[]
  if (doc.processes) {
    out.processes = doc.processes.map(migrateProcess)
  }

  // memberships: pass through if present (likely empty for old docs)
  if (doc.memberships) out.memberships = doc.memberships

  if (doc.relationships) out.relationships = doc.relationships

  // Drop: signals, equations, lifecycles, positions, persons (instance shape),
  // layouts (cba-viz canvas positions — not in the canonical schema; cba-viz
  // recreates them on first save into a non-validating side file).

  return out
}

/**
 * After the main migration, scan rules / tasks / processes for actor
 * references that don't match any declared noun primitive, and inject
 * minimal Role stubs into the deepest domain so the document validates.
 *
 * Rewrites lowercase actor references (`underwriter`, `admin`) to the
 * canonical PascalCase form, creating Role stubs as needed.
 */
function normalizeActorReferences(doc) {
  // declared maps lowercased name → canonical name. We only treat a name as
  // "declared as an actor" if it appears as a Person or Role; matching it as
  // a Resource doesn't satisfy the actorable constraint, so we synthesize a
  // Role stub in that case to keep the demo validating.
  const declaredActors = new Map()
  const declaredAsResource = new Set()
  const walk = (d) => {
    for (const r of d.resources ?? []) declaredAsResource.add(r.name.toLowerCase())
    for (const p of d.persons ?? [])   declaredActors.set(p.name.toLowerCase(), p.name)
    for (const r of d.roles ?? [])     declaredActors.set(r.name.toLowerCase(), r.name)
    for (const sub of d.domains ?? []) walk(sub)
  }
  walk(doc.domain)

  // Inject stubs into the deepest domain that already holds noun primitives
  let injectionTarget = doc.domain
  let bestDepth = 0
  const find = (d, depth) => {
    const hasNouns = (d.resources?.length || d.persons?.length || d.roles?.length || d.groups?.length)
    if (hasNouns && depth >= bestDepth) {
      injectionTarget = d
      bestDepth = depth
    }
    for (const sub of d.domains ?? []) find(sub, depth + 1)
  }
  find(doc.domain, 0)

  const ensureRole = (name) => {
    injectionTarget.roles ??= []
    if (!injectionTarget.roles.find((r) => r.name === name)) {
      injectionTarget.roles.push({ name })
    }
  }

  const canonicalize = (raw) => {
    if (!raw) return raw
    const lower = raw.toLowerCase()
    const found = declaredActors.get(lower)
    if (found) return found
    if (declaredAsResource.has(lower)) {
      const synth = pascalize(raw) + 'Actor'
      ensureRole(synth)
      declaredActors.set(synth.toLowerCase(), synth)
      return synth
    }
    const synth = pascalize(raw)
    ensureRole(synth)
    declaredActors.set(synth.toLowerCase(), synth)
    return synth
  }

  for (const rule of doc.rules ?? []) {
    if (rule.type === 'access' && rule.allow) {
      for (const a of rule.allow) {
        if (a.role) a.role = canonicalize(a.role)
      }
    }
  }
  for (const t of doc.tasks ?? []) {
    if (t.actor) t.actor = canonicalize(t.actor)
  }
  for (const p of doc.processes ?? []) {
    if (p.operator) p.operator = canonicalize(p.operator)
  }
}

function migrateProcess(p) {
  const out = { name: p.name }
  if (p.id)          out.id = p.id
  if (p.description) out.description = p.description
  if (p.domain)      out.domain = p.domain
  out.operator = p.operator

  const steps = (p.steps ?? []).map(migrateStep)
  out.steps = steps

  // startStep: prefer explicit, else first step with no depends_on, else first step
  if (p.startStep) {
    out.startStep = p.startStep
  } else if (steps.length > 0) {
    const root = steps.find((s) => !s.depends_on || s.depends_on.length === 0)
    out.startStep = root ? root.id : steps[0].id
  }
  // drop p.emits

  return out
}

function migrateStep(s) {
  const out = { id: s.id, task: s.task }
  if (s.description) out.description = s.description
  if (s.depends_on)  out.depends_on = s.depends_on
  // branch: { when: 'rule', else: 'stepId' } → conditions: [rule], else: 'stepId'
  if (s.branch) {
    if (s.branch.when) out.conditions = [s.branch.when]
    if (s.branch.else) out.else = s.branch.else
  }
  if (s.conditions) out.conditions = s.conditions
  if (s.else)       out.else = s.else
  return out
}

// ── Product API migration ──────────────────────────────────────────────

function migrateProductApi(doc) {
  const out = { ...doc }
  if (doc.resources) {
    out.resources = doc.resources.map((r) => {
      const o = { ...r }
      if (r.noun !== undefined) {
        o.resource = r.noun
        delete o.noun
      }
      if (r.actions) {
        o.actions = r.actions.map((a) => {
          const oa = { ...a }
          if (a.verb !== undefined) {
            oa.action = a.verb
            delete oa.verb
          }
          return oa
        })
      }
      return o
    })
  }
  if (doc.operations) {
    out.operations = doc.operations.map((op) => {
      const o = { ...op }
      if (op.capability !== undefined) {
        // capability was a `Noun.Verb` reference → drop, the new model uses
        // op.name to match by Target.Action
        delete o.capability
      }
      return o
    })
  }
  return out
}

// ── Product UI migration ───────────────────────────────────────────────

function migrateProductUi(doc) {
  // Pass-through; old shape mostly aligned
  return doc
}

// ── Technical migration ───────────────────────────────────────────────

function migrateTechnical(doc) {
  const out = { ...doc }
  // Drop event-bus cells
  if (out.cells) {
    out.cells = out.cells
      .filter((c) => c.adapter?.type !== 'node/event-bus')
      .map((c) => {
        if (c.adapter?.config) {
          const cfg = { ...c.adapter.config }
          delete cfg.signal_dispatch
          delete cfg.event_bus_engine
          return { ...c, adapter: { ...c.adapter, config: cfg } }
        }
        return c
      })
  }
  return out
}

// ── Product Core: replace with empty domain stub ──────────────────────

function emptyProductCore(operational) {
  const dom = operational?.domain ?? { name: 'unknown', path: 'unknown' }
  return {
    domain: { name: dom.name, path: dom.path ?? dom.name, ...(dom.description ? { description: dom.description } : {}) },
  }
}

// ── Driver ────────────────────────────────────────────────────────────

function migrateFile(filePath, migrator) {
  if (!fs.existsSync(filePath)) {
    console.log(`  - skip (missing): ${path.relative(REPO_ROOT, filePath)}`)
    return null
  }
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  const migrated = migrator(raw)
  fs.writeFileSync(filePath, JSON.stringify(migrated, null, 2) + '\n', 'utf-8')
  console.log(`  ✓ migrated: ${path.relative(REPO_ROOT, filePath)}`)
  return migrated
}

/**
 * For each API-referenced operation that's not declared in operational,
 * append a synthetic Operation. Demo APIs frequently expose CRUD ops (View,
 * List) that the operational layer didn't bother to enumerate; the new
 * cross-layer validator requires every API operation to have an operational
 * counterpart.
 */
function backfillOperationsFromApi(operational, api) {
  if (!api) return
  const declared = new Set((operational.operations ?? []).map((o) => o.name))

  // Collect API operation names + the resource/action they map to
  const referenced = new Map() // name → { target, action }
  for (const op of api.operations ?? []) {
    if (!op.name || declared.has(op.name)) continue
    // Prefer `target` (new) then `resource` (legacy)
    const target = op.target ?? op.resource
    const action = op.action
    if (!target || !action) continue
    referenced.set(op.name, { target, action })
  }
  for (const ep of api.endpoints ?? []) {
    if (!ep.operation || declared.has(ep.operation)) continue
    if (referenced.has(ep.operation)) continue
    const m = ep.operation.match(/^([A-Z][a-zA-Z0-9]*)\.([A-Z][a-zA-Z0-9]*)$/)
    if (!m) continue
    referenced.set(ep.operation, { target: m[1], action: m[2] })
  }

  // Build a noun→action set so we can also append the action to its noun
  const nounByName = new Map()
  const walk = (d) => {
    for (const r of d.resources ?? []) nounByName.set(r.name, r)
    for (const p of d.persons ?? [])   nounByName.set(p.name, p)
    for (const r of d.roles ?? [])     nounByName.set(r.name, r)
    for (const g of d.groups ?? [])    nounByName.set(g.name, g)
    for (const sub of d.domains ?? []) walk(sub)
  }
  walk(operational.domain)

  if (referenced.size === 0) return
  operational.operations ??= []
  for (const [name, { target, action }] of referenced) {
    operational.operations.push({ name, target, action })
    // Also ensure the action exists in the target noun's actions[] catalog
    const noun = nounByName.get(target)
    if (noun) {
      noun.actions ??= []
      if (!noun.actions.find((a) => a.name === action)) {
        // Default standard CRUD-ish actions to read; everything else write
        const type = /^(View|Get|List|Read|Show|Find)/.test(action) ? 'read' : 'write'
        noun.actions.push({ name: action, type })
      }
    }
  }
}

function main() {
  const domain = process.argv[2]
  if (!domain) {
    console.error('Usage: node scripts/migrate-dna-to-new-model.mjs <domain-path>')
    process.exit(1)
  }
  const dnaDir = path.join(REPO_ROOT, 'dna', domain)
  if (!fs.existsSync(dnaDir)) {
    console.error(`Domain directory not found: ${dnaDir}`)
    process.exit(1)
  }
  console.log(`Migrating ${domain}/`)

  const opPath = path.join(dnaDir, 'operational.json')
  const operational = migrateFile(opPath, migrateOperational)

  const apiPath = path.join(dnaDir, 'product.api.json')
  const api = migrateFile(apiPath, migrateProductApi)
  migrateFile(path.join(dnaDir, 'product.ui.json'), migrateProductUi)
  migrateFile(path.join(dnaDir, 'product.admin.ui.json'), migrateProductUi)
  migrateFile(path.join(dnaDir, 'technical.json'), migrateTechnical)

  // Backfill missing operational operations referenced by the API surface
  if (operational && api) {
    backfillOperationsFromApi(operational, api)
    fs.writeFileSync(opPath, JSON.stringify(operational, null, 2) + '\n', 'utf-8')
    console.log(`  ✓ backfilled API-referenced operations into operational.json`)
  }

  if (operational) {
    const corePath = path.join(dnaDir, 'product.core.json')
    fs.writeFileSync(corePath, JSON.stringify(emptyProductCore(operational), null, 2) + '\n', 'utf-8')
    console.log(`  ✓ stubbed: ${path.relative(REPO_ROOT, corePath)} (rematerialize via 'cba product core materialize')`)
  }
}

main()
