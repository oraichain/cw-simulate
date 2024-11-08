"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BasicBackendApi = exports.EXCESS_PADDING = exports.CANONICAL_LENGTH = exports.GasInfo = void 0;
const encoding_1 = require("@cosmjs/encoding");
const bech32_1 = __importDefault(require("bech32"));
const instance_1 = require("../instance");
class GasInfo {
    cost;
    externally_used;
    constructor(cost, externally_used) {
        this.cost = cost;
        this.externally_used = externally_used;
    }
    static with_cost(cost) {
        return new GasInfo(cost, 0);
    }
    static with_externally_used(externally_used) {
        return new GasInfo(0, externally_used);
    }
    static free() {
        return new GasInfo(0, 0);
    }
}
exports.GasInfo = GasInfo;
exports.CANONICAL_LENGTH = 64;
exports.EXCESS_PADDING = 6;
class BasicBackendApi {
    bech32_prefix;
    constructor(bech32_prefix = 'terra') {
        this.bech32_prefix = bech32_prefix;
    }
    poseidon_hash(left_input, right_input, curve) {
        throw new Error('Method not implemented.');
    }
    curve_hash(input, curve) {
        throw new Error('Method not implemented.');
    }
    groth16_verify(input, proof, vk, curve) {
        throw new Error('Method not implemented.');
    }
    keccak_256(input) {
        throw new Error('Method not implemented.');
    }
    sha256(input) {
        throw new Error('Method not implemented.');
    }
    canonical_address(human) {
        if (human.length === 0) {
            throw new Error('Empty human address');
        }
        const normalized = (0, encoding_1.normalizeBech32)(human);
        if (normalized.length < 3) {
            throw new Error(`canonical_address: Address too short: ${normalized}`);
        }
        if (normalized.length > exports.CANONICAL_LENGTH) {
            throw new Error(`canonical_address: Address too long: ${normalized}`);
        }
        return (0, encoding_1.fromBech32)(normalized).data;
    }
    human_address(canonical) {
        if (canonical.length === 0) {
            throw new Error('human_address: Empty canonical address');
        }
        // Remove excess padding, otherwise bech32.encode will throw "Exceeds length limit"
        // error when normalized is greater than MAX_LENGTH_HUMAN_ADDRESS in length.
        const normalized = canonical.length >= exports.CANONICAL_LENGTH
            ? canonical.slice(0, exports.CANONICAL_LENGTH - exports.EXCESS_PADDING)
            : canonical;
        return bech32_1.default.encode(this.bech32_prefix, bech32_1.default.toWords(normalized), instance_1.MAX_LENGTH_HUMAN_ADDRESS);
    }
}
exports.BasicBackendApi = BasicBackendApi;
//# sourceMappingURL=backendApi.js.map