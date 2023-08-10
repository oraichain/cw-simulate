import {
  SigningCosmWasmClient,
  ExecuteResult,
  InstantiateOptions,
  InstantiateResult,
  JsonObject,
  UploadResult,
  DeliverTxResponse,
  toBinary,
  Contract,
  CodeDetails,
  Code,
  ExecuteInstruction,
  MigrateResult,
} from '@cosmjs/cosmwasm-stargate';
import { Account, SequenceResponse, Block } from '@cosmjs/stargate';
import { CWSimulateApp, CWSimulateAppOptions } from './CWSimulateApp';
import { sha256 } from '@cosmjs/crypto';
import { fromBase64, toHex } from '@cosmjs/encoding';
import { Map as ImmutableMap, SortedMap, isMap } from '@oraichain/immutable';
import { Coin, StdFee } from '@cosmjs/amino';
import { load, save } from './persist';
import { getTransactionHash } from './util';
import { ContractInfo } from './types';
import { BinaryKVIterStorage } from '@oraichain/cosmwasm-vm-js';

export class SimulateCosmWasmClient extends SigningCosmWasmClient {
  private static checksumCache = new Map();

  // deserialize from bytes
  public static async from(bytes: Uint8Array | Buffer): Promise<SimulateCosmWasmClient> {
    const app = await load(Uint8Array.from(bytes));
    return new SimulateCosmWasmClient(app);
  }

  public readonly app: CWSimulateApp;
  public constructor(appOrOptions: CWSimulateApp | CWSimulateAppOptions) {
    super(null, null, {});
    if (appOrOptions instanceof CWSimulateApp) {
      this.app = appOrOptions;
    } else {
      this.app = new CWSimulateApp(appOrOptions);
    }
  }

  // serialize to bytes
  public toBytes(): Uint8Array {
    return save(this.app);
  }

  public async loadContract(address: string, info: ContractInfo, data: any) {
    this.app.wasm.setContractInfo(address, info);
    this.app.wasm.setContractStorage(
      address,
      isMap(data) ? data : this.app.kvIterStorageRegistry === BinaryKVIterStorage ? SortedMap(data) : ImmutableMap(data)
    );
    await this.app.wasm.getContract(address).init();
  }

  public getChainId(): Promise<string> {
    return Promise.resolve(this.app.chainId);
  }
  public getHeight(): Promise<number> {
    return Promise.resolve(this.app.height);
  }
  public getAccount(searchAddress: string): Promise<Account | null> {
    return Promise.resolve({
      address: searchAddress,
      pubkey: null,
      accountNumber: 0,
      sequence: 0,
    });
  }
  public getSequence(_address: string): Promise<SequenceResponse> {
    return Promise.resolve({
      accountNumber: 0,
      sequence: 0,
    });
  }

  public getBlock(height?: number): Promise<Block> {
    return Promise.resolve({
      id: '',
      header: {
        version: {
          app: 'simulate',
          block: 'simulate',
        },
        height: height,
        chainId: this.app.chainId,
        time: new Date().toString(),
      },
      txs: [],
    });
  }
  public getBalance(address: string, searchDenom: string): Promise<Coin> {
    // default return zero balance
    const coin = this.app.bank.getBalance(address).find(coin => coin.denom === searchDenom) ?? {
      denom: searchDenom,
      amount: '0',
    };
    return Promise.resolve(coin);
  }

  getCodes(): Promise<readonly Code[]> {
    const codes: Code[] = [];
    this.app.wasm.forEachCodeInfo((codeInfo, codeId) => {
      codes.push({
        id: codeId,
        creator: codeInfo.creator,
        checksum: SimulateCosmWasmClient.checksumCache.get(codeId),
      });
    });

    return Promise.resolve(codes);
  }

  public getCodeDetails(codeId: number): Promise<CodeDetails> {
    const codeInfo = this.app.wasm.getCodeInfo(codeId);
    const codeDetails = {
      id: codeId,
      creator: codeInfo.creator,
      checksum: SimulateCosmWasmClient.checksumCache.get(codeId),
      data: codeInfo.wasmCode,
    };
    return Promise.resolve(codeDetails);
  }

  public getContract(address: string): Promise<Contract> {
    const contract = this.app.wasm.getContractInfo(address);

    return Promise.resolve({
      address,
      codeId: contract.codeId,
      creator: contract.creator,
      admin: contract.admin,
      label: contract.label,
      ibcPortId: undefined,
    });
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
      transactionHash: getTransactionHash(this.app.height, res),
      events: [],
      rawLog: typeof res.val === 'string' ? res.val : undefined,
      gasUsed: 66_000,
      gasWanted: this.app.gasLimit,
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
    SimulateCosmWasmClient.checksumCache.set(codeId, originalChecksum);
    return Promise.resolve({
      originalSize: wasmCode.length,
      originalChecksum,
      compressedSize: wasmCode.length,
      compressedChecksum: originalChecksum,
      codeId,
      logs: [],
      height: this.app.height,
      transactionHash: getTransactionHash(this.app.height, originalChecksum),
      events: [],
      gasWanted: this.app.gasLimit,
      gasUsed: wasmCode.length * 10,
    });
  }

  public async instantiate(
    senderAddress: string,
    codeId: number,
    msg: JsonObject,
    label: string,
    _fee?: StdFee | 'auto' | number,
    options?: InstantiateOptions
  ): Promise<InstantiateResult> {
    // instantiate the contract
    const contractGasUsed = this.app.gasUsed;
    // pass checksum to cache build
    const result = await this.app.wasm.instantiateContract(
      senderAddress,
      (options?.funds as Coin[]) ?? [],
      codeId,
      msg,
      label,
      options?.admin,
      undefined,
      SimulateCosmWasmClient.checksumCache.get(codeId)
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
      transactionHash: getTransactionHash(this.app.height, result),
      events: result.val.events,
      gasWanted: this.app.gasLimit,
      gasUsed: this.app.gasUsed - contractGasUsed,
    };
  }

  /**
   * Like `execute` but allows executing multiple messages in one transaction.
   */
  public async executeMultiple(
    senderAddress: string,
    instructions: readonly ExecuteInstruction[],
    _fee: StdFee | 'auto' | number,
    _memo?: string
  ): Promise<ExecuteResult> {
    const events = [];
    const contractGasUsed = this.app.gasUsed;
    const results = await Promise.all(
      instructions.map(({ contractAddress, funds, msg }) =>
        this.app.wasm.executeContract(senderAddress, (funds as Coin[]) ?? [], contractAddress, msg)
      )
    );

    for (const result of results) {
      if (result.err || typeof result.val === 'string') {
        throw new Error(result.val.toString());
      }
      events.push(...result.val.events);
    }

    return {
      logs: [],
      height: this.app.height,
      transactionHash: getTransactionHash(this.app.height, results),
      events,
      gasWanted: this.app.gasLimit,
      gasUsed: this.app.gasUsed - contractGasUsed,
    };
  }

  // keep the same interface so that we can switch to real environment
  public async execute(
    senderAddress: string,
    contractAddress: string,
    msg: JsonObject,
    fee: StdFee | 'auto' | number,
    memo?: string,
    funds?: readonly Coin[]
  ): Promise<ExecuteResult> {
    return this.executeMultiple(
      senderAddress,
      [
        {
          contractAddress,
          msg,
          funds,
        },
      ],
      fee,
      memo
    );
  }

  public async migrate(
    senderAddress: string,
    contractAddress: string,
    codeId: number,
    migrateMsg: JsonObject,
    _fee: StdFee | 'auto' | number,
    _memo?: string
  ): Promise<MigrateResult> {
    // only admin can migrate the contract

    const { admin } = this.app.wasm.getContractInfo(contractAddress);

    if (admin !== senderAddress) {
      throw new Error('unauthorized: can not migrate');
    }

    const contractGasUsed = this.app.gasUsed;

    const result = await this.app.wasm.migrateContract(senderAddress, codeId, contractAddress, migrateMsg);

    if (result.err || typeof result.val === 'string') {
      throw new Error(result.val.toString());
    }

    return {
      logs: [],
      height: this.app.height,
      transactionHash: getTransactionHash(this.app.height, result),
      events: result.val.events,
      gasWanted: this.app.gasLimit,
      gasUsed: this.app.gasUsed - contractGasUsed,
    };
  }

  public async queryContractRaw(address: string, key: Uint8Array): Promise<Uint8Array | null> {
    const result = this.app.wasm.handleQuery({ raw: { contract_addr: address, key: toBinary(key) } });
    return Promise.resolve(fromBase64(toBinary({ ok: result })));
  }

  public async queryContractSmart(address: string, queryMsg: JsonObject): Promise<JsonObject> {
    const result = this.app.wasm.query(address, queryMsg);
    // check is ok or err
    return result.ok ? Promise.resolve(result.val) : Promise.reject(new Error(result.val));
  }
}
