"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cosmwasm_stargate_1 = require("@cosmjs/cosmwasm-stargate");
const ts_results_1 = require("ts-results");
const CWSimulateVMInstance_1 = require("../../instrumentation/CWSimulateVMInstance");
const util_1 = require("../../util");
const error_1 = require("./error");
const module_1 = require("./module");
/** An interface to interact with CW SCs */
class Contract {
    _wasm;
    address;
    _vm;
    constructor(_wasm, address) {
        this._wasm = _wasm;
        this.address = address;
    }
    async init() {
        if (!this._vm) {
            const { _wasm: wasm, address } = this;
            const contractInfo = wasm.getContractInfo(address);
            if (!contractInfo)
                throw new Error(`Contract ${address} not found`);
            const { codeId } = contractInfo;
            const codeInfo = wasm.getCodeInfo(codeId);
            if (!codeInfo)
                throw new Error(`code ${codeId} not found`);
            const { wasmCode } = codeInfo;
            const contractState = this.getStorage();
            // @ts-ignore
            const storage = new wasm.chain.kvIterStorageRegistry(contractState);
            const backend = {
                backend_api: wasm.chain.backendApi,
                storage,
                querier: wasm.chain.querier,
            };
            const logs = [];
            // pass debug reference from wasm.chain, if implemented, check metering when sharing env
            const vm = new CWSimulateVMInstance_1.CWSimulateVMInstance(logs, msg => wasm.chain.debug?.(msg), backend, wasm.chain.env);
            await vm.build(wasmCode, module_1.WasmModule.checksumCache[codeId]);
            this._vm = vm;
        }
        return this;
    }
    instantiate(sender, funds, instantiateMsg, logs) {
        try {
            if (!this._vm) {
                return new error_1.ContractNotFoundError(this.address);
            }
            const vm = this._vm;
            const env = this.getExecutionEnv();
            const info = { sender, funds };
            const res = (0, util_1.fromRustResult)(vm.instantiate(env, info, instantiateMsg));
            this.setStorage(vm.backend.storage.dict);
            logs.push(...vm.logs);
            return res;
        }
        catch (ex) {
            return (0, ts_results_1.Err)(ex.message ?? ex.toString());
        }
    }
    execute(sender, funds, executeMsg, logs) {
        try {
            if (!this._vm) {
                return new error_1.ContractNotFoundError(this.address);
            }
            const vm = this._vm;
            vm.resetDebugInfo();
            const env = this.getExecutionEnv();
            const info = { sender, funds };
            const res = (0, util_1.fromRustResult)(vm.execute(env, info, executeMsg));
            this.setStorage(vm.backend.storage.dict);
            logs.push(...vm.logs);
            return res;
        }
        catch (ex) {
            return (0, ts_results_1.Err)(ex.message ?? ex.toString());
        }
    }
    migrate(migrateMsg, logs) {
        try {
            if (!this._vm) {
                return new error_1.ContractNotFoundError(this.address);
            }
            const vm = this._vm;
            const env = this.getExecutionEnv();
            const res = (0, util_1.fromRustResult)(vm.migrate(env, migrateMsg));
            this.setStorage(vm.backend.storage.dict);
            logs.push(...vm.logs);
            return res;
        }
        catch (ex) {
            return (0, ts_results_1.Err)(ex.message ?? ex.toString());
        }
    }
    sudo(sudoMsg, logs) {
        try {
            if (!this._vm) {
                return new error_1.ContractNotFoundError(this.address);
            }
            const vm = this._vm;
            const env = this.getExecutionEnv();
            const res = (0, util_1.fromRustResult)(vm.sudo(env, sudoMsg));
            this.setStorage(vm.backend.storage.dict);
            logs.push(...vm.logs);
            return res;
        }
        catch (ex) {
            return (0, ts_results_1.Err)(ex.message ?? ex.toString());
        }
    }
    reply(replyMsg, logs) {
        try {
            if (!this._vm) {
                return new error_1.ContractNotFoundError(this.address);
            }
            const vm = this._vm;
            const res = (0, util_1.fromRustResult)(vm.reply(this.getExecutionEnv(), replyMsg));
            this.setStorage(vm.backend.storage.dict);
            logs.push(...vm.logs);
            return res;
        }
        catch (ex) {
            return (0, ts_results_1.Err)(ex.message ?? ex.toString());
        }
    }
    ibc_channel_open(ibcChannelOpenMsg, logs) {
        try {
            if (!this._vm) {
                return new error_1.ContractNotFoundError(this.address);
            }
            const vm = this._vm;
            const res = (0, util_1.fromRustResult)(vm.ibc_channel_open(this.getExecutionEnv(), ibcChannelOpenMsg));
            this.setStorage(vm.backend.storage.dict);
            logs.push(...vm.logs);
            return res;
        }
        catch (ex) {
            return (0, ts_results_1.Err)(ex.message ?? ex.toString());
        }
    }
    ibc_channel_connect(ibcChannelConnectMsg, logs) {
        try {
            if (!this._vm) {
                return new error_1.ContractNotFoundError(this.address);
            }
            const vm = this._vm;
            const res = (0, util_1.fromRustResult)(vm.ibc_channel_connect(this.getExecutionEnv(), ibcChannelConnectMsg));
            this.setStorage(vm.backend.storage.dict);
            logs.push(...vm.logs);
            return res;
        }
        catch (ex) {
            return (0, ts_results_1.Err)(ex.message ?? ex.toString());
        }
    }
    ibc_channel_close(ibcChannelCloseMsg, logs) {
        try {
            if (!this._vm) {
                return new error_1.ContractNotFoundError(this.address);
            }
            const vm = this._vm;
            const res = (0, util_1.fromRustResult)(vm.ibc_channel_close(this.getExecutionEnv(), ibcChannelCloseMsg));
            this.setStorage(vm.backend.storage.dict);
            logs.push(...vm.logs);
            return res;
        }
        catch (ex) {
            return (0, ts_results_1.Err)(ex.message ?? ex.toString());
        }
    }
    ibc_packet_receive(ibcPacketReceiveMsg, logs) {
        try {
            if (!this._vm) {
                return new error_1.ContractNotFoundError(this.address);
            }
            const vm = this._vm;
            const res = (0, util_1.fromRustResult)(vm.ibc_packet_receive(this.getExecutionEnv(), ibcPacketReceiveMsg));
            this.setStorage(vm.backend.storage.dict);
            logs.push(...vm.logs);
            return res;
        }
        catch (ex) {
            return (0, ts_results_1.Err)(ex.message ?? ex.toString());
        }
    }
    ibc_packet_ack(ibcPacketAckMsg, logs) {
        try {
            if (!this._vm) {
                return new error_1.ContractNotFoundError(this.address);
            }
            const vm = this._vm;
            const res = (0, util_1.fromRustResult)(vm.ibc_packet_ack(this.getExecutionEnv(), ibcPacketAckMsg));
            this.setStorage(vm.backend.storage.dict);
            logs.push(...vm.logs);
            return res;
        }
        catch (ex) {
            return (0, ts_results_1.Err)(ex.message ?? ex.toString());
        }
    }
    ibc_packet_timeout(ibcPacketTimeoutMsg, logs) {
        try {
            if (!this._vm) {
                return new error_1.ContractNotFoundError(this.address);
            }
            const vm = this._vm;
            const res = (0, util_1.fromRustResult)(vm.ibc_packet_timeout(this.getExecutionEnv(), ibcPacketTimeoutMsg));
            this.setStorage(vm.backend.storage.dict);
            logs.push(...vm.logs);
            return res;
        }
        catch (ex) {
            return (0, ts_results_1.Err)(ex.message ?? ex.toString());
        }
    }
    query(queryMsg, store) {
        if (!this._vm) {
            return new error_1.ContractNotFoundError(this.address);
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
            return (0, util_1.fromRustResult)(vm.query(env, queryMsg)).andThen(v => (0, ts_results_1.Ok)((0, cosmwasm_stargate_1.fromBinary)(v)));
        }
        catch (ex) {
            return (0, ts_results_1.Err)(ex.message ?? ex.toString());
        }
        finally {
            // reset time travel
            this._vm.backend = currBackend;
        }
    }
    setStorage(value) {
        this._wasm.setContractStorage(this.address, value);
    }
    getStorage(storage) {
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
exports.default = Contract;
//# sourceMappingURL=contract.js.map