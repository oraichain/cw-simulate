"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Querier = exports.CWSimulateApp = void 0;
const cosmwasm_vm_js_1 = require("@oraichain/cosmwasm-vm-js");
const ts_results_1 = require("ts-results");
const wasm_1 = require("./modules/wasm");
const bank_1 = require("./modules/bank");
const transactional_1 = require("./store/transactional");
const serde_1 = require("@kiruse/serde");
const ibc_1 = require("./modules/ibc");
const util_1 = require("./util");
const immutable_1 = require("@oraichain/immutable");
class CWSimulateApp {
    [serde_1.SERDE] = 'cw-simulate-app';
    chainId;
    bech32Prefix;
    backendApi;
    debug;
    env;
    handleCustomMsg; // make sure can not re-assign it
    queryCustomMsg; // make sure can not re-assign it
    store;
    kvIterStorageRegistry;
    wasm;
    bank;
    ibc;
    querier;
    constructor(options) {
        this.chainId = options.chainId;
        this.bech32Prefix = options.bech32Prefix;
        this.backendApi = options.backendApi ?? new cosmwasm_vm_js_1.BasicBackendApi(this.bech32Prefix);
        if (options.metering) {
            this.env = new cosmwasm_vm_js_1.Environment(this.backendApi, options.gasLimit);
        }
        this.kvIterStorageRegistry = options.kvIterStorageRegistry ?? cosmwasm_vm_js_1.BinaryKVIterStorage;
        this.debug = options.debug ?? util_1.printDebug;
        this.handleCustomMsg = options.handleCustomMsg;
        this.queryCustomMsg = options.queryCustomMsg;
        this.store = new transactional_1.Transactional(this.kvIterStorageRegistry === cosmwasm_vm_js_1.BinaryKVIterStorage ? (0, immutable_1.SortedMap)(cosmwasm_vm_js_1.compare) : (0, immutable_1.Map)())
            .lens()
            .initialize({
            height: 1,
            time: Date.now() * 1e6,
        });
        this.wasm = new wasm_1.WasmModule(this);
        this.bank = new bank_1.BankModule(this);
        this.ibc = new ibc_1.IbcModule(this);
        this.querier = new Querier(this);
    }
    get gasUsed() {
        return this.env?.gasUsed ?? 0;
    }
    get gasLimit() {
        return this.env?.gasLimit ?? 0;
    }
    async handleMsg(sender, msg, traces = []) {
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
            if (!this.handleCustomMsg)
                return (0, ts_results_1.Err)(`no custom handle found for: ${Object.keys(msg)[0]}`);
            return await this.handleCustomMsg(sender, msg);
        }
        return (0, ts_results_1.Err)(`unknown message: ${JSON.stringify(msg)}`);
    }
    pushBlock(callback, sameBlock) {
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
    set time(nanoSeconds) {
        this.store.tx(setter => (0, ts_results_1.Ok)(setter('time')(nanoSeconds)));
    }
    set height(blockHeight) {
        this.store.tx(setter => (0, ts_results_1.Ok)(setter('height')(blockHeight)));
    }
}
exports.CWSimulateApp = CWSimulateApp;
class Querier extends cosmwasm_vm_js_1.QuerierBase {
    app;
    constructor(app) {
        super();
        this.app = app;
    }
    handleQuery(query) {
        if ('bank' in query) {
            return this.app.bank.handleQuery(query.bank);
        }
        if ('wasm' in query) {
            return this.app.wasm.handleQuery(query.wasm);
        }
        if (this.app.queryCustomMsg &&
            ('stargate' in query ||
                'custom' in query ||
                'staking' in query ||
                'ibc' in query ||
                'distribution' in query ||
                'grpc' in query)) {
            // make default response to keep app working
            if (!this.app.queryCustomMsg)
                return (0, ts_results_1.Err)(`no custom query found for: ${Object.keys(query)[0]}`);
            return this.app.queryCustomMsg(query);
        }
        // not yet implemented, so use custom fallback assignment
        throw new Error('Unknown query message');
    }
}
exports.Querier = Querier;
//# sourceMappingURL=CWSimulateApp.js.map