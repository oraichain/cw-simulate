import { GasInfo, IBackendApi } from './backend';

export interface IEnvironment {
  processGasInfo(info: GasInfo): void;
}

export const GAS_PER_OP = 150_000;
export const GAS_MULTIPLIER = 14_000_000; // convert to chain gas
export const GAS_PER_US = 1_000_000_000;

export const DEFAULT_GAS_LIMIT = 1_000_000_000_000; // ~1ms

export interface GasState {
  gas_limit: number;
  externally_used_gas: number;
}

export interface ContextData {
  gas_state: GasState;
  storage_readonly: boolean;
  // wasmer_instance: any;
}

export class Environment {
  public backendApi: IBackendApi;
  public data: ContextData;
  public static gasConfig = {
    // ~154 us in crypto benchmarks
    secp256k1_verify_cost: 154 * GAS_PER_US,

    // ~6920 us in crypto benchmarks
    groth16_verify_cost: 6920 * GAS_PER_US,

    // ~43 us in crypto benchmarks
    poseidon_hash_cost: 43 * GAS_PER_US,

    // ~480 ns ~ 0.5 in crypto benchmarks
    keccak_256_cost: GAS_PER_US / 2,

    // ~968 ns ~ 1 us in crypto benchmarks
    sha256_cost: GAS_PER_US,

    // ~920 ns ~ 1 us in crypto benchmarks
    curve_hash_cost: GAS_PER_US,

    // ~162 us in crypto benchmarks
    secp256k1_recover_pubkey_cost: 162 * GAS_PER_US,
    // ~63 us in crypto benchmarks
    ed25519_verify_cost: 63 * GAS_PER_US,
    // Gas cost factors, relative to ed25519_verify cost
    // From https://docs.rs/ed25519-zebra/2.2.0/ed25519_zebra/batch/index.html
    ed25519_batch_verify_cost: (63 * GAS_PER_US) / 2,
    ed25519_batch_verify_one_pubkey_cost: (63 * GAS_PER_US) / 4,
  };

  constructor(backendApi: IBackendApi, gasLimit: number = DEFAULT_GAS_LIMIT) {
    const data: ContextData = {
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

  public get storageReadonly(): boolean {
    return this.data.storage_readonly;
  }

  public set storageReadonly(value: boolean) {
    this.data.storage_readonly = value;
  }

  public processGasInfo(info: GasInfo) {
    // accumulate externally used gas
    this.data.gas_state.externally_used_gas +=
      info.externally_used + info.cost / GAS_MULTIPLIER;
  }

  public get gasUsed() {
    return Math.round(this.data.gas_state.externally_used_gas);
  }

  public get gasLimit() {
    return this.data.gas_state.gas_limit;
  }
}
