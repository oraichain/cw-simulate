"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.printDebug = exports.getTransactionHash = exports.isTSResult = exports.isRustResult = exports.isArrayLike = void 0;
exports.fromRustResult = fromRustResult;
exports.toRustResult = toRustResult;
const ts_results_1 = require("ts-results");
const crypto_1 = require("@cosmjs/crypto");
const encoding_1 = require("@cosmjs/encoding");
const isArrayLike = (value) => typeof value === 'object' && typeof value.length === 'number';
exports.isArrayLike = isArrayLike;
function fromRustResult(res) {
    if ('ok' in res) {
        return (0, ts_results_1.Ok)(res.ok);
    }
    else if (typeof res.error === 'string') {
        return (0, ts_results_1.Err)(res.error);
    }
    else
        throw new Error('Invalid RustResult type');
}
function toRustResult(res) {
    if (res.ok) {
        return { ok: res.val };
    }
    else {
        return { error: res.val };
    }
}
const isRustResult = (value) => 'ok' in value || 'err' in value;
exports.isRustResult = isRustResult;
const isTSResult = (value) => typeof value.ok === 'boolean' && typeof value.err === 'boolean' && 'val' in value;
exports.isTSResult = isTSResult;
const getTransactionHash = (height, data, encoding) => {
    const buf = Buffer.from(JSON.stringify({ data, height }), encoding);
    // @ts-ignore
    return (0, encoding_1.toHex)((0, crypto_1.sha256)(buf));
};
exports.getTransactionHash = getTransactionHash;
// debug debug print
const printDebug = (log) => {
    if (log.type === 'print') {
        console.log(log.message);
    }
};
exports.printDebug = printDebug;
//# sourceMappingURL=util.js.map