import { ErrImpl } from 'ts-results';
export declare class VmError extends ErrImpl<string> {
    constructor(msg: string);
}
export declare class ContractNotFoundError extends VmError {
    constructor(contractAddress: string);
}
//# sourceMappingURL=error.d.ts.map