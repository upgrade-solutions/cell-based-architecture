import { ErrorObject } from 'ajv';
export interface ValidationResult {
    valid: boolean;
    errors: ErrorObject[];
}
export declare class DnaValidator {
    private ajv;
    private validators;
    constructor();
    private registerSchemas;
    validate(doc: unknown, schemaId: string): ValidationResult;
    availableSchemas(): string[];
}
//# sourceMappingURL=validator.d.ts.map