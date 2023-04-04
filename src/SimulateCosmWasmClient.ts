import {
  SigningCosmWasmClient,
  ExecuteResult,
  InstantiateOptions,
  InstantiateResult,
  JsonObject,
  UploadResult,
  DeliverTxResponse,
} from '@cosmjs/cosmwasm-stargate';
import { CWSimulateApp, CWSimulateAppOptions } from './CWSimulateApp';
import { sha256 } from '@cosmjs/crypto';
import { toHex } from '@cosmjs/encoding';
import { Coin, StdFee } from '@cosmjs/amino';

export class SimulateCosmWasmClient extends SigningCosmWasmClient {
  private readonly app: CWSimulateApp;
  public constructor(appOrOptions: CWSimulateApp | CWSimulateAppOptions) {
    super(null, null, {});
    if (appOrOptions instanceof CWSimulateApp) {
      this.app = appOrOptions;
    } else {
      this.app = new CWSimulateApp(appOrOptions);
    }
  }

  public sendTokens(
    senderAddress: string,
    recipientAddress: string,
    amount: readonly Coin[],
    _fee: StdFee | 'auto' | number,
    _memo?: string
  ): Promise<DeliverTxResponse> {
    const res = this.app.bank.send(senderAddress, recipientAddress, (amount as Coin[]) ?? []);
    return Promise.resolve({
      height: this.app.height,
      txIndex: 0,
      code: res.ok ? 0 : 1,
      transactionHash: '',
      events: [],
      rawLog: typeof res.val === 'string' ? res.val : undefined,
      gasUsed: 0,
      gasWanted: 0,
    });
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
    const result = await this.app.wasm.instantiateContract(
      senderAddress,
      (options?.funds as Coin[]) ?? [],
      codeId,
      msg,
      label
    );

    if (result.err || typeof result.val === 'string') {
      throw new Error(result.val.toString());
    }

    // pull out the contract address
    const contractAddress = result.val.events[0].attributes[0].value;
    return {
      contractAddress,
      logs: [],
      height: this.app.height,
      transactionHash: '',
      events: result.val.events,
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
    const result = await this.app.wasm.executeContract(senderAddress, (funds as Coin[]) ?? [], contractAddress, msg);

    if (result.err || typeof result.val === 'string') {
      throw new Error(result.val.toString());
    }

    return {
      logs: [],
      height: this.app.height,
      transactionHash: '',
      events: result.val.events,
      gasWanted: 0,
      gasUsed: 0,
    };
  }

  public async queryContractSmart(contractAddress: string, queryMsg: JsonObject): Promise<JsonObject> {
    const result = this.app.wasm.query(contractAddress, queryMsg);
    // check is ok or err
    return result.ok ? Promise.resolve(result.val) : Promise.reject(new Error(result.val));
  }
}
