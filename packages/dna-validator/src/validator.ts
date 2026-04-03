import Ajv, { ValidateFunction, ErrorObject } from 'ajv'
import * as attributeSchema from '../../../operational/schemas/attribute.json'
import * as verbSchema from '../../../operational/schemas/verb.json'
import * as nounSchema from '../../../operational/schemas/noun.json'
import * as capabilitySchema from '../../../operational/schemas/capability.json'
import * as domainSchema from '../../../operational/schemas/domain.json'
import * as triggerSchema from '../../../operational/schemas/trigger.json'
import * as policySchema from '../../../operational/schemas/policy.json'
import * as ruleSchema from '../../../operational/schemas/rule.json'
import * as effectSchema from '../../../operational/schemas/effect.json'
import * as flowSchema from '../../../operational/schemas/flow.json'
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
import * as operationalDnaSchema from '../../../operational/schemas/operational.json'
import * as productApiDnaSchema from '../../../product/schemas/product.api.json'
import * as productUiDnaSchema from '../../../product/schemas/product.ui.json'
import * as technicalDnaSchema from '../../../technical/schemas/technical.json'

export interface ValidationResult {
  valid: boolean
  errors: ErrorObject[]
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
      triggerSchema,
      policySchema,
      ruleSchema,
      effectSchema,
      flowSchema,
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
      operationalDnaSchema,
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
}
