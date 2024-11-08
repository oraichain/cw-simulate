export interface IGasInfo {
    cost: number;
    externally_used: number;
}
export declare class GasInfo implements IGasInfo {
    cost: number;
    externally_used: number;
    constructor(cost: number, externally_used: number);
    static with_cost(cost: number): IGasInfo;
    static with_externally_used(externally_used: number): IGasInfo;
    static free(): IGasInfo;
}
export interface IBackendApi {
    bech32_prefix: string;
    canonical_address(human: string): Uint8Array;
    human_address(canonical: Uint8Array): string;
    poseidon_hash(left_input: Uint8Array, right_input: Uint8Array, curve: number): Uint8Array;
    curve_hash(input: Uint8Array, curve: number): Uint8Array;
    groth16_verify(input: Uint8Array, proof: Uint8Array, vk: Uint8Array, curve: number): boolean;
    keccak_256(input: Uint8Array): Uint8Array;
    sha256(input: Uint8Array): Uint8Array;
}
export declare const CANONICAL_LENGTH = 64;
export declare const EXCESS_PADDING = 6;
export declare class BasicBackendApi implements IBackendApi {
    bech32_prefix: string;
    constructor(bech32_prefix?: string);
    poseidon_hash(left_input: Uint8Array, right_input: Uint8Array, curve: number): Uint8Array;
    curve_hash(input: Uint8Array, curve: number): Uint8Array;
    groth16_verify(input: Uint8Array, proof: Uint8Array, vk: Uint8Array, curve: number): boolean;
    keccak_256(input: Uint8Array): Uint8Array;
    sha256(input: Uint8Array): Uint8Array;
    canonical_address(human: string): Uint8Array;
    human_address(canonical: Uint8Array): string;
}
//# sourceMappingURL=backendApi.d.ts.map