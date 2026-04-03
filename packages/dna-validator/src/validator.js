"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DnaValidator = void 0;
const ajv_1 = __importDefault(require("ajv"));
const attributeSchema = __importStar(require("../../../operational/schemas/attribute.json"));
const verbSchema = __importStar(require("../../../operational/schemas/verb.json"));
const nounSchema = __importStar(require("../../../operational/schemas/noun.json"));
const capabilitySchema = __importStar(require("../../../operational/schemas/capability.json"));
const domainSchema = __importStar(require("../../../operational/schemas/domain.json"));
const triggerSchema = __importStar(require("../../../operational/schemas/trigger.json"));
const policySchema = __importStar(require("../../../operational/schemas/policy.json"));
const ruleSchema = __importStar(require("../../../operational/schemas/rule.json"));
const effectSchema = __importStar(require("../../../operational/schemas/effect.json"));
const flowSchema = __importStar(require("../../../operational/schemas/flow.json"));
const fieldSchema = __importStar(require("../../../product/schemas/core/field.json"));
const actionSchema = __importStar(require("../../../product/schemas/core/action.json"));
const resourceSchema = __importStar(require("../../../product/schemas/core/resource.json"));
const operationSchema = __importStar(require("../../../product/schemas/core/operation.json"));
const paramSchema = __importStar(require("../../../product/schemas/api/param.json"));
const schemaSchema = __importStar(require("../../../product/schemas/api/schema.json"));
const endpointSchema = __importStar(require("../../../product/schemas/api/endpoint.json"));
const namespaceSchema = __importStar(require("../../../product/schemas/api/namespace.json"));
const layoutSchema = __importStar(require("../../../product/schemas/web/layout.json"));
const routeSchema = __importStar(require("../../../product/schemas/web/route.json"));
const pageSchema = __importStar(require("../../../product/schemas/web/page.json"));
const blockSchema = __importStar(require("../../../product/schemas/web/block.json"));
const constructSchema = __importStar(require("../../../technical/schemas/construct.json"));
const providerSchema = __importStar(require("../../../technical/schemas/provider.json"));
const variableSchema = __importStar(require("../../../technical/schemas/variable.json"));
const outputSchema = __importStar(require("../../../technical/schemas/output.json"));
const environmentSchema = __importStar(require("../../../technical/schemas/environment.json"));
const cellSchema = __importStar(require("../../../technical/schemas/cell.json"));
const operationalDnaSchema = __importStar(require("../../../operational/schemas/operational.json"));
const productApiDnaSchema = __importStar(require("../../../product/schemas/product.api.json"));
const productUiDnaSchema = __importStar(require("../../../product/schemas/product.ui.json"));
const technicalDnaSchema = __importStar(require("../../../technical/schemas/technical.json"));
class DnaValidator {
    constructor() {
        this.validators = new Map();
        this.ajv = new ajv_1.default({ strict: false, allErrors: true });
        this.registerSchemas();
    }
    registerSchemas() {
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
        ];
        for (const schema of schemas) {
            this.ajv.addSchema(schema);
        }
        for (const schema of schemas) {
            const s = schema;
            this.validators.set(s.$id, this.ajv.getSchema(s.$id));
            // Also register by short ID (e.g. "operational/noun") for convenience
            const shortId = s.$id.replace('https://dna.local/', '');
            this.validators.set(shortId, this.ajv.getSchema(s.$id));
        }
    }
    validate(doc, schemaId) {
        const validateFn = this.validators.get(schemaId);
        if (!validateFn) {
            throw new Error(`Unknown schema: "${schemaId}". Available: ${[...this.validators.keys()].join(', ')}`);
        }
        const valid = validateFn(doc);
        return { valid, errors: validateFn.errors ?? [] };
    }
    availableSchemas() {
        return [...this.validators.keys()];
    }
}
exports.DnaValidator = DnaValidator;
//# sourceMappingURL=validator.js.map