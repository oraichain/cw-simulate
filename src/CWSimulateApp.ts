import {
  BasicBackendApi,
  CosmosMsg,
  Environment,
  IBackendApi,
  QuerierBase,
  BasicKVIterStorage,
  BinaryKVIterStorage,
  compare,
  Binary,
} from '@oraichain/cosmwasm-vm-js';
import { Err, Ok, Result } from 'ts-results';
import { WasmModule, WasmQuery } from './modules/wasm';
import { BankModule, BankQuery } from './modules/bank';
import { Transactional, TransactionalLens } from './store/transactional';
import { AppResponse, DistributionQuery, IbcQuery, StakingQuery, TraceLog } from './types';
import { SERDE } from '@kiruse/serde';
import { IbcModule } from './modules/ibc';
import { DebugFunction } from './instrumentation/CWSimulateVMInstance';
import { printDebug } from './util';
import { Map, SortedMap } from '@oraichain/immutable';

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

export class CWSimulateApp {
  [SERDE] = 'cw-simulate-app' as const;
  public chainId: string;
  public bech32Prefix: string;
  public backendApi: IBackendApi;
  public debug?: DebugFunction;
  public readonly env?: Environment;
  private readonly handleCustomMsg?: HandleCustomMsgFunction; // make sure can not re-assign it
  public readonly queryCustomMsg?: QueryCustomMsgFunction; // make sure can not re-assign it
  public store: TransactionalLens<ChainData>;
  public readonly kvIterStorageRegistry: KVIterStorageRegistry;

  public wasm: WasmModule;
  public bank: BankModule;
  public ibc: IbcModule;
  public querier: Querier;

  constructor(options: CWSimulateAppOptions) {
    this.chainId = options.chainId;
    this.bech32Prefix = options.bech32Prefix;
    this.backendApi = options.backendApi ?? new BasicBackendApi(this.bech32Prefix);
    if (options.metering) {
      this.env = new Environment(this.backendApi, options.gasLimit);
    }

    this.kvIterStorageRegistry = options.kvIterStorageRegistry ?? BinaryKVIterStorage;

    this.debug = options.debug ?? printDebug;
    this.handleCustomMsg = options.handleCustomMsg;
    this.queryCustomMsg = options.queryCustomMsg;
    this.store = new Transactional(this.kvIterStorageRegistry === BinaryKVIterStorage ? SortedMap(compare) : Map())
      .lens<ChainData>()
      .initialize({
        height: 1,
        time: Date.now() * 1e6,
      });

    this.wasm = new WasmModule(this);
    this.bank = new BankModule(this);
    this.ibc = new IbcModule(this);
    this.querier = new Querier(this);
  }

  public get gasUsed() {
    return this.env?.gasUsed ?? 0;
  }

  public get gasLimit() {
    return this.env?.gasLimit ?? 0;
  }

  public async handleMsg(
    sender: string,
    msg: CosmosMsg,
    traces: TraceLog[] = []
  ): Promise<Result<AppResponse, string>> {
    if ('wasm' in msg) {
      return await this.wasm.handleMsg(sender, msg.wasm, traces);
    }
    if ('bank' in msg) {
      return await this.bank.handleMsg(sender, msg.bank);
    }
    if ('ibc' in msg) {
      return await this.ibc.handleMsg(sender, msg.ibc);
    }
    // not yet implemented, so use custom fallback assignment
    if ('stargate' in msg || 'custom' in msg || 'gov' in msg || 'staking' in msg || 'distribution' in msg) {
      // make default response to keep app working
      if (!this.handleCustomMsg) return Err(`no custom handle found for: ${Object.keys(msg)[0]}`);
      return await this.handleCustomMsg(sender, msg);
    }

    return Err(`unknown message: ${JSON.stringify(msg)}`);
  }

  public pushBlock<T>(callback: () => Result<T, string>, sameBlock: boolean): Result<T, string>;
  public pushBlock<T>(callback: () => Promise<Result<T, string>>, sameBlock: boolean): Promise<Result<T, string>>;
  public pushBlock<T>(
    callback: () => Result<T, string> | Promise<Result<T, string>>,
    sameBlock: boolean
  ): Result<T, string> | Promise<Result<T, string>> {
    //@ts-ignore
    return this.store.tx(setter => {
      // increase block height and time if new block
      if (!sameBlock) {
        setter('height')(this.height + 1);
        // if height or time are alredy increased, we will wait for it, this will help simulating future moment
        const current = Date.now() * 1e6;
        if (this.time < current) {
          setter('time')(current); // 1 millisecond = 1e6 nano seconds
        }
      }
      return callback();
    });
  }

  get height() {
    return this.store.get('height');
  }
  get time() {
    return this.store.get('time');
  }
  set time(nanoSeconds: number) {
    this.store.tx(setter => Ok(setter('time')(nanoSeconds)));
  }
  set height(blockHeight: number) {
    this.store.tx(setter => Ok(setter('height')(blockHeight)));
  }
}

export type QueryMessage<T = any> =
  | { bank: BankQuery }
  | { wasm: WasmQuery }
  | { custom: T }
  | { staking: StakingQuery }
  | { distribution: DistributionQuery }
  | {
      stargate: {
        path: string;
        /// this is the expected protobuf message type (not any), binary encoded
        data: Binary;
      };
    }
  | { ibc: IbcQuery }
  | {
      grpc: {
        path: string;
        /// The expected protobuf message type (not [Any](https://protobuf.dev/programming-guides/proto3/#any)), binary encoded
        data: Binary;
      };
    };

export class Querier extends QuerierBase {
  constructor(public readonly app: CWSimulateApp) {
    super();
  }

  handleQuery(query: QueryMessage): any {
    if ('bank' in query) {
      return this.app.bank.handleQuery(query.bank);
    }
    if ('wasm' in query) {
      return this.app.wasm.handleQuery(query.wasm);
    }
    if (
      this.app.queryCustomMsg &&
      ('stargate' in query ||
        'custom' in query ||
        'staking' in query ||
        'ibc' in query ||
        'distribution' in query ||
        'grpc' in query)
    ) {
      // make default response to keep app working
      if (!this.app.queryCustomMsg) return Err(`no custom query found for: ${Object.keys(query)[0]}`);
      return this.app.queryCustomMsg(query);
    }

    // not yet implemented, so use custom fallback assignment
    throw new Error('Unknown query message');
  }
}
