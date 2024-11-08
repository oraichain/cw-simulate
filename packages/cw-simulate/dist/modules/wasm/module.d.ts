import { Coin } from '@cosmjs/amino';
import Immutable, { Map } from '@oraichain/immutable';
import { Result } from 'ts-results';
import type { CWSimulateApp } from '../../CWSimulateApp';
import { NEVER_IMMUTIFY, TransactionalLens } from '../../store/transactional';
import { AppResponse, CodeInfo, CodeInfoResponse, ContractInfo, ContractInfoResponse, ReplyMsg, Snapshot, TraceLog } from '../../types';
import Contract from './contract';
import { Binary, ContractResponse, Env, SubMsg, WasmMsg } from '@oraichain/cosmwasm-vm-js';
type WasmData = {
    lastCodeId: number;
    lastInstanceId: number;
    codes: Record<number, CodeInfo>;
    contracts: Record<string, ContractInfo>;
    contractStorage: Record<string, Immutable.Map<unknown, unknown>>;
};
export interface SmartQuery {
    contract_addr: string;
    msg: Binary;
}
export interface RawQuery {
    contract_addr: string;
    key: Binary;
}
export interface ContractInfoQuery {
    contract_addr: string;
}
export interface CodeInfoQuery {
    code_id: number;
}
export type WasmQuery = {
    smart: SmartQuery;
} | {
    raw: RawQuery;
} | {
    contract_info: ContractInfoQuery;
} | {
    code_info: CodeInfoQuery;
};
export declare class WasmModule {
    readonly chain: CWSimulateApp;
    static checksumCache: Record<number, string>;
    readonly store: TransactionalLens<WasmData>;
    private contracts;
    constructor(chain: CWSimulateApp);
    setContractStorage(contractAddress: string, value: Map<unknown, unknown>): void;
    getContractStorage(contractAddress: string, storage?: Snapshot): Immutable.Map<keyof Immutable.Map<unknown, unknown>, number | Immutable.Map<never, never>>;
    setCodeInfo(codeId: number, codeInfo: CodeInfo): void;
    forEachCodeInfo(callback: (codeInfo: CodeInfo, codeId: number) => void, storage?: Snapshot): void;
    getCodeInfo(codeId: number, storage?: Snapshot): CodeInfo;
    setContractInfo(contractAddress: string, contractInfo: ContractInfo): void;
    getContractInfo(contractAddress: string, storage?: Snapshot): ContractInfo;
    /** Store a new CosmWasm smart contract bytecode */
    storeCode(creator: string, wasmCode: Uint8Array): Result<number, string>;
    /** Alias for `storeCode`, except it `.unwrap`s the result - kept for backwards compatibility */
    create(creator: string, wasmCode: Uint8Array): number;
    /** Get the `Env` under which the next execution should run */
    getExecutionEnv(contractAddress: string): Env;
    getContract(address: string): Contract;
    getContracts(): Contract[];
    /** Register a new contract instance from codeId */
    protected registerContractInstance(sender: string, codeId: number, label?: string, admin?: string | null, salt?: Uint8Array | null): Result<string, string>;
    instantiateContract(sender: string, funds: Coin[], codeId: number, instantiateMsg: any, label: string, admin?: string | null, salt?: Uint8Array | null, traces?: TraceLog[], sameBlock?: boolean): Promise<Result<AppResponse, string>>;
    /** Call migrate on the CW SC */
    migrateContract(sender: string, newCodeId: number, contractAddress: string, migrateMsg: any, traces?: TraceLog[], sameBlock?: boolean): Promise<Result<AppResponse, string>>;
    /** Call execute on the CW SC */
    executeContract(sender: string, funds: Coin[], contractAddress: string, executeMsg: any, traces?: TraceLog[], sameBlock?: boolean): Promise<Result<AppResponse, string>>;
    handleIbcResponse(contractAddress: string, res: ContractResponse, traces?: TraceLog[]): Promise<ContractResponse>;
    /** Process contract response & execute (sub)messages */
    protected handleContractResponse(contractAddress: string, messages: ContractResponse['messages'], res: AppResponse, traces?: TraceLog[]): Promise<Result<AppResponse, string>>;
    /** Handle a submessage returned in the response of a contract execution */
    protected handleSubmsg(contractAddress: string, message: SubMsg, traces?: TraceLog[]): Promise<Result<AppResponse, string>>;
    protected reply(contractAddress: string, replyMsg: ReplyMsg, traces?: TraceLog[]): Promise<Result<AppResponse, string>>;
    query(contractAddress: string, queryMsg: any): Result<any, string>;
    queryTrace(trace: TraceLog, queryMsg: any): Result<any, string>;
    handleMsg(sender: string, wasmMsg: WasmMsg, traces?: TraceLog[]): Promise<Result<AppResponse, string>>;
    querySmart(smart: SmartQuery): any;
    queryRaw(raw: RawQuery): string;
    queryContractInfo(contractInfo: ContractInfoQuery): ContractInfoResponse;
    queryCodeInfo(codeInfo: CodeInfoQuery): CodeInfoResponse;
    handleQuery(query: WasmQuery): any;
    private lens;
    protected pushTrace(traces: TraceLog[], details: Omit<TraceLog, typeof NEVER_IMMUTIFY | 'env'>): void;
    get lastCodeId(): number;
    get lastInstanceId(): number;
}
export declare function lensFromSnapshot(snapshot: Snapshot): TransactionalLens<WasmData>;
export {};
//# sourceMappingURL=module.d.ts.map