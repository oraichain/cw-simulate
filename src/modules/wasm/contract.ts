import { Coin } from '@cosmjs/amino';
import { fromBinary } from '@cosmjs/cosmwasm-stargate';
import { ContractResponse, IBackend } from '@oraichain/cosmwasm-vm-js';
import { Map } from '@oraichain/immutable';
import { Err, Ok, Result } from 'ts-results';
import { CWSimulateVMInstance } from '../../instrumentation/CWSimulateVMInstance';
import {
  DebugLog,
  IbcBasicResponse,
  IbcChannelCloseMsg,
  IbcChannelConnectMsg,
  IbcChannelOpenMsg,
  IbcChannelOpenResponse,
  IbcPacketAckMsg,
  IbcPacketReceiveMsg,
  IbcPacketTimeoutMsg,
  IbcReceiveResponse,
  ReplyMsg,
  Snapshot,
} from '../../types';
import { fromRustResult } from '../../util';
import { ContractNotFoundError } from './error';
import { WasmModule } from './module';

/** An interface to interact with CW SCs */
export default class Contract {
  private _vm: CWSimulateVMInstance | undefined;

  constructor(private _wasm: WasmModule, public readonly address: string) {}

  async init() {
    if (!this._vm) {
      const { _wasm: wasm, address } = this;
      const contractInfo = wasm.getContractInfo(address);
      if (!contractInfo) throw new Error(`Contract ${address} not found`);

      const { codeId } = contractInfo;
      const codeInfo = wasm.getCodeInfo(codeId);
      if (!codeInfo) throw new Error(`code ${codeId} not found`);

      const { wasmCode } = codeInfo;
      const contractState = this.getStorage();

      // @ts-ignore
      const storage = new wasm.chain.kvIterStorageRegistry(contractState);

      const backend: IBackend = {
        backend_api: wasm.chain.backendApi,
        storage,
        querier: wasm.chain.querier,
      };

      const logs: DebugLog[] = [];
      // pass debug reference from wasm.chain, if implemented, check metering when sharing env

      const vm = new CWSimulateVMInstance(logs, msg => wasm.chain.debug?.(msg), backend, wasm.chain.env);

      await vm.build(wasmCode, WasmModule.checksumCache[codeId]);

      this._vm = vm;
    }
    return this;
  }

  instantiate(sender: string, funds: Coin[], instantiateMsg: any, logs: DebugLog[]): Result<ContractResponse, string> {
    try {
      if (!this._vm) {
        return new ContractNotFoundError(this.address);
      }
      const vm = this._vm;

      const env = this.getExecutionEnv();
      const info = { sender, funds };

      const res = fromRustResult<ContractResponse>(vm.instantiate(env, info, instantiateMsg));

      this.setStorage(vm.backend.storage.dict);

      logs.push(...vm.logs);

      return res;
    } catch (ex) {
      return Err((ex as Error).message ?? ex.toString());
    }
  }

  execute(sender: string, funds: Coin[], executeMsg: any, logs: DebugLog[]): Result<ContractResponse, string> {
    try {
      if (!this._vm) {
        return new ContractNotFoundError(this.address);
      }
      const vm = this._vm;
      vm.resetDebugInfo();
      const env = this.getExecutionEnv();
      const info = { sender, funds };
      const res = fromRustResult<ContractResponse>(vm.execute(env, info, executeMsg));

      this.setStorage(vm.backend.storage.dict);

      logs.push(...vm.logs);

      return res;
    } catch (ex) {
      return Err((ex as Error).message ?? ex.toString());
    }
  }

  migrate(migrateMsg: any, logs: DebugLog[]): Result<ContractResponse, string> {
    try {
      if (!this._vm) {
        return new ContractNotFoundError(this.address);
      }
      const vm = this._vm;
      const env = this.getExecutionEnv();
      const res = fromRustResult<ContractResponse>(vm.migrate(env, migrateMsg));

      this.setStorage(vm.backend.storage.dict);

      logs.push(...vm.logs);

      return res;
    } catch (ex) {
      return Err((ex as Error).message ?? ex.toString());
    }
  }

  reply(replyMsg: ReplyMsg, logs: DebugLog[]): Result<ContractResponse, string> {
    try {
      if (!this._vm) {
        return new ContractNotFoundError(this.address);
      }
      const vm = this._vm;
      const res = fromRustResult<ContractResponse>(vm.reply(this.getExecutionEnv(), replyMsg));

      this.setStorage(vm.backend.storage.dict);

      logs.push(...vm.logs);

      return res;
    } catch (ex) {
      return Err((ex as Error).message ?? ex.toString());
    }
  }

  ibc_channel_open(ibcChannelOpenMsg: IbcChannelOpenMsg, logs: DebugLog[]): Result<IbcChannelOpenResponse, string> {
    try {
      if (!this._vm) {
        return new ContractNotFoundError(this.address);
      }
      const vm = this._vm;
      const res = fromRustResult<IbcChannelOpenResponse>(
        vm.ibc_channel_open(this.getExecutionEnv(), ibcChannelOpenMsg)
      );

      this.setStorage(vm.backend.storage.dict);

      logs.push(...vm.logs);

      return res;
    } catch (ex) {
      return Err((ex as Error).message ?? ex.toString());
    }
  }

  ibc_channel_connect(ibcChannelConnectMsg: IbcChannelConnectMsg, logs: DebugLog[]): Result<IbcBasicResponse, string> {
    try {
      if (!this._vm) {
        return new ContractNotFoundError(this.address);
      }
      const vm = this._vm;
      const res = fromRustResult<IbcBasicResponse>(
        vm.ibc_channel_connect(this.getExecutionEnv(), ibcChannelConnectMsg)
      );

      this.setStorage(vm.backend.storage.dict);

      logs.push(...vm.logs);

      return res;
    } catch (ex) {
      return Err((ex as Error).message ?? ex.toString());
    }
  }

  ibc_channel_close(ibcChannelCloseMsg: IbcChannelCloseMsg, logs: DebugLog[]): Result<IbcBasicResponse, string> {
    try {
      if (!this._vm) {
        return new ContractNotFoundError(this.address);
      }
      const vm = this._vm;
      const res = fromRustResult<IbcBasicResponse>(vm.ibc_channel_close(this.getExecutionEnv(), ibcChannelCloseMsg));

      this.setStorage(vm.backend.storage.dict);

      logs.push(...vm.logs);

      return res;
    } catch (ex) {
      return Err((ex as Error).message ?? ex.toString());
    }
  }

  ibc_packet_receive(ibcPacketReceiveMsg: IbcPacketReceiveMsg, logs: DebugLog[]): Result<IbcReceiveResponse, string> {
    try {
      if (!this._vm) {
        return new ContractNotFoundError(this.address);
      }
      const vm = this._vm;
      const res = fromRustResult<IbcReceiveResponse>(
        vm.ibc_packet_receive(this.getExecutionEnv(), ibcPacketReceiveMsg)
      );

      this.setStorage(vm.backend.storage.dict);

      logs.push(...vm.logs);

      return res;
    } catch (ex) {
      return Err((ex as Error).message ?? ex.toString());
    }
  }

  ibc_packet_ack(ibcPacketAckMsg: IbcPacketAckMsg, logs: DebugLog[]): Result<IbcBasicResponse, string> {
    try {
      if (!this._vm) {
        return new ContractNotFoundError(this.address);
      }
      const vm = this._vm;
      const res = fromRustResult<IbcBasicResponse>(vm.ibc_packet_ack(this.getExecutionEnv(), ibcPacketAckMsg));

      this.setStorage(vm.backend.storage.dict);

      logs.push(...vm.logs);

      return res;
    } catch (ex) {
      return Err((ex as Error).message ?? ex.toString());
    }
  }

  ibc_packet_timeout(ibcPacketTimeoutMsg: IbcPacketTimeoutMsg, logs: DebugLog[]): Result<IbcBasicResponse, string> {
    try {
      if (!this._vm) {
        return new ContractNotFoundError(this.address);
      }
      const vm = this._vm;
      const res = fromRustResult<IbcBasicResponse>(vm.ibc_packet_timeout(this.getExecutionEnv(), ibcPacketTimeoutMsg));

      this.setStorage(vm.backend.storage.dict);

      logs.push(...vm.logs);

      return res;
    } catch (ex) {
      return Err((ex as Error).message ?? ex.toString());
    }
  }

  query(queryMsg: any, store?: Map<string, string>): Result<any, string> {
    if (!this._vm) {
      return new ContractNotFoundError(this.address);
    }

    const vm = this._vm;

    // time travel
    const currBackend = vm.backend;
    // @ts-ignore
    const storage = new this._wasm.chain.kvIterStorageRegistry(this.getStorage(store));

    vm.backend = {
      ...vm.backend,
      storage,
    };

    let env = this.getExecutionEnv();
    try {
      return fromRustResult<string>(vm.query(env, queryMsg)).andThen(v => Ok(fromBinary(v)));
    } catch (ex) {
      return Err((ex as Error).message ?? ex.toString());
    } finally {
      // reset time travel
      this._vm.backend = currBackend;
    }
  }

  setStorage(value: Map<unknown, unknown>) {
    this._wasm.setContractStorage(this.address, value);
  }

  getStorage(storage?: Snapshot): Map<unknown, unknown> {
    return this._wasm.getContractStorage(this.address, storage);
  }

  getExecutionEnv() {
    return this._wasm.getExecutionEnv(this.address);
  }

  get vm() {
    return this._vm;
  }
  get valid() {
    return !!this._vm;
  }
}
