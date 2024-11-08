import { GasInfo, IBackendApi } from './backend';
export interface IEnvironment {
    processGasInfo(info: GasInfo): void;
}
export declare const GAS_PER_OP = 150000;
export declare const GAS_MULTIPLIER = 14000000;
export declare const GAS_PER_US = 1000000000;
export declare const DEFAULT_GAS_LIMIT = 1000000000000;
export interface GasState {
    gas_limit: number;
    externally_used_gas: number;
}
export interface ContextData {
    gas_state: GasState;
    storage_readonly: boolean;
}
export declare class Environment {
    backendApi: IBackendApi;
    data: ContextData;
    static gasConfig: {
        secp256k1_verify_cost: number;
        groth16_verify_cost: number;
        poseidon_hash_cost: number;
        keccak_256_cost: number;
        sha256_cost: number;
        curve_hash_cost: number;
        secp256k1_recover_pubkey_cost: number;
        ed25519_verify_cost: number;
        ed25519_batch_verify_cost: number;
        ed25519_batch_verify_one_pubkey_cost: number;
    };
    constructor(backendApi: IBackendApi, gasLimit?: number);
    get storageReadonly(): boolean;
    set storageReadonly(value: boolean);
    processGasInfo(info: GasInfo): void;
    get gasUsed(): number;
    get gasLimit(): number;
}
//# sourceMappingURL=environment.d.ts.map