import { Sha256 } from '@cosmjs/crypto';
import { fromAscii, fromBase64, fromUtf8, toBech32 } from '@cosmjs/encoding';
import { CWSimulateApp } from 'CWSimulateApp';
import {
  BasicBackendApi,
  BasicKVIterStorage,
  BasicQuerier,
  IBackend,
  VMInstance,
} from '@terran-one/cosmwasm-vm-js';
import { ContractResponse, SubMsg } from '../cw-interface';
import { Result, Ok, Err } from 'ts-results';

export interface AppResponse {
  events: any[];
  data: string | null;
}

function numberToBigEndianUint64(n: number): Uint8Array {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setUint32(0, n, false);
  view.setUint32(4, 0, false);
  return new Uint8Array(buffer);
}

export interface Coin {
  denom: string;
  amount: string;
}

export interface Execute {
  contract_addr: String;
  msg: string;
  funds: { denom: string; amount: string }[];
}

export interface Instantiate {
  admin: string | null;
  code_id: number;
  msg: string;
  funds: { denom: string; amount: string }[];
  label: string;
}

export type WasmMsg =
  | { wasm: { execute: Execute } }
  | { wasm: { instantiate: Instantiate } };

export class WasmModule {
  public lastCodeId: number;
  public lastInstanceId: number;
  public store: any;

  constructor(public chain: CWSimulateApp) {
    chain.store.wasm = { codes: {}, contracts: {}, contractStorage: {} };
    this.store = chain.store.wasm;

    this.lastCodeId = 0;
    this.lastInstanceId = 0;
  }

  static buildContractAddress(codeId: number, instanceId: number): Uint8Array {
    let contractId = new Uint8Array([
      ...numberToBigEndianUint64(codeId),
      ...numberToBigEndianUint64(instanceId),
    ]);

    // append module name
    let mKey = new Uint8Array([
      ...Uint8Array.from(Buffer.from('wasm', 'utf-8')),
      0,
    ]);
    let payload = new Uint8Array([...mKey, ...contractId]);

    let hasher = new Sha256();
    hasher.update(Buffer.from('module', 'utf-8'));
    let th = hasher.digest();
    hasher = new Sha256(th);
    hasher.update(payload);
    let hash = hasher.digest();
    return hash.slice(0, 20);
  }

  create(creator: string, wasmCode: Uint8Array): number {
    let codeInfo = {
      creator,
      wasmCode,
    };

    this.store.codes[this.lastCodeId + 1] = codeInfo;
    this.lastCodeId += 1;
    return this.lastCodeId;
  }

  getExecutionEnv(contractAddress: string): any {
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

  async buildVM(contractAddress: string): Promise<VMInstance> {
    let { codeId } = this.store.contracts[contractAddress];
    let { wasmCode } = this.store.codes[codeId];

    let backend: IBackend = {
      backend_api: new BasicBackendApi(this.chain.bech32Prefix),
      storage: this.store.contractStorage[contractAddress],
      querier: new BasicQuerier(),
    };

    let vm = new VMInstance(backend);
    await vm.build(wasmCode);
    return vm;
  }

  async instantiate(
    sender: string,
    funds: Coin[],
    codeId: number,
    instantiateMsg: any
  ): Promise<any> {
    // TODO: add funds logic

    const contractAddressHash = WasmModule.buildContractAddress(
      codeId,
      this.lastInstanceId + 1
    );

    const contractAddress = toBech32(
      this.chain.bech32Prefix,
      contractAddressHash
    );

    const contractInfo = {
      codeId,
      creator: sender,
      admin: null,
      label: '',
      created: this.chain.height,
    };

    this.store.contracts[contractAddress] = contractInfo;
    this.store.contractStorage[contractAddress] = new BasicKVIterStorage();

    // call instantiate on the contract
    let backend: IBackend = {
      backend_api: new BasicBackendApi(this.chain.bech32Prefix),
      storage: this.store.contractStorage[contractAddress],
      querier: new BasicQuerier(),
    };

    let vm = new VMInstance(backend);
    await vm.build(this.store.codes[codeId].wasmCode);

    let env = this.getExecutionEnv(contractAddress);
    let info = { sender, funds };

    let res: any = vm.instantiate(env, info, instantiateMsg).json;
    // TODO: handle contract response
    return {
      contractAddress,
      result: {
        events: res.ok.events,
        data: res.ok.data,
      },
    };
  }

  async execute(
    sender: string,
    funds: Coin[],
    contractAddress: string,
    executeMsg: any
  ): Promise<any> {
    let contractInfo = this.store.contracts[contractAddress];
    if (contractInfo === undefined) {
      throw new Error(`Contract ${contractAddress} does not exist`);
    }

    let vm = await this.buildVM(contractAddress);

    let env = this.getExecutionEnv(contractAddress);
    let info = { sender, funds };

    let res: any = vm.execute(env, info, executeMsg).json;

    // TODO: handle contract response
    if (res.ok) {
      let handledResponse = await this.handleContractResponse(
        contractAddress,
        res.ok
      );
      console.log(handledResponse);
    } else {
      throw new Error(res.error);
    }

    return {
      events: res.ok.events,
      data: res.ok.data,
    };
  }

  async handleContractResponse(
    contractAddress: string,
    res: ContractResponse.Data
  ): Promise<Result<AppResponse, string>> {
    let { messages, events, attributes, data } = res;
    for (const message of messages) {
      let subres = await this.executeSubmsg(contractAddress, message);
      if (subres.ok) {
        events = [...events, ...subres.val.events];
        if (subres.val.data === null) {
          data = subres.val.data;
        }
      }
    }

    return Ok({ events, data });
  }

  async executeSubmsg(
    contractAddress: string,
    message: SubMsg.Data
  ): Promise<Result<AppResponse, string>> {
    let { id, msg, gas_limit, reply_on } = message;
    let r = await this.chain.handleMsg(contractAddress, msg);
    if (r.ok) {
      // submessage was successful
      let { events, data } = r.val;
      if (reply_on === 'success' || reply_on === 'always') {
        // call reply
        let replyMsg = {
          id,
          result: {
            ok: {
              events,
              data,
            },
          },
        };
        let replyRes = await this.reply(contractAddress, replyMsg);
        if (replyRes.ok) {
          // reply success
          if (replyRes.val.data !== null) {
            data = replyRes.val.data;
          }
          events = [...events, ...replyRes.val.events];
        } else {
          // reply failed
          return replyRes;
        }
      } else {
        // don't call reply
        data = null;
      }
      return Ok({ events, data });
    } else {
      // submessage failed
      if (reply_on === 'error' || reply_on === 'always') {
        // call reply
        let replyMsg = {
          id,
          result: {
            error: r.val,
          },
        };
        let replyRes = await this.reply(contractAddress, replyMsg);
        if (replyRes.ok) {
          // reply success
          let { events, data } = replyRes.val;
          return Ok({ events, data });
        } else {
          // reply failed
          return replyRes;
        }
      } else {
        // don't call reply
        return Err(r.val);
      }
    }
  }

  async reply(
    contractAddress: string,
    replyMsg: any
  ): Promise<Result<AppResponse, string>> {
    let vm = await this.buildVM(contractAddress);
    let res: any = vm.reply(
      this.getExecutionEnv(contractAddress),
      replyMsg
    ).json;
    if ('ok' in res) {
      // handle response
      return await this.handleContractResponse(contractAddress, res.ok);
    } else {
      return Err(res.error);
    }
  }

  async query(
    contractAddress: string,
    queryMsg: any
  ): Promise<Result<any, string>> {
    let vm = await this.buildVM(contractAddress);
    let env = this.getExecutionEnv(contractAddress);
    let res: any = vm.query(env, queryMsg).json;

    if ('ok' in res) {
      return Ok(JSON.parse(fromUtf8(fromBase64(res.ok))));
    } else {
      return Err(res.error);
    }
  }

  async handleMsg(
    sender: string,
    msg: any
  ): Promise<Result<AppResponse, string>> {
    let { wasm } = msg;
    if ('execute' in wasm) {
      let { contract_addr, funds, msg } = wasm.execute;
      let msgJSON = fromUtf8(fromBase64(msg));
      return await this.execute(
        sender,
        funds,
        contract_addr,
        JSON.parse(msgJSON)
      );
    } else if ('instantiate' in wasm.instantiate) {
      throw new Error('unimplemented');
    } else {
      throw new Error('Unknown wasm message');
    }
  }
}
