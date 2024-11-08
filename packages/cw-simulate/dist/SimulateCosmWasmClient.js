"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimulateCosmWasmClient = void 0;
const cosmwasm_stargate_1 = require("@cosmjs/cosmwasm-stargate");
const CWSimulateApp_1 = require("./CWSimulateApp");
const crypto_1 = require("@cosmjs/crypto");
const encoding_1 = require("@cosmjs/encoding");
const immutable_1 = require("@oraichain/immutable");
const persist_1 = require("./persist");
const util_1 = require("./util");
const cosmwasm_vm_js_1 = require("@oraichain/cosmwasm-vm-js");
const wasm_1 = require("./modules/wasm");
class SimulateCosmWasmClient extends cosmwasm_stargate_1.SigningCosmWasmClient {
    // deserialize from bytes
    static async from(bytes) {
        const app = await (0, persist_1.load)(Uint8Array.from(bytes));
        return new SimulateCosmWasmClient(app);
    }
    app;
    constructor(appOrOptions) {
        super(null, null, {});
        if (appOrOptions instanceof CWSimulateApp_1.CWSimulateApp) {
            this.app = appOrOptions;
        }
        else {
            this.app = new CWSimulateApp_1.CWSimulateApp(appOrOptions);
        }
    }
    // serialize to bytes
    toBytes() {
        return (0, persist_1.save)(this.app);
    }
    async loadContract(address, info, data) {
        this.app.wasm.setContractInfo(address, info);
        this.app.wasm.setContractStorage(address, (0, immutable_1.isMap)(data) ? data : this.app.kvIterStorageRegistry === cosmwasm_vm_js_1.BinaryKVIterStorage ? (0, immutable_1.SortedMap)(data, cosmwasm_vm_js_1.compare) : (0, immutable_1.Map)(data));
        await this.app.wasm.getContract(address).init();
    }
    getChainId() {
        return Promise.resolve(this.app.chainId);
    }
    getHeight() {
        return Promise.resolve(this.app.height);
    }
    getAccount(searchAddress) {
        return Promise.resolve({
            address: searchAddress,
            pubkey: null,
            accountNumber: 0,
            sequence: 0,
        });
    }
    getSequence(_address) {
        return Promise.resolve({
            accountNumber: 0,
            sequence: 0,
        });
    }
    getBlock(height) {
        return Promise.resolve({
            id: '',
            header: {
                version: {
                    app: 'simulate',
                    block: 'simulate',
                },
                height,
                chainId: this.app.chainId,
                time: new Date().toString(),
            },
            txs: [],
        });
    }
    getBalance(address, searchDenom) {
        // default return zero balance
        const coin = this.app.bank.getBalance(address).find(coin => coin.denom === searchDenom) ?? {
            denom: searchDenom,
            amount: '0',
        };
        return Promise.resolve(coin);
    }
    getCodes() {
        const codes = [];
        this.app.wasm.forEachCodeInfo((codeInfo, codeId) => {
            codes.push({
                id: codeId,
                creator: codeInfo.creator,
                checksum: wasm_1.WasmModule.checksumCache[codeId],
            });
        });
        return Promise.resolve(codes);
    }
    getCodeDetails(codeId) {
        const codeInfo = this.app.wasm.getCodeInfo(codeId);
        const codeDetails = {
            id: codeId,
            creator: codeInfo.creator,
            checksum: wasm_1.WasmModule.checksumCache[codeId],
            data: codeInfo.wasmCode,
        };
        return Promise.resolve(codeDetails);
    }
    getContract(address) {
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
    sendTokens(senderAddress, recipientAddress, amount, _fee, _memo) {
        const res = this.app.bank.send(senderAddress, recipientAddress, amount ?? []);
        return Promise.resolve({
            height: this.app.height,
            txIndex: 0,
            code: res.ok ? 0 : 1,
            transactionHash: (0, util_1.getTransactionHash)(this.app.height, res),
            events: [],
            rawLog: typeof res.val === 'string' ? res.val : undefined,
            gasUsed: 66_000,
            gasWanted: this.app.gasLimit,
            msgResponses: [], // for cosmos sdk < 0.46
        });
    }
    upload(senderAddress, wasmCode, _fee, _memo) {
        // import the wasm bytecode
        const checksum = (0, encoding_1.toHex)((0, crypto_1.sha256)(wasmCode));
        const codeId = this.app.wasm.create(senderAddress, wasmCode);
        wasm_1.WasmModule.checksumCache[codeId] = checksum;
        return Promise.resolve({
            originalSize: wasmCode.length,
            compressedSize: wasmCode.length,
            checksum,
            codeId,
            logs: [],
            height: this.app.height,
            transactionHash: (0, util_1.getTransactionHash)(this.app.height, checksum),
            events: [],
            gasWanted: this.app.gasLimit,
            gasUsed: wasmCode.length * 10,
        });
    }
    async _instantiate(senderAddress, codeId, msg, label, salt = null, options) {
        // instantiate the contract
        const contractGasUsed = this.app.gasUsed;
        // pass checksum to cache build
        const result = await this.app.wasm.instantiateContract(senderAddress, options?.funds ?? [], codeId, msg, label, options?.admin, salt);
        if (result.err || typeof result.val === 'string') {
            throw new Error(result.val.toString());
        }
        // pull out the contract address
        const contractAddress = result.val.events[0].attributes[0].value;
        return {
            contractAddress,
            logs: [],
            height: this.app.height,
            transactionHash: (0, util_1.getTransactionHash)(this.app.height, result),
            events: result.val.events,
            gasWanted: this.app.gasLimit,
            gasUsed: this.app.gasUsed - contractGasUsed,
        };
    }
    async instantiate(senderAddress, codeId, msg, label, _fee, options) {
        return this._instantiate(senderAddress, codeId, msg, label, null, options);
    }
    async instantiate2(senderAddress, codeId, salt, msg, label, _fee, options) {
        return this._instantiate(senderAddress, codeId, msg, label, salt, options);
    }
    /**
     * Like `execute` but allows executing multiple messages in one transaction.
     */
    async executeMultiple(senderAddress, instructions, _fee, _memo) {
        const events = [];
        const contractGasUsed = this.app.gasUsed;
        const results = [];
        let ind = 0;
        for (const { contractAddress, funds, msg } of instructions) {
            // run in sequential, only last block will push new height
            const result = await this.app.wasm.executeContract(senderAddress, funds ?? [], contractAddress, msg, undefined, ++ind !== instructions.length);
            if (result.err || typeof result.val === 'string') {
                throw new Error(result.val.toString());
            }
            events.push(...result.val.events);
            results.push(result);
        }
        return {
            logs: [],
            height: this.app.height,
            transactionHash: (0, util_1.getTransactionHash)(this.app.height, results),
            events,
            gasWanted: this.app.gasLimit,
            gasUsed: this.app.gasUsed - contractGasUsed,
        };
    }
    // keep the same interface so that we can switch to real environment
    async execute(senderAddress, contractAddress, msg, fee, memo, funds) {
        return this.executeMultiple(senderAddress, [
            {
                contractAddress,
                msg,
                funds,
            },
        ], fee, memo);
    }
    async migrate(senderAddress, contractAddress, codeId, migrateMsg, _fee, _memo) {
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
            transactionHash: (0, util_1.getTransactionHash)(this.app.height, result),
            events: result.val.events,
            gasWanted: this.app.gasLimit,
            gasUsed: this.app.gasUsed - contractGasUsed,
        };
    }
    async queryContractRaw(address, key) {
        const result = this.app.wasm.handleQuery({ raw: { contract_addr: address, key: (0, cosmwasm_stargate_1.toBinary)(key) } });
        return Promise.resolve((0, encoding_1.fromBase64)((0, cosmwasm_stargate_1.toBinary)({ ok: result })));
    }
    async queryContractSmart(address, queryMsg) {
        const result = this.app.wasm.query(address, queryMsg);
        // check is ok or err
        return result.ok ? Promise.resolve(result.val) : Promise.reject(new Error(result.val));
    }
}
exports.SimulateCosmWasmClient = SimulateCosmWasmClient;
//# sourceMappingURL=SimulateCosmWasmClient.js.map