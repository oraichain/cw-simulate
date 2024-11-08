import { CosmosMsg, Environment, IBackendApi, QuerierBase, BasicKVIterStorage, BinaryKVIterStorage, Binary } from '@oraichain/cosmwasm-vm-js';
import { Result } from 'ts-results';
import { WasmModule, WasmQuery } from './modules/wasm';
import { BankModule, BankQuery } from './modules/bank';
import { TransactionalLens } from './store/transactional';
import { AppResponse, DistributionQuery, IbcQuery, StakingQuery, TraceLog } from './types';
import { SERDE } from '@kiruse/serde';
import { IbcModule } from './modules/ibc';
import { DebugFunction } from './instrumentation/CWSimulateVMInstance';
export type HandleCustomMsgFunction = (sender: string, msg: CosmosMsg) => Promise<Result<AppResponse, string>>;
export type QueryCustomMsgFunction = (query: QueryMessage) => any;
export type KVIterStorageRegistry = typeof BasicKVIterStorage | typeof BinaryKVIterStorage;
export interface CWSimulateAppOptions {
    chainId: string;
    bech32Prefix: string;
    backendApi?: IBackendApi;
    metering?: boolean;
    gasLimit?: number;
    debug?: DebugFunction;
    handleCustomMsg?: HandleCustomMsgFunction;
    queryCustomMsg?: QueryCustomMsgFunction;
    kvIterStorageRegistry?: KVIterStorageRegistry;
}
export type ChainData = {
    height: number;
    time: number;
};
export declare class CWSimulateApp {
    [SERDE]: "cw-simulate-app";
    chainId: string;
    bech32Prefix: string;
    backendApi: IBackendApi;
    debug?: DebugFunction;
    readonly env?: Environment;
    private readonly handleCustomMsg?;
    readonly queryCustomMsg?: QueryCustomMsgFunction;
    store: TransactionalLens<ChainData>;
    readonly kvIterStorageRegistry: KVIterStorageRegistry;
    wasm: WasmModule;
    bank: BankModule;
    ibc: IbcModule;
    querier: Querier;
    constructor(options: CWSimulateAppOptions);
    get gasUsed(): number;
    get gasLimit(): number;
    handleMsg(sender: string, msg: CosmosMsg, traces?: TraceLog[]): Promise<Result<AppResponse, string>>;
    pushBlock<T>(callback: () => Result<T, string>, sameBlock: boolean): Result<T, string>;
    pushBlock<T>(callback: () => Promise<Result<T, string>>, sameBlock: boolean): Promise<Result<T, string>>;
    get height(): number;
    get time(): number;
    set time(nanoSeconds: number);
    set height(blockHeight: number);
}
export type QueryMessage<T = any> = {
    bank: BankQuery;
} | {
    wasm: WasmQuery;
} | {
    custom: T;
} | {
    staking: StakingQuery;
} | {
    distribution: DistributionQuery;
} | {
    stargate: {
        path: string;
        data: Binary;
    };
} | {
    ibc: IbcQuery;
} | {
    grpc: {
        path: string;
        data: Binary;
    };
};
export declare class Querier extends QuerierBase {
    readonly app: CWSimulateApp;
    constructor(app: CWSimulateApp);
    handleQuery(query: QueryMessage): any;
}
//# sourceMappingURL=CWSimulateApp.d.ts.map