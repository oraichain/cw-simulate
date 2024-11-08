import { SigningCosmWasmClient, ExecuteResult, InstantiateOptions, InstantiateResult, JsonObject, UploadResult, DeliverTxResponse, Contract, CodeDetails, Code, ExecuteInstruction, MigrateResult } from '@cosmjs/cosmwasm-stargate';
import { Account, SequenceResponse, Block } from '@cosmjs/stargate';
import { CWSimulateApp, CWSimulateAppOptions } from './CWSimulateApp';
import { Coin, StdFee } from '@cosmjs/amino';
import { ContractInfo } from './types';
export declare class SimulateCosmWasmClient extends SigningCosmWasmClient {
    static from(bytes: Uint8Array | Buffer): Promise<SimulateCosmWasmClient>;
    readonly app: CWSimulateApp;
    constructor(appOrOptions: CWSimulateApp | CWSimulateAppOptions);
    toBytes(): Uint8Array;
    loadContract(address: string, info: ContractInfo, data: any): Promise<void>;
    getChainId(): Promise<string>;
    getHeight(): Promise<number>;
    getAccount(searchAddress: string): Promise<Account | null>;
    getSequence(_address: string): Promise<SequenceResponse>;
    getBlock(height?: number): Promise<Block>;
    getBalance(address: string, searchDenom: string): Promise<Coin>;
    getCodes(): Promise<readonly Code[]>;
    getCodeDetails(codeId: number): Promise<CodeDetails>;
    getContract(address: string): Promise<Contract>;
    sendTokens(senderAddress: string, recipientAddress: string, amount: readonly Coin[], _fee: StdFee | 'auto' | number, _memo?: string): Promise<DeliverTxResponse>;
    upload(senderAddress: string, wasmCode: Uint8Array, _fee: StdFee | 'auto' | number, _memo?: string): Promise<UploadResult>;
    _instantiate(senderAddress: string, codeId: number, msg: JsonObject, label: string, salt?: Uint8Array | null, options?: InstantiateOptions): Promise<InstantiateResult>;
    instantiate(senderAddress: string, codeId: number, msg: JsonObject, label: string, _fee?: StdFee | 'auto' | number, options?: InstantiateOptions): Promise<InstantiateResult>;
    instantiate2(senderAddress: string, codeId: number, salt: Uint8Array, msg: JsonObject, label: string, _fee: StdFee | 'auto' | number, options?: InstantiateOptions): Promise<InstantiateResult>;
    /**
     * Like `execute` but allows executing multiple messages in one transaction.
     */
    executeMultiple(senderAddress: string, instructions: readonly ExecuteInstruction[], _fee: StdFee | 'auto' | number, _memo?: string): Promise<ExecuteResult>;
    execute(senderAddress: string, contractAddress: string, msg: JsonObject, fee: StdFee | 'auto' | number, memo?: string, funds?: readonly Coin[]): Promise<ExecuteResult>;
    migrate(senderAddress: string, contractAddress: string, codeId: number, migrateMsg: JsonObject, _fee: StdFee | 'auto' | number, _memo?: string): Promise<MigrateResult>;
    queryContractRaw(address: string, key: Uint8Array): Promise<Uint8Array | null>;
    queryContractSmart(address: string, queryMsg: JsonObject): Promise<JsonObject>;
}
//# sourceMappingURL=SimulateCosmWasmClient.d.ts.map