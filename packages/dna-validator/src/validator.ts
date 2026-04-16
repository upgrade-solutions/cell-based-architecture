import Ajv, { ValidateFunction, ErrorObject } from 'ajv'
import * as attributeSchema from '../../../operational/schemas/attribute.json'
import * as verbSchema from '../../../operational/schemas/verb.json'
import * as nounSchema from '../../../operational/schemas/noun.json'
import * as capabilitySchema from '../../../operational/schemas/capability.json'
import * as domainSchema from '../../../operational/schemas/domain.json'
import * as causeSchema from '../../../operational/schemas/cause.json'
import * as ruleSchema from '../../../operational/schemas/rule.json'
import * as outcomeSchema from '../../../operational/schemas/outcome.json'
import * as equationSchema from '../../../operational/schemas/equation.json'
import * as positionSchema from '../../../operational/schemas/position.json'
import * as personSchema from '../../../operational/schemas/person.json'
import * as taskSchema from '../../../operational/schemas/task.json'
import * as processSchema from '../../../operational/schemas/process.json'
import * as signalSchema from '../../../operational/schemas/signal.json'
import * as relationshipSchema from '../../../operational/schemas/relationship.json'
import * as roleSchema from '../../../product/schemas/core/role.json'
import * as fieldSchema from '../../../product/schemas/core/field.json'
import * as actionSchema from '../../../product/schemas/core/action.json'
import * as resourceSchema from '../../../product/schemas/core/resource.json'
import * as operationSchema from '../../../product/schemas/core/operation.json'
import * as paramSchema from '../../../product/schemas/api/param.json'
import * as schemaSchema from '../../../product/schemas/api/schema.json'
import * as endpointSchema from '../../../product/schemas/api/endpoint.json'
import * as namespaceSchema from '../../../product/schemas/api/namespace.json'
import * as layoutSchema from '../../../product/schemas/web/layout.json'
import * as routeSchema from '../../../product/schemas/web/route.json'
import * as pageSchema from '../../../product/schemas/web/page.json'
import * as blockSchema from '../../../product/schemas/web/block.json'
import * as constructSchema from '../../../technical/schemas/construct.json'
import * as providerSchema from '../../../technical/schemas/provider.json'
import * as variableSchema from '../../../technical/schemas/variable.json'
import * as outputSchema from '../../../technical/schemas/output.json'
import * as environmentSchema from '../../../technical/schemas/environment.json'
import * as cellSchema from '../../../technical/schemas/cell.json'
import * as scriptSchema from '../../../technical/schemas/script.json'
import * as operationalDnaSchema from '../../../operational/schemas/operational.json'
import * as productCoreDnaSchema from '../../../product/schemas/product.core.json'
import * as productApiDnaSchema from '../../../product/schemas/product.api.json'
import * as productUiDnaSchema from '../../../product/schemas/product.ui.json'
import * as technicalDnaSchema from '../../../technical/schemas/technical.json'
import * as nodeSchema from '../../../technical/schemas/node.json'
import * as connectionSchema from '../../../technical/schemas/connection.json'
import * as zoneSchema from '../../../technical/schemas/zone.json'
import * as viewSchema from '../../../technical/schemas/view.json'

export interface ValidationResult {
  valid: boolean
  errors: ErrorObject[]
}

export interface CrossLayerError {
  layer: string
  path: string
  message: string
}

export interface CrossLayerResult {
  valid: boolean
  errors: CrossLayerError[]
}

interface OperationalDNA {
  domain: {
    name: string
    domains?: OperationalDNA['domain'][]
    nouns?: { name: string; verbs?: { name: string }[]; attributes?: { name: string }[] }[]
  }
  capabilities?: { name: string; noun: string; verb: string }[]
  signals?: { name: string; capability: string }[]
  outcomes?: { capability: string; emits?: string[] }[]
  causes?: { capability: string; source: string; signal?: string }[]
  rules?: { capability: string; type?: string; allow?: { role?: string }[] }[]
  relationships?: { name: string; from: string; to: string; attribute: string; cardinality: string }[]
  positions?: { name: string; roles?: string[]; reports_to?: string }[]
  persons?: { name: string; position: string }[]
  tasks?: { name: string; position: string; capability: string }[]
  processes?: { name: string; operator: string; steps: { id: string; task: string; depends_on?: string[] }[]; emits?: string[] }[]
}

interface ProductCoreDNA {
  domain: { name: string; path: string }
  nouns?: { name: string; verbs?: { name: string }[]; attributes?: { name: string }[] }[]
  capabilities?: { name: string; noun: string; verb: string }[]
  signals?: { name: string; capability: string }[]
  outcomes?: { capability: string; emits?: string[] }[]
  causes?: { capability: string; source: string; signal?: string }[]
  relationships?: { name: string; from: string; to: string; attribute: string }[]
  roles?: { name: string }[]
}

interface ProductApiDNA {
  namespace?: { name: string; resources?: string[] }
  resources?: { name: string; noun?: string; actions?: { name: string; verb?: string }[] }[]
  operations?: { name: string; resource: string; action: string; capability?: string }[]
  endpoints?: { operation: string }[]
}

interface ProductUiDNA {
  pages?: { name: string; resource?: string; blocks?: { name: string; operation?: string }[] }[]
  routes?: { page: string }[]
}

interface TechnicalDNA {
  providers?: { name: string }[]
  constructs?: { name: string; provider?: string }[]
  cells?: { name: string; dna: string; constructs?: string[] }[]
}

export class DnaValidator {
  private ajv: Ajv
  private validators = new Map<string, ValidateFunction>()

  constructor() {
    this.ajv = new Ajv({ strict: false, allErrors: true })
    this.registerSchemas()
  }

  private registerSchemas(): void {
    const schemas = [
      attributeSchema,
      verbSchema,
      nounSchema,
      capabilitySchema,
      domainSchema,
      causeSchema,
      ruleSchema,
      outcomeSchema,
      equationSchema,
      positionSchema,
      personSchema,
      taskSchema,
      processSchema,
      roleSchema,
      fieldSchema,
      actionSchema,
      resourceSchema,
      operationSchema,
      paramSchema,
      schemaSchema,
      endpointSchema,
      namespaceSchema,
      layoutSchema,
      routeSchema,
      pageSchema,
      blockSchema,
      constructSchema,
      providerSchema,
      variableSchema,
      outputSchema,
      environmentSchema,
      cellSchema,
      scriptSchema,
      signalSchema,
      relationshipSchema,
      nodeSchema,
      connectionSchema,
      zoneSchema,
      viewSchema,
      operationalDnaSchema,
      productCoreDnaSchema,
      productApiDnaSchema,
      productUiDnaSchema,
      technicalDnaSchema,
    ]

    for (const schema of schemas) {
      this.ajv.addSchema(schema)
    }

    for (const schema of schemas) {
      const s = schema as { $id: string }
      this.validators.set(s.$id, this.ajv.getSchema(s.$id)!)
      // Also register by short ID (e.g. "operational/noun") for convenience
      const shortId = s.$id.replace('https://dna.local/', '')
      this.validators.set(shortId, this.ajv.getSchema(s.$id)!)
    }
  }

  validate(doc: unknown, schemaId: string): ValidationResult {
    const validateFn = this.validators.get(schemaId)
    if (!validateFn) {
      throw new Error(`Unknown schema: "${schemaId}". Available: ${[...this.validators.keys()].join(', ')}`)
    }
    const valid = validateFn(doc) as boolean
    return { valid, errors: validateFn.errors ?? [] }
  }

  availableSchemas(): string[] {
    return [...this.validators.keys()]
  }

  // ── Cross-layer validation ─────────────────────────────────────────────────

  private collectNouns(domain: OperationalDNA['domain']): { name: string; verbs?: { name: string }[] }[] {
    const nouns: { name: string; verbs?: { name: string }[] }[] = [...(domain.nouns ?? [])]
    for (const sub of domain.domains ?? []) {
      nouns.push(...this.collectNouns(sub))
    }
    return nouns
  }

  validateCrossLayer(layers: {
    operational?: unknown
    productCore?: unknown
    productApi?: unknown
    productUi?: unknown
    technical?: unknown
  }): CrossLayerResult {
    const errors: CrossLayerError[] = []
    const op = layers.operational as OperationalDNA | undefined
    const core = layers.productCore as ProductCoreDNA | undefined
    const api = layers.productApi as ProductApiDNA | undefined
    const ui = layers.productUi as ProductUiDNA | undefined
    const tech = layers.technical as TechnicalDNA | undefined

    // ── Operational: Signal consistency ──────────────────────────────────
    if (op) {
      const capabilityNames = new Set((op.capabilities ?? []).map(c => c.name))
      const signalNames = new Set((op.signals ?? []).map(s => s.name))

      // Signal.capability must reference a valid Capability
      for (const signal of op.signals ?? []) {
        if (!capabilityNames.has(signal.capability)) {
          errors.push({
            layer: 'operational',
            path: `signals/${signal.name}/capability`,
            message: `Signal "${signal.name}" references Capability "${signal.capability}" which does not exist. Available: ${[...capabilityNames].join(', ')}`,
          })
        }
      }

      // Outcome.emits must reference valid Signal names
      for (const outcome of op.outcomes ?? []) {
        for (const signalRef of outcome.emits ?? []) {
          if (!signalNames.has(signalRef)) {
            errors.push({
              layer: 'operational',
              path: `outcomes/${outcome.capability}/emits/${signalRef}`,
              message: `Outcome for "${outcome.capability}" emits Signal "${signalRef}" which does not exist. Available: ${[...signalNames].join(', ')}`,
            })
          }
        }
      }

      // Cause with source "signal" must reference a valid Signal name
      for (const cause of op.causes ?? []) {
        if (cause.source === 'signal' && cause.signal && !signalNames.has(cause.signal)) {
          errors.push({
            layer: 'operational',
            path: `causes/${cause.capability}/signal`,
            message: `Cause for "${cause.capability}" references Signal "${cause.signal}" which does not exist. Available: ${[...signalNames].join(', ')}`,
          })
        }
      }

      // Relationship validation: from/to must reference valid Nouns, attribute must exist on "from" Noun
      const nouns = this.collectNouns(op.domain)
      const nounNames = new Set(nouns.map(n => n.name))
      for (const rel of op.relationships ?? []) {
        if (!nounNames.has(rel.from)) {
          errors.push({
            layer: 'operational',
            path: `relationships/${rel.name}/from`,
            message: `Relationship "${rel.name}" references Noun "${rel.from}" (from) which does not exist. Available: ${[...nounNames].join(', ')}`,
          })
        }
        if (!nounNames.has(rel.to)) {
          errors.push({
            layer: 'operational',
            path: `relationships/${rel.name}/to`,
            message: `Relationship "${rel.name}" references Noun "${rel.to}" (to) which does not exist. Available: ${[...nounNames].join(', ')}`,
          })
        }
        if (nounNames.has(rel.from)) {
          const fromNoun = nouns.find(n => n.name === rel.from) as any
          const attrNames = new Set(((fromNoun?.attributes as any[]) ?? []).map((a: any) => a.name))
          if (!attrNames.has(rel.attribute)) {
            errors.push({
              layer: 'operational',
              path: `relationships/${rel.name}/attribute`,
              message: `Relationship "${rel.name}" references Attribute "${rel.attribute}" which does not exist on Noun "${rel.from}". Available: ${[...attrNames].join(', ')}`,
            })
          }
        }
      }

      // ── SOP: intra-operational references ─────────────────────────────
      const positionNames = new Set((op.positions ?? []).map(p => p.name))
      const taskNames = new Set((op.tasks ?? []).map(t => t.name))

      // Position.reports_to must reference a declared Position
      for (const pos of op.positions ?? []) {
        if (pos.reports_to && !positionNames.has(pos.reports_to)) {
          errors.push({
            layer: 'operational',
            path: `positions/${pos.name}/reports_to`,
            message: `Position "${pos.name}" reports_to "${pos.reports_to}" which does not exist. Available: ${[...positionNames].join(', ')}`,
          })
        }
      }

      // Person.position must reference a declared Position
      for (const person of op.persons ?? []) {
        if (!positionNames.has(person.position)) {
          errors.push({
            layer: 'operational',
            path: `persons/${person.name}/position`,
            message: `Person "${person.name}" references Position "${person.position}" which does not exist. Available: ${[...positionNames].join(', ')}`,
          })
        }
      }

      // Task.position must reference a declared Position
      // Task.capability must reference a declared Capability
      for (const task of op.tasks ?? []) {
        if (!positionNames.has(task.position)) {
          errors.push({
            layer: 'operational',
            path: `tasks/${task.name}/position`,
            message: `Task "${task.name}" references Position "${task.position}" which does not exist. Available: ${[...positionNames].join(', ')}`,
          })
        }
        if (!capabilityNames.has(task.capability)) {
          errors.push({
            layer: 'operational',
            path: `tasks/${task.name}/capability`,
            message: `Task "${task.name}" references Capability "${task.capability}" which does not exist. Available: ${[...capabilityNames].join(', ')}`,
          })
        }
      }

      // Process.operator must reference a declared Position
      // Process.steps[].task must reference a declared Task
      // Process.steps[].depends_on[] must reference sibling step IDs
      // Process.emits[] must reference declared Signals
      for (const proc of op.processes ?? []) {
        if (!positionNames.has(proc.operator)) {
          errors.push({
            layer: 'operational',
            path: `processes/${proc.name}/operator`,
            message: `Process "${proc.name}" operator "${proc.operator}" does not reference a declared Position. Available: ${[...positionNames].join(', ')}`,
          })
        }
        const stepIds = new Set((proc.steps ?? []).map(s => s.id))
        for (const step of proc.steps ?? []) {
          if (!taskNames.has(step.task)) {
            errors.push({
              layer: 'operational',
              path: `processes/${proc.name}/steps/${step.id}/task`,
              message: `Step "${step.id}" in Process "${proc.name}" references Task "${step.task}" which does not exist. Available: ${[...taskNames].join(', ')}`,
            })
          }
          for (const dep of step.depends_on ?? []) {
            if (!stepIds.has(dep)) {
              errors.push({
                layer: 'operational',
                path: `processes/${proc.name}/steps/${step.id}/depends_on/${dep}`,
                message: `Step "${step.id}" in Process "${proc.name}" depends_on "${dep}" which is not a sibling step ID. Available: ${[...stepIds].join(', ')}`,
              })
            }
          }
        }
        for (const sig of proc.emits ?? []) {
          if (!signalNames.has(sig)) {
            errors.push({
              layer: 'operational',
              path: `processes/${proc.name}/emits/${sig}`,
              message: `Process "${proc.name}" emits Signal "${sig}" which does not exist. Available: ${[...signalNames].join(', ')}`,
            })
          }
        }
      }
    }

    // ── Operational → Product Core (materializer consistency) ──────────────
    // If both are present, every Noun/Capability/Signal in product.core must
    // also exist in operational — product core is a projection, never invents.
    if (op && core) {
      const opNouns = this.collectNouns(op.domain)
      const opNounNames = new Set(opNouns.map(n => n.name))
      const opCapabilityNames = new Set((op.capabilities ?? []).map(c => c.name))
      const opSignalNames = new Set((op.signals ?? []).map(s => s.name))

      for (const noun of core.nouns ?? []) {
        if (!opNounNames.has(noun.name)) {
          errors.push({
            layer: 'product/core',
            path: `nouns/${noun.name}`,
            message: `Product Core Noun "${noun.name}" is not present in Operational DNA. Re-run the materializer.`,
          })
        }
      }
      for (const cap of core.capabilities ?? []) {
        if (!opCapabilityNames.has(cap.name)) {
          errors.push({
            layer: 'product/core',
            path: `capabilities/${cap.name}`,
            message: `Product Core Capability "${cap.name}" is not present in Operational DNA. Re-run the materializer.`,
          })
        }
      }
      for (const sig of core.signals ?? []) {
        if (!opSignalNames.has(sig.name)) {
          errors.push({
            layer: 'product/core',
            path: `signals/${sig.name}`,
            message: `Product Core Signal "${sig.name}" is not present in Operational DNA. Re-run the materializer.`,
          })
        }
      }

      // ── Operational → Product Core: Role references ───────────────────
      const coreRoleNames = new Set((core.roles ?? []).map(r => r.name))
      if (coreRoleNames.size > 0) {
        // Position.roles[] must reference declared Product Core Roles
        for (const pos of op.positions ?? []) {
          for (const roleName of pos.roles ?? []) {
            if (!coreRoleNames.has(roleName)) {
              errors.push({
                layer: 'operational',
                path: `positions/${pos.name}/roles/${roleName}`,
                message: `Position "${pos.name}" references Role "${roleName}" which does not exist in Product Core DNA. Available: ${[...coreRoleNames].join(', ')}`,
              })
            }
          }
        }

        // Rule.allow[].role must reference declared Product Core Roles
        for (const rule of op.rules ?? []) {
          if (rule.type !== 'access') continue
          for (const entry of (rule as any).allow ?? []) {
            if (entry.role && !coreRoleNames.has(entry.role)) {
              errors.push({
                layer: 'operational',
                path: `rules/${(rule as any).capability}/allow/role/${entry.role}`,
                message: `Rule for "${(rule as any).capability}" references Role "${entry.role}" which does not exist in Product Core DNA. Available: ${[...coreRoleNames].join(', ')}`,
              })
            }
          }
        }
      }
    }

    // ── Product API → Product Core (preferred) or Operational (fallback) ───
    // When product.core is available, API references resolve against it;
    // otherwise fall back to walking operational directly. Technical layers
    // only ever see product.core, so the core path is the canonical one.
    if ((core || op) && api) {
      const nouns = core
        ? (core.nouns ?? [])
        : this.collectNouns((op as OperationalDNA).domain)
      const nounNames = new Set(nouns.map(n => n.name))
      const capabilities = core ? core.capabilities : (op as OperationalDNA).capabilities
      const capabilityNames = new Set((capabilities ?? []).map(c => c.name))
      const referenceLayer = core ? 'product/core' : 'operational'

      // Resource noun references
      for (const resource of api.resources ?? []) {
        if (resource.noun && !nounNames.has(resource.noun)) {
          errors.push({
            layer: 'product/api',
            path: `resources/${resource.name}/noun`,
            message: `Resource "${resource.name}" references Noun "${resource.noun}" which does not exist in ${referenceLayer === 'product/core' ? 'Product Core' : 'Operational'} DNA. Available: ${[...nounNames].join(', ')}`,
          })
        }

        // Action verb references
        if (resource.noun && nounNames.has(resource.noun)) {
          const noun = nouns.find(n => n.name === resource.noun)
          const verbNames = new Set((noun?.verbs ?? []).map(v => v.name))
          for (const action of resource.actions ?? []) {
            if (action.verb && !verbNames.has(action.verb)) {
              errors.push({
                layer: 'product/api',
                path: `resources/${resource.name}/actions/${action.name}/verb`,
                message: `Action "${action.name}" on Resource "${resource.name}" references Verb "${action.verb}" which does not exist on Noun "${resource.noun}". Available: ${[...verbNames].join(', ')}`,
              })
            }
          }
        }
      }

      // Operation capability references
      for (const operation of api.operations ?? []) {
        if (operation.capability && !capabilityNames.has(operation.capability)) {
          errors.push({
            layer: 'product/api',
            path: `operations/${operation.name}/capability`,
            message: `Operation "${operation.name}" references Capability "${operation.capability}" which does not exist in ${referenceLayer === 'product/core' ? 'Product Core' : 'Operational'} DNA. Available: ${[...capabilityNames].join(', ')}`,
          })
        }
      }

      // Endpoint operation references
      const operationNames = new Set((api.operations ?? []).map(o => o.name))
      for (const endpoint of api.endpoints ?? []) {
        if (endpoint.operation && !operationNames.has(endpoint.operation)) {
          errors.push({
            layer: 'product/api',
            path: `endpoints/${endpoint.operation}/operation`,
            message: `Endpoint references Operation "${endpoint.operation}" which is not defined in operations. Available: ${[...operationNames].join(', ')}`,
          })
        }
      }
    }

    // ── Product UI → Product API ───────────────────────────────────────────
    if (api && ui) {
      const resourceNames = new Set((api.resources ?? []).map(r => r.name))
      const operationNames = new Set((api.operations ?? []).map(o => o.name))

      // Page resource references
      for (const page of ui.pages ?? []) {
        if (page.resource && !resourceNames.has(page.resource)) {
          errors.push({
            layer: 'product/ui',
            path: `pages/${page.name}/resource`,
            message: `Page "${page.name}" references Resource "${page.resource}" which does not exist in Product API DNA. Available: ${[...resourceNames].join(', ')}`,
          })
        }

        // Block operation references
        for (const block of page.blocks ?? []) {
          if (block.operation && !operationNames.has(block.operation)) {
            errors.push({
              layer: 'product/ui',
              path: `pages/${page.name}/blocks/${block.name}/operation`,
              message: `Block "${block.name}" on Page "${page.name}" references Operation "${block.operation}" which does not exist in Product API DNA. Available: ${[...operationNames].join(', ')}`,
            })
          }
        }
      }

      // Route page references
      const pageNames = new Set((ui.pages ?? []).map(p => p.name))
      for (const route of ui.routes ?? []) {
        if (route.page && !pageNames.has(route.page)) {
          errors.push({
            layer: 'product/ui',
            path: `routes/${route.page}/page`,
            message: `Route references Page "${route.page}" which is not defined in pages. Available: ${[...pageNames].join(', ')}`,
          })
        }
      }
    }

    // ── Technical → Product/Operational ────────────────────────────────────
    if (tech) {
      const providerNames = new Set((tech.providers ?? []).map(p => p.name))
      const constructNames = new Set((tech.constructs ?? []).map(c => c.name))

      // Construct provider references
      for (const construct of tech.constructs ?? []) {
        if (construct.provider && !providerNames.has(construct.provider)) {
          errors.push({
            layer: 'technical',
            path: `constructs/${construct.name}/provider`,
            message: `Construct "${construct.name}" references Provider "${construct.provider}" which does not exist. Available: ${[...providerNames].join(', ')}`,
          })
        }
      }

      // Cell construct references
      for (const cell of tech.cells ?? []) {
        for (const constructRef of cell.constructs ?? []) {
          if (!constructNames.has(constructRef)) {
            errors.push({
              layer: 'technical',
              path: `cells/${cell.name}/constructs/${constructRef}`,
              message: `Cell "${cell.name}" references Construct "${constructRef}" which does not exist. Available: ${[...constructNames].join(', ')}`,
            })
          }
        }
      }
    }

    return { valid: errors.length === 0, errors }
  }
}
