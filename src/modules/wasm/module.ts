import { fromBinary, instantiate2Address } from '@cosmjs/cosmwasm-stargate';
import { Coin } from '@cosmjs/amino';
import { fromBase64, fromHex, toBase64, toBech32 } from '@cosmjs/encoding';
import Immutable, { Map, SortedMap } from '@oraichain/immutable';
import { Err, Ok, Result } from 'ts-results';
import type { CWSimulateApp } from '../../CWSimulateApp';
import { NEVER_IMMUTIFY, Transactional, TransactionalLens } from '../../store/transactional';
import {
  AppResponse,
  CodeInfo,
  CodeInfoResponse,
  ContractInfo,
  ContractInfoResponse,
  DebugLog,
  ExecuteTraceLog,
  ReplyMsg,
  ReplyTraceLog,
  Snapshot,
  TraceLog,
} from '../../types';
import Contract from './contract';
import { buildAppResponse, buildContractAddress, wrapReplyResponse } from './wasm-util';
import {
  Binary,
  BinaryKVIterStorage,
  ContractResponse,
  Env,
  Event,
  ReplyOn,
  SubMsg,
  WasmMsg,
  compare,
} from '@oraichain/cosmwasm-vm-js';

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

export type WasmQuery =
  | {
      smart: SmartQuery;
    }
  | {
      raw: RawQuery;
    }
  | {
      contract_info: ContractInfoQuery;
    }
  | {
      code_info: CodeInfoQuery;
    };

export class WasmModule {
  public static checksumCache: Record<number, string> = {};
  public readonly store: TransactionalLens<WasmData>;

  // TODO: benchmark w/ many coexisting VMs
  private contracts: Record<string, Contract> = {};

  constructor(public readonly chain: CWSimulateApp) {
    this.store = chain.store.db.lens<WasmData>('wasm').initialize({
      lastCodeId: 0,
      lastInstanceId: 0,
      codes: {},
      contracts: {},
      contractStorage: {},
    });
  }

  setContractStorage(contractAddress: string, value: Map<unknown, unknown>) {
    this.store.tx(setter => {
      setter('contractStorage', contractAddress)(value);
      return Ok(undefined);
    });
  }

  getContractStorage(contractAddress: string, storage?: Snapshot) {
    return this.lens(storage).get('contractStorage', contractAddress);
  }

  setCodeInfo(codeId: number, codeInfo: CodeInfo) {
    this.store.tx(setter => {
      setter('codes', codeId)(codeInfo);
      return Ok(undefined);
    });
  }

  forEachCodeInfo(callback: (codeInfo: CodeInfo, codeId: number) => void, storage?: Snapshot) {
    const { data } = this.lens(storage).lens('codes');
    data.forEach((lens, codeId) => {
      const codeInfo: CodeInfo = {
        creator: lens.get('creator') as string,
        wasmCode: lens.get('wasmCode') as Uint8Array,
      };
      callback(codeInfo, Number(codeId));
    });
  }

  getCodeInfo(codeId: number, storage?: Snapshot) {
    const lens = this.lens(storage).lens('codes', codeId);
    if (!lens) return;

    const codeInfo: CodeInfo = {
      creator: lens.get('creator'),
      wasmCode: lens.get('wasmCode'),
    };
    return codeInfo;
  }

  setContractInfo(contractAddress: string, contractInfo: ContractInfo) {
    this.store.tx(setter => {
      setter('contracts', contractAddress)(contractInfo);
      return Ok(undefined);
    });
  }

  getContractInfo(contractAddress: string, storage?: Snapshot) {
    const lens = this.lens(storage).lens('contracts', contractAddress);
    if (!lens?.data) return;
    return lens.data.toObject() as any as ContractInfo;
  }

  /** Store a new CosmWasm smart contract bytecode */
  storeCode(creator: string, wasmCode: Uint8Array) {
    return this.chain.pushBlock(() => {
      return this.store.tx(setter => {
        let codeInfo: CodeInfo = {
          creator,
          wasmCode,
        };

        const codeId = this.lastCodeId + 1;
        this.setCodeInfo(codeId, codeInfo);
        setter('lastCodeId')(codeId);
        return Ok(codeId);
      });
    });
  }

  /** Alias for `storeCode`, except it `.unwrap`s the result - kept for backwards compatibility */
  create(creator: string, wasmCode: Uint8Array): number {
    return this.storeCode(creator, wasmCode).unwrap();
  }

  /** Get the `Env` under which the next execution should run */
  getExecutionEnv(contractAddress: string): Env {
    return {
      block: {
        height: this.chain.height,
        time: this.chain.time.toFixed(),
        chain_id: this.chain.chainId,
      },
      contract: {
        address: contractAddress,
      },
    };
  }

  getContract(address: string) {
    if (!this.contracts[address]) {
      this.contracts[address] = new Contract(this, address);
    }
    return this.contracts[address]!;
  }

  getContracts(): Contract[] {
    return Object.values(this.contracts);
  }

  /** Register a new contract instance from codeId */
  protected registerContractInstance(
    sender: string,
    codeId: number,
    label = '',
    admin: string | null = null,
    salt: Uint8Array | null = null
  ): Result<string, string> {
    return this.store.tx(setter => {
      // if there is salt, using instantiate2Address which does not fixMsg (msg = new Uint8Array())
      const contractAddress =
        salt === null
          ? toBech32(this.chain.bech32Prefix, buildContractAddress(codeId, this.lastInstanceId + 1))
          : instantiate2Address(fromHex(WasmModule.checksumCache[codeId]), sender, salt, this.chain.bech32Prefix);

      const contractInfo = {
        codeId,
        creator: sender,
        admin,
        label,
        created: this.chain.height,
      };

      this.setContractInfo(contractAddress, contractInfo);
      this.setContractStorage(
        contractAddress,
        this.chain.kvIterStorageRegistry === BinaryKVIterStorage ? SortedMap(compare) : Map()
      );

      setter('lastInstanceId')(this.lastInstanceId + 1);
      return Ok(contractAddress);
    });
  }

  async instantiateContract(
    sender: string,
    funds: Coin[],
    codeId: number,
    instantiateMsg: any,
    label: string,
    admin: string | null = null,
    salt: Uint8Array | null = null,
    traces: TraceLog[] = []
  ): Promise<Result<AppResponse, string>> {
    return await this.chain.pushBlock(async () => {
      // first register the contract instance
      const contractAddress = this.registerContractInstance(sender, codeId, label, admin, salt).unwrap();
      let logs = [] as DebugLog[];

      const contract = await this.getContract(contractAddress).init();
      const tracebase: Omit<ExecuteTraceLog, 'response' | 'result'> = {
        [NEVER_IMMUTIFY]: true,
        type: 'instantiate',
        contractAddress,
        msg: instantiateMsg,
        info: { sender, funds },
        logs,
        env: contract.getExecutionEnv(),
        storeSnapshot: this.store.db.data,
      };

      // create bank transfer
      if (funds.length) {
        const send = this.chain.bank.send(sender, contract.address, funds);
        if (send.err) {
          traces.push({
            ...tracebase,
            response: send,
            result: send,
          });
          return send;
        }
      }

      // then call instantiate
      let response = contract.instantiate(sender, funds, instantiateMsg, logs);

      if (response.err) {
        traces.push({
          ...tracebase,
          response,
          result: response,
        });
        return response;
      }
      let customEvent: Event = {
        type: 'instantiate',
        attributes: [
          { key: '_contract_address', value: contractAddress },
          { key: 'code_id', value: codeId.toString() },
        ],
      };

      if (typeof response.val === 'string') {
        throw new Error(response.val.toString());
      }

      let res = buildAppResponse(contractAddress, customEvent, response.val);

      let subtraces: TraceLog[] = [];

      let result = await this.handleContractResponse(contractAddress, response.val.messages, res, subtraces);

      traces.push({
        ...tracebase,
        response,
        result,
        traces: subtraces,
        storeSnapshot: this.store.db.data,
      });

      return result;
    });
  }

  /** Call migrate on the CW SC */
  async migrateContract(
    sender: string,
    newCodeId: number,
    contractAddress: string,
    migrateMsg: any,
    traces: TraceLog[] = []
  ): Promise<Result<AppResponse, string>> {
    return await this.chain.pushBlock(async () => {
      const contract = this.getContract(contractAddress);
      const info = this.getContractInfo(contractAddress);
      if (info === undefined) {
        throw new Error(`Contract ${contractAddress} not found`);
      }
      info.codeId = newCodeId;
      // update contract info
      this.setContractInfo(contractAddress, info);

      // rebuild wasmCode
      const { wasmCode } = this.getCodeInfo(info.codeId);
      await contract.vm.build(wasmCode, WasmModule.checksumCache[info.codeId]);

      const logs: DebugLog[] = [];
      const tracebase: Omit<ExecuteTraceLog, 'response' | 'result'> = {
        [NEVER_IMMUTIFY]: true,
        type: 'migrate',
        contractAddress,
        msg: migrateMsg,
        info: { sender, funds: [] },
        logs,
        env: contract.getExecutionEnv(),
        storeSnapshot: this.store.db.data,
      };

      // then call instantiate
      let response = contract.migrate(migrateMsg, logs);

      if (response.err) {
        traces.push({
          ...tracebase,
          response,
          result: response,
        });
        return response;
      }
      let customEvent: Event = {
        type: 'migrate',
        attributes: [{ key: '_contract_address', value: contractAddress }],
      };

      if (typeof response.val === 'string') {
        throw new Error(response.val.toString());
      }

      let res = buildAppResponse(contractAddress, customEvent, response.val);

      let subtraces: TraceLog[] = [];

      let result = await this.handleContractResponse(contractAddress, response.val.messages, res, subtraces);

      traces.push({
        ...tracebase,
        response,
        result,
        traces: subtraces,
        storeSnapshot: this.store.db.data,
      });

      return result;
    });
  }

  /** Call execute on the CW SC */
  async executeContract(
    sender: string,
    funds: Coin[],
    contractAddress: string,
    executeMsg: any,
    traces: TraceLog[] = []
  ): Promise<Result<AppResponse, string>> {
    return await this.chain.pushBlock(async () => {
      const contract = await this.getContract(contractAddress).init();
      const logs: DebugLog[] = [];

      const tracebase: Omit<ExecuteTraceLog, 'response' | 'result'> = {
        [NEVER_IMMUTIFY]: true,
        type: 'execute',
        contractAddress,
        msg: executeMsg,
        logs,
        env: contract.getExecutionEnv(),
        info: { sender, funds },
        storeSnapshot: this.store.db.data,
      };

      if (funds.length) {
        const send = this.chain.bank.send(sender, contractAddress, funds);
        if (send.err) {
          traces.push({
            ...tracebase,
            response: send,
            result: send,
          });
          return send;
        }
      }

      const response = contract.execute(sender, funds, executeMsg, logs);

      if (response.err) {
        traces.push({
          ...tracebase,
          response,
          result: response,
        });
        return response;
      }
      let customEvent = {
        type: 'execute',
        attributes: [
          {
            key: '_contract_address',
            value: contractAddress,
          },
        ],
      };

      if (typeof response.val === 'string') {
        throw new Error(response.val.toString());
      }

      let res = buildAppResponse(contractAddress, customEvent, response.val);

      let subtraces: TraceLog[] = [];
      let result = await this.handleContractResponse(contractAddress, response.val.messages, res, subtraces);

      traces.push({
        ...tracebase,
        response,
        result,
        traces: subtraces,
        storeSnapshot: this.store.db.data,
      });

      return result;
    });
  }

  // like AppResponse, just extend attribute and process subMsg instead of return Result
  public async handleIbcResponse(
    contractAddress: string,
    res: ContractResponse,
    traces: TraceLog[] = []
  ): Promise<ContractResponse> {
    if (res?.messages) {
      await this.handleContractResponse(contractAddress, res.messages, res, traces);
    }
    return res;
  }

  /** Process contract response & execute (sub)messages */
  protected async handleContractResponse(
    contractAddress: string,
    messages: ContractResponse['messages'],
    res: AppResponse,
    traces: TraceLog[] = []
  ): Promise<Result<AppResponse, string>> {
    for (const message of messages) {
      const subres = await this.handleSubmsg(contractAddress, message, traces);
      if (subres.err) {
        return subres;
      }
      if (typeof subres.val === 'string') {
        throw new Error(subres.val.toString());
      }

      res.events = [...res.events, ...subres.val.events];

      if (subres.val.data !== null) {
        res.data = subres.val.data;
      }
    }

    return Ok({ events: res.events, data: res.data });
  }

  /** Handle a submessage returned in the response of a contract execution */
  protected async handleSubmsg(
    contractAddress: string,
    message: SubMsg,
    traces: TraceLog[] = []
  ): Promise<Result<AppResponse, string>> {
    return this.store.tx(async () => {
      let { id, msg, gas_limit, reply_on } = message;
      let r = await this.chain.handleMsg(contractAddress, msg, traces);

      if (r.ok) {
        // submessage success
        let { events, data } = r.val;

        if (reply_on === ReplyOn.Success || reply_on === ReplyOn.Always) {
          // submessage success, call reply
          let replyMsg: ReplyMsg = {
            id,
            result: {
              ok: {
                events,
                // wrap data reply
                data: wrapReplyResponse(r.val).data,
              },
            },
          };

          let replyRes = await this.reply(contractAddress, replyMsg, traces);
          if (replyRes.err) {
            // submessage success, call reply, reply failed
            return replyRes;
          }
          if (typeof replyRes.val === 'string') {
            throw new Error(replyRes.val.toString());
          }

          // submessage success, call reply, reply success
          if (replyRes.val.data !== null) {
            data = replyRes.val.data;
          }
          events = [...events, ...replyRes.val.events];
        } else {
          // submessage success, don't call reply
          data = null;
        }

        return Ok({ events, data });
      }

      // if panicked then throw Error
      const errMsg = r.val.toString();
      if (errMsg.startsWith('abort: panicked')) {
        throw new Error(errMsg);
      }

      // submessage failed
      if (reply_on === ReplyOn.Error || reply_on === ReplyOn.Always) {
        // submessage failed, call reply
        let replyMsg: ReplyMsg = {
          id,
          result: {
            error: errMsg,
          },
        };

        let replyRes = await this.reply(contractAddress, replyMsg, traces);
        if (replyRes.err) {
          // submessage failed, call reply, reply failed
          return replyRes;
        }
        // submessage failed, call reply, reply success
        let { events, data } = replyRes.val as AppResponse;
        return Ok({ events, data });
      }
      // submessage failed, don't call reply (equivalent to normal message)
      return r;
    });
  }

  protected async reply(
    contractAddress: string,
    replyMsg: ReplyMsg,
    traces: TraceLog[] = []
  ): Promise<Result<AppResponse, string>> {
    const logs: DebugLog[] = [];
    const contract = this.getContract(contractAddress);
    const response = contract.reply(replyMsg, logs);

    const tracebase: Omit<ReplyTraceLog, 'response' | 'result'> = {
      [NEVER_IMMUTIFY]: true,
      type: 'reply',
      contractAddress,
      msg: replyMsg,
      env: contract.getExecutionEnv(),
      logs,
      storeSnapshot: this.store.db.data,
    };

    if (response.err) {
      traces.push({
        ...tracebase,
        response,
        result: response,
      });
      return response;
    }
    const customEvent = {
      type: 'reply',
      attributes: [
        {
          key: '_contract_address',
          value: contractAddress,
        },
        {
          key: 'mode',
          value: 'ok' in replyMsg.result ? 'handle_success' : 'handle_failure',
        },
      ],
    };

    if (response.err || typeof response.val === 'string') {
      throw new Error(response.val.toString());
    }

    let res = buildAppResponse(contractAddress, customEvent, response.val);

    let subtraces: TraceLog[] = [];
    let result = await this.handleContractResponse(contractAddress, response.val.messages, res, subtraces);

    traces.push({
      ...tracebase,
      response,
      result,
      storeSnapshot: this.store.db.data,
    });

    return result;
  }

  query(contractAddress: string, queryMsg: any): Result<any, string> {
    return this.getContract(contractAddress).query(queryMsg);
  }

  queryTrace(trace: TraceLog, queryMsg: any): Result<any, string> {
    let { contractAddress, storeSnapshot } = trace;
    return this.getContract(contractAddress).query(queryMsg, storeSnapshot as Map<string, string>);
  }

  async handleMsg(sender: string, wasmMsg: WasmMsg, traces: TraceLog[] = []): Promise<Result<AppResponse, string>> {
    return this.store.tx(async () => {
      if ('execute' in wasmMsg) {
        const { contract_addr, funds, msg } = wasmMsg.execute;
        return await this.executeContract(sender, funds, contract_addr, fromBinary(msg), traces);
      }
      if ('instantiate' in wasmMsg) {
        const { code_id, funds, msg, label, admin } = wasmMsg.instantiate;
        return await this.instantiateContract(sender, funds, code_id, fromBinary(msg), label, admin, null, traces);
      }
      if ('instantiate2' in wasmMsg) {
        const { code_id, funds, msg, label, admin, salt } = wasmMsg.instantiate2;
        return await this.instantiateContract(
          sender,
          funds,
          code_id,
          fromBinary(msg),
          label,
          admin,
          fromBinary(salt),
          traces
        );
      }
      if ('migrate' in wasmMsg) {
        const { contract_addr, new_code_id, msg } = wasmMsg.migrate;
        return await this.migrateContract(sender, new_code_id, contract_addr, fromBinary(msg), traces);
      }
      throw new Error('Unknown wasm message');
    });
  }

  querySmart(smart: SmartQuery) {
    const { contract_addr, msg } = smart;
    const result = this.query(contract_addr, fromBinary(msg));
    // call query from other contract
    if (result.ok) {
      return result.val;
    }
    // wrap Err message for contract query result
    const errMsg: string = result.val.toString();

    // panic divide by zero should not process in query but return original value
    if (errMsg.startsWith('Divide by zero:')) {
      return '0';
    }

    // TODO: differentiate error between js and contract

    // contract error
    return Err(errMsg);
  }

  queryRaw(raw: RawQuery) {
    const { contract_addr, key } = raw;

    const storage = this.getContractStorage(contract_addr);
    if (!storage) {
      throw new Error(`Contract ${contract_addr} not found`);
    }

    let value: string | undefined;
    // check if storage is BinaryKVIterStorage then key must be Uint8Array
    if (this.chain.kvIterStorageRegistry === BinaryKVIterStorage) {
      // @ts-ignore
      const binaryValue = storage.get(fromBase64(key)) as Uint8Array;
      // if empty than just ignore
      if (binaryValue) value = toBase64(binaryValue);
    } else {
      // @ts-ignore
      value = storage.get(key);
    }

    if (value === undefined) {
      throw new Error(`Key ${key} not found`);
    } else {
      return value;
    }
  }

  queryContractInfo(contractInfo: ContractInfoQuery) {
    const { contract_addr } = contractInfo;
    const info = this.getContractInfo(contract_addr);
    if (info === undefined) {
      throw new Error(`No such contract: ${contract_addr}`);
    }
    const { codeId: code_id, creator, admin } = info;
    const resp: ContractInfoResponse = {
      code_id,
      creator,
      admin,
      ibc_port: this.chain.ibc.getContractIbcPort(contract_addr),
      // TODO: VM lifetime mgmt
      // currently all VMs are always loaded ie pinned
      pinned: true,
    };

    return resp;
  }

  queryCodeInfo(codeInfo: CodeInfoQuery) {
    const { code_id } = codeInfo;
    const info = this.getCodeInfo(code_id);
    if (info === undefined) {
      throw new Error(`No such code: ${code_id}`);
    }

    const { creator } = info;

    const resp: CodeInfoResponse = {
      code_id,
      creator,
      checksum: WasmModule.checksumCache[code_id],
    };
    return resp;
  }

  // should wrap into Querier system error:
  handleQuery(query: WasmQuery) {
    if ('smart' in query) {
      return this.querySmart(query.smart);
    }

    if ('raw' in query) {
      return this.queryRaw(query.raw);
    }

    if ('contract_info' in query) {
      return this.queryContractInfo(query.contract_info);
    }

    if ('code_info' in query) {
      return this.queryCodeInfo(query.code_info);
    }

    throw new Error('Unknown wasm query');
  }

  private lens(storage?: Snapshot) {
    return storage ? lensFromSnapshot(storage) : this.store;
  }

  protected pushTrace(traces: TraceLog[], details: Omit<TraceLog, typeof NEVER_IMMUTIFY | 'env'>) {
    //@ts-ignore
    traces.push({
      [NEVER_IMMUTIFY]: true,
      ...details,
      env: this.getExecutionEnv(details.contractAddress),
    });
  }

  get lastCodeId() {
    return this.store.get('lastCodeId');
  }
  get lastInstanceId() {
    return this.store.get('lastInstanceId');
  }
}

export function lensFromSnapshot(snapshot: Snapshot) {
  return new Transactional(snapshot).lens<WasmData>('wasm');
}
