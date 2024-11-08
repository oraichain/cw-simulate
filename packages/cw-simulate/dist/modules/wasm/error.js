"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContractNotFoundError = exports.VmError = void 0;
const ts_results_1 = require("ts-results");
class VmError extends ts_results_1.ErrImpl {
    constructor(msg) {
        super(`VmError: ${msg}`);
    }
}
exports.VmError = VmError;
class ContractNotFoundError extends VmError {
    constructor(contractAddress) {
        super(`contract ${contractAddress} not found`);
    }
}
exports.ContractNotFoundError = ContractNotFoundError;
//# sourceMappingURL=error.js.map