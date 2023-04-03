import {
  SigningCosmWasmClient,
  ExecuteResult,
  InstantiateOptions,
  InstantiateResult,
  JsonObject,
  UploadResult,
} from '@cosmjs/cosmwasm-stargate';
import { CWSimulateApp, CWSimulateAppOptions } from './CWSimulateApp';
import { sha256 } from '@cosmjs/crypto';
import { toHex } from '@cosmjs/encoding';
import { Coin, StdFee } from '@cosmjs/amino';

export class SimulateCosmWasmClient extends SigningCosmWasmClient {
  private readonly app: CWSimulateApp;

  public constructor(option: CWSimulateAppOptions) {
    super(null, null, {});
    this.app = new CWSimulateApp(option);
  }

  public setBalance(address: string, amount: Coin[]) {
    return this.app.bank.setBalance(address, amount);
  }

  public getBalance(address: string, searchDenom: string): Promise<Coin> {
    const coin = this.app.bank.getBalance(address).find(coin => coin.denom === searchDenom);
    return Promise.resolve(coin);
  }

  public upload(
    senderAddress: string,
    wasmCode: Uint8Array,
    _fee: StdFee | 'auto' | number,
    _memo?: string
  ): Promise<UploadResult> {
    // import the wasm bytecode
    const originalChecksum = toHex(sha256(wasmCode));
    const codeId = this.app.wasm.create(senderAddress, wasmCode);
    return Promise.resolve({
      originalSize: wasmCode.length,
      originalChecksum: toHex(sha256(wasmCode)),
      compressedSize: wasmCode.length,
      compressedChecksum: originalChecksum,
      codeId,
      logs: [],
      height: this.app.height,
      transactionHash: '',
      events: [],
      gasWanted: 0,
      gasUsed: 0,
    });
  }

  public async instantiate(
    senderAddress: string,
    codeId: number,
    msg: JsonObject,
    label: string,
    _fee: StdFee | 'auto' | number,
    options?: InstantiateOptions
  ): Promise<InstantiateResult> {
    // instantiate the contract
    const result = (
      await this.app.wasm.instantiateContract(senderAddress, (options?.funds as Coin[]) ?? [], codeId, msg, label)
    ).val;
    if (typeof result === 'string') {
      throw new Error(result);
    }

    // pull out the contract address
    const contractAddress = result.events[0].attributes[0].value;
    return {
      contractAddress,
      logs: [],
      height: this.app.height,
      transactionHash: '',
      events: result.events,
      gasWanted: 0,
      gasUsed: 0,
    };
  }

  // keep the same interface so that we can switch to real environment
  public async execute(
    senderAddress: string,
    contractAddress: string,
    msg: JsonObject,
    _fee: StdFee | 'auto' | number,
    _memo?: string,
    funds?: readonly Coin[]
  ): Promise<ExecuteResult> {
    const result = (await this.app.wasm.executeContract(senderAddress, (funds as Coin[]) ?? [], contractAddress, msg))
      .val;

    if (typeof result === 'string') {
      throw new Error(result);
    }

    return {
      logs: [],
      height: this.app.height,
      transactionHash: '',
      events: result.events,
      gasWanted: 0,
      gasUsed: 0,
    };
  }

  public async queryContractSmart(contractAddress: string, queryMsg: JsonObject): Promise<JsonObject> {
    const result = this.app.wasm.query(contractAddress, queryMsg);
    return result.val;
  }
}
