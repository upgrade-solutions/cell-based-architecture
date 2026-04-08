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
const causeSchema = __importStar(require("../../../operational/schemas/cause.json"));
const ruleSchema = __importStar(require("../../../operational/schemas/rule.json"));
const outcomeSchema = __importStar(require("../../../operational/schemas/outcome.json"));
const lifecycleSchema = __importStar(require("../../../operational/schemas/lifecycle.json"));
const equationSchema = __importStar(require("../../../operational/schemas/equation.json"));
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
const scriptSchema = __importStar(require("../../../technical/schemas/script.json"));
const operationalDnaSchema = __importStar(require("../../../operational/schemas/operational.json"));
const productApiDnaSchema = __importStar(require("../../../product/schemas/product.api.json"));
const productUiDnaSchema = __importStar(require("../../../product/schemas/product.ui.json"));
const technicalDnaSchema = __importStar(require("../../../technical/schemas/technical.json"));
const nodeSchema = __importStar(require("../../../technical/schemas/node.json"));
const connectionSchema = __importStar(require("../../../technical/schemas/connection.json"));
const zoneSchema = __importStar(require("../../../technical/schemas/zone.json"));
const viewSchema = __importStar(require("../../../technical/schemas/view.json"));
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
            causeSchema,
            ruleSchema,
            outcomeSchema,
            lifecycleSchema,
            equationSchema,
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
            operationalDnaSchema,
            productApiDnaSchema,
            productUiDnaSchema,
            technicalDnaSchema,
            nodeSchema,
            connectionSchema,
            zoneSchema,
            viewSchema,
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
    // ── Cross-layer validation ─────────────────────────────────────────────────
    collectNouns(domain) {
        const nouns = [...(domain.nouns ?? [])];
        for (const sub of domain.domains ?? []) {
            nouns.push(...this.collectNouns(sub));
        }
        return nouns;
    }
    validateCrossLayer(layers) {
        const errors = [];
        const op = layers.operational;
        const api = layers.productApi;
        const ui = layers.productUi;
        const tech = layers.technical;
        // ── Product API → Operational ──────────────────────────────────────────
        if (op && api) {
            const nouns = this.collectNouns(op.domain);
            const nounNames = new Set(nouns.map(n => n.name));
            const capabilityNames = new Set((op.capabilities ?? []).map(c => c.name));
            // Resource noun references
            for (const resource of api.resources ?? []) {
                if (resource.noun && !nounNames.has(resource.noun)) {
                    errors.push({
                        layer: 'product/api',
                        path: `resources/${resource.name}/noun`,
                        message: `Resource "${resource.name}" references Noun "${resource.noun}" which does not exist in Operational DNA. Available: ${[...nounNames].join(', ')}`,
                    });
                }
                // Action verb references
                if (resource.noun && nounNames.has(resource.noun)) {
                    const noun = nouns.find(n => n.name === resource.noun);
                    const verbNames = new Set((noun?.verbs ?? []).map(v => v.name));
                    for (const action of resource.actions ?? []) {
                        if (action.verb && !verbNames.has(action.verb)) {
                            errors.push({
                                layer: 'product/api',
                                path: `resources/${resource.name}/actions/${action.name}/verb`,
                                message: `Action "${action.name}" on Resource "${resource.name}" references Verb "${action.verb}" which does not exist on Noun "${resource.noun}". Available: ${[...verbNames].join(', ')}`,
                            });
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
                        message: `Operation "${operation.name}" references Capability "${operation.capability}" which does not exist in Operational DNA. Available: ${[...capabilityNames].join(', ')}`,
                    });
                }
            }
            // Endpoint operation references
            const operationNames = new Set((api.operations ?? []).map(o => o.name));
            for (const endpoint of api.endpoints ?? []) {
                if (endpoint.operation && !operationNames.has(endpoint.operation)) {
                    errors.push({
                        layer: 'product/api',
                        path: `endpoints/${endpoint.operation}/operation`,
                        message: `Endpoint references Operation "${endpoint.operation}" which is not defined in operations. Available: ${[...operationNames].join(', ')}`,
                    });
                }
            }
        }
        // ── Product UI → Product API ───────────────────────────────────────────
        if (api && ui) {
            const resourceNames = new Set((api.resources ?? []).map(r => r.name));
            const operationNames = new Set((api.operations ?? []).map(o => o.name));
            // Page resource references
            for (const page of ui.pages ?? []) {
                if (page.resource && !resourceNames.has(page.resource)) {
                    errors.push({
                        layer: 'product/ui',
                        path: `pages/${page.name}/resource`,
                        message: `Page "${page.name}" references Resource "${page.resource}" which does not exist in Product API DNA. Available: ${[...resourceNames].join(', ')}`,
                    });
                }
                // Block operation references
                for (const block of page.blocks ?? []) {
                    if (block.operation && !operationNames.has(block.operation)) {
                        errors.push({
                            layer: 'product/ui',
                            path: `pages/${page.name}/blocks/${block.name}/operation`,
                            message: `Block "${block.name}" on Page "${page.name}" references Operation "${block.operation}" which does not exist in Product API DNA. Available: ${[...operationNames].join(', ')}`,
                        });
                    }
                }
            }
            // Route page references
            const pageNames = new Set((ui.pages ?? []).map(p => p.name));
            for (const route of ui.routes ?? []) {
                if (route.page && !pageNames.has(route.page)) {
                    errors.push({
                        layer: 'product/ui',
                        path: `routes/${route.page}/page`,
                        message: `Route references Page "${route.page}" which is not defined in pages. Available: ${[...pageNames].join(', ')}`,
                    });
                }
            }
        }
        // ── Technical → Product/Operational ────────────────────────────────────
        if (tech) {
            const providerNames = new Set((tech.providers ?? []).map(p => p.name));
            const constructNames = new Set((tech.constructs ?? []).map(c => c.name));
            // Construct provider references
            for (const construct of tech.constructs ?? []) {
                if (construct.provider && !providerNames.has(construct.provider)) {
                    errors.push({
                        layer: 'technical',
                        path: `constructs/${construct.name}/provider`,
                        message: `Construct "${construct.name}" references Provider "${construct.provider}" which does not exist. Available: ${[...providerNames].join(', ')}`,
                    });
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
                        });
                    }
                }
            }
        }
        return { valid: errors.length === 0, errors };
    }
}
exports.DnaValidator = DnaValidator;
//# sourceMappingURL=validator.js.map