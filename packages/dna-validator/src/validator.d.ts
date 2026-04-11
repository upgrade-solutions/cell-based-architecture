import { ErrorObject } from 'ajv';
export interface ValidationResult {
    valid: boolean;
    errors: ErrorObject[];
}
export interface CrossLayerError {
    layer: string;
    path: string;
    message: string;
}
export interface CrossLayerResult {
    valid: boolean;
    errors: CrossLayerError[];
}
export declare class DnaValidator {
    private ajv;
    private validators;
    constructor();
    private registerSchemas;
    validate(doc: unknown, schemaId: string): ValidationResult;
    availableSchemas(): string[];
    private collectNouns;
    validateCrossLayer(layers: {
        operational?: unknown;
        productCore?: unknown;
        productApi?: unknown;
        productUi?: unknown;
        technical?: unknown;
    }): CrossLayerResult;
}
//# sourceMappingURL=validator.d.ts.map