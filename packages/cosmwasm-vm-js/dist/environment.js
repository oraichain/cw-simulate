"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Environment = exports.DEFAULT_GAS_LIMIT = exports.GAS_PER_US = exports.GAS_MULTIPLIER = exports.GAS_PER_OP = void 0;
exports.GAS_PER_OP = 150_000;
exports.GAS_MULTIPLIER = 14_000_000; // convert to chain gas
exports.GAS_PER_US = 1_000_000_000;
exports.DEFAULT_GAS_LIMIT = 1_000_000_000_000; // ~1ms
class Environment {
    backendApi;
    data;
    static gasConfig = {
        // ~154 us in crypto benchmarks
        secp256k1_verify_cost: 154 * exports.GAS_PER_US,
        // ~6920 us in crypto benchmarks
        groth16_verify_cost: 6920 * exports.GAS_PER_US,
        // ~43 us in crypto benchmarks
        poseidon_hash_cost: 43 * exports.GAS_PER_US,
        // ~480 ns ~ 0.5 in crypto benchmarks
        keccak_256_cost: exports.GAS_PER_US / 2,
        // ~968 ns ~ 1 us in crypto benchmarks
        sha256_cost: exports.GAS_PER_US,
        // ~920 ns ~ 1 us in crypto benchmarks
        curve_hash_cost: exports.GAS_PER_US,
        // ~162 us in crypto benchmarks
        secp256k1_recover_pubkey_cost: 162 * exports.GAS_PER_US,
        // ~63 us in crypto benchmarks
        ed25519_verify_cost: 63 * exports.GAS_PER_US,
        // Gas cost factors, relative to ed25519_verify cost
        // From https://docs.rs/ed25519-zebra/2.2.0/ed25519_zebra/batch/index.html
        ed25519_batch_verify_cost: (63 * exports.GAS_PER_US) / 2,
        ed25519_batch_verify_one_pubkey_cost: (63 * exports.GAS_PER_US) / 4,
    };
    constructor(backendApi, gasLimit = exports.DEFAULT_GAS_LIMIT) {
        const data = {
            gas_state: {
                gas_limit: gasLimit,
                externally_used_gas: 0,
            },
            storage_readonly: false, // allow update
            // wasmer_instance: instance,
        };
        this.backendApi = backendApi;
        this.data = data;
    }
    get storageReadonly() {
        return this.data.storage_readonly;
    }
    set storageReadonly(value) {
        this.data.storage_readonly = value;
    }
    processGasInfo(info) {
        // accumulate externally used gas
        this.data.gas_state.externally_used_gas +=
            info.externally_used + info.cost / exports.GAS_MULTIPLIER;
    }
    get gasUsed() {
        return Math.round(this.data.gas_state.externally_used_gas);
    }
    get gasLimit() {
        return this.data.gas_state.gas_limit;
    }
}
exports.Environment = Environment;
//# sourceMappingURL=environment.js.map