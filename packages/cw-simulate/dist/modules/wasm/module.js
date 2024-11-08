"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WasmModule = void 0;
exports.lensFromSnapshot = lensFromSnapshot;
const cosmwasm_stargate_1 = require("@cosmjs/cosmwasm-stargate");
const encoding_1 = require("@cosmjs/encoding");
const immutable_1 = require("@oraichain/immutable");
const ts_results_1 = require("ts-results");
const transactional_1 = require("../../store/transactional");
const contract_1 = __importDefault(require("./contract"));
const wasm_util_1 = require("./wasm-util");
const cosmwasm_vm_js_1 = require("@oraichain/cosmwasm-vm-js");
class WasmModule {
    chain;
    static checksumCache = {};
    store;
    // TODO: benchmark w/ many coexisting VMs
    contracts = {};
    constructor(chain) {
        this.chain = chain;
        this.store = chain.store.db.lens('wasm').initialize({
            lastCodeId: 0,
            lastInstanceId: 0,
            codes: {},
            contracts: {},
            contractStorage: {},
        });
    }
    setContractStorage(contractAddress, value) {
        this.store.tx(setter => {
            setter('contractStorage', contractAddress)(value);
            return (0, ts_results_1.Ok)(undefined);
        });
    }
    getContractStorage(contractAddress, storage) {
        return this.lens(storage).get('contractStorage', contractAddress);
    }
    setCodeInfo(codeId, codeInfo) {
        this.store.tx(setter => {
            setter('codes', codeId)(codeInfo);
            return (0, ts_results_1.Ok)(undefined);
        });
    }
    forEachCodeInfo(callback, storage) {
        const { data } = this.lens(storage).lens('codes');
        data.forEach((lens, codeId) => {
            const codeInfo = {
                creator: lens.get('creator'),
                wasmCode: lens.get('wasmCode'),
            };
            callback(codeInfo, Number(codeId));
        });
    }
    getCodeInfo(codeId, storage) {
        const lens = this.lens(storage).lens('codes', codeId);
        if (!lens)
            return;
        const codeInfo = {
            creator: lens.get('creator'),
            wasmCode: lens.get('wasmCode'),
        };
        return codeInfo;
    }
    setContractInfo(contractAddress, contractInfo) {
        this.store.tx(setter => {
            setter('contracts', contractAddress)(contractInfo);
            return (0, ts_results_1.Ok)(undefined);
        });
    }
    getContractInfo(contractAddress, storage) {
        const lens = this.lens(storage).lens('contracts', contractAddress);
        if (!lens?.data)
            return;
        return lens.data.toObject();
    }
    /** Store a new CosmWasm smart contract bytecode */
    storeCode(creator, wasmCode) {
        return this.chain.pushBlock(() => {
            return this.store.tx(setter => {
                let codeInfo = {
                    creator,
                    wasmCode,
                };
                const codeId = this.lastCodeId + 1;
                this.setCodeInfo(codeId, codeInfo);
                setter('lastCodeId')(codeId);
                return (0, ts_results_1.Ok)(codeId);
            });
        }, false);
    }
    /** Alias for `storeCode`, except it `.unwrap`s the result - kept for backwards compatibility */
    create(creator, wasmCode) {
        return this.storeCode(creator, wasmCode).unwrap();
    }
    /** Get the `Env` under which the next execution should run */
    getExecutionEnv(contractAddress) {
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
    getContract(address) {
        if (!this.contracts[address]) {
            this.contracts[address] = new contract_1.default(this, address);
        }
        return this.contracts[address];
    }
    getContracts() {
        return Object.values(this.contracts);
    }
    /** Register a new contract instance from codeId */
    registerContractInstance(sender, codeId, label = '', admin = null, salt = null) {
        return this.store.tx(setter => {
            // if there is salt, using instantiate2Address which does not fixMsg (msg = new Uint8Array())
            const contractAddress = salt === null
                ? (0, encoding_1.toBech32)(this.chain.bech32Prefix, (0, wasm_util_1.buildContractAddress)(codeId, this.lastInstanceId + 1))
                : (0, cosmwasm_stargate_1.instantiate2Address)((0, encoding_1.fromHex)(WasmModule.checksumCache[codeId]), sender, salt, this.chain.bech32Prefix);
            const contractInfo = {
                codeId,
                creator: sender,
                admin,
                label,
                created: this.chain.height,
            };
            this.setContractInfo(contractAddress, contractInfo);
            this.setContractStorage(contractAddress, this.chain.kvIterStorageRegistry === cosmwasm_vm_js_1.BinaryKVIterStorage ? (0, immutable_1.SortedMap)(cosmwasm_vm_js_1.compare) : (0, immutable_1.Map)());
            setter('lastInstanceId')(this.lastInstanceId + 1);
            return (0, ts_results_1.Ok)(contractAddress);
        });
    }
    async instantiateContract(sender, funds, codeId, instantiateMsg, label, admin = null, salt = null, traces = [], sameBlock = false) {
        return await this.chain.pushBlock(async () => {
            // first register the contract instance
            const contractAddress = this.registerContractInstance(sender, codeId, label, admin, salt).unwrap();
            let logs = [];
            const contract = await this.getContract(contractAddress).init();
            const tracebase = {
                [transactional_1.NEVER_IMMUTIFY]: true,
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
            let customEvent = {
                type: 'instantiate',
                attributes: [
                    { key: '_contract_address', value: contractAddress },
                    { key: 'code_id', value: codeId.toString() },
                ],
            };
            if (typeof response.val === 'string') {
                throw new Error(response.val.toString());
            }
            let res = (0, wasm_util_1.buildAppResponse)(contractAddress, customEvent, response.val);
            let subtraces = [];
            let result = await this.handleContractResponse(contractAddress, response.val.messages, res, subtraces);
            traces.push({
                ...tracebase,
                response,
                result,
                traces: subtraces,
                storeSnapshot: this.store.db.data,
            });
            return result;
        }, sameBlock);
    }
    /** Call migrate on the CW SC */
    async migrateContract(sender, newCodeId, contractAddress, migrateMsg, traces = [], sameBlock = false) {
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
            const logs = [];
            const tracebase = {
                [transactional_1.NEVER_IMMUTIFY]: true,
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
            let customEvent = {
                type: 'migrate',
                attributes: [{ key: '_contract_address', value: contractAddress }],
            };
            if (typeof response.val === 'string') {
                throw new Error(response.val.toString());
            }
            let res = (0, wasm_util_1.buildAppResponse)(contractAddress, customEvent, response.val);
            let subtraces = [];
            let result = await this.handleContractResponse(contractAddress, response.val.messages, res, subtraces);
            traces.push({
                ...tracebase,
                response,
                result,
                traces: subtraces,
                storeSnapshot: this.store.db.data,
            });
            return result;
        }, sameBlock);
    }
    /** Call execute on the CW SC */
    async executeContract(sender, funds, contractAddress, executeMsg, traces = [], sameBlock = false) {
        return await this.chain.pushBlock(async () => {
            const contract = await this.getContract(contractAddress).init();
            const logs = [];
            const tracebase = {
                [transactional_1.NEVER_IMMUTIFY]: true,
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
            let res = (0, wasm_util_1.buildAppResponse)(contractAddress, customEvent, response.val);
            let subtraces = [];
            let result = await this.handleContractResponse(contractAddress, response.val.messages, res, subtraces);
            traces.push({
                ...tracebase,
                response,
                result,
                traces: subtraces,
                storeSnapshot: this.store.db.data,
            });
            return result;
        }, sameBlock);
    }
    // like AppResponse, just extend attribute and process subMsg instead of return Result
    async handleIbcResponse(contractAddress, res, traces = []) {
        if (res?.messages) {
            await this.handleContractResponse(contractAddress, res.messages, res, traces);
        }
        return res;
    }
    /** Process contract response & execute (sub)messages */
    async handleContractResponse(contractAddress, messages, res, traces = []) {
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
        return (0, ts_results_1.Ok)({ events: res.events, data: res.data });
    }
    /** Handle a submessage returned in the response of a contract execution */
    async handleSubmsg(contractAddress, message, traces = []) {
        return this.store.tx(async () => {
            let { id, msg, gas_limit, reply_on } = message;
            let r = await this.chain.handleMsg(contractAddress, msg, traces);
            if (r.ok) {
                // submessage success
                let { events, data } = r.val;
                if (reply_on === cosmwasm_vm_js_1.ReplyOn.Success || reply_on === cosmwasm_vm_js_1.ReplyOn.Always) {
                    // submessage success, call reply
                    let replyMsg = {
                        id,
                        result: {
                            ok: {
                                events,
                                // wrap data reply
                                data: (0, wasm_util_1.wrapReplyResponse)(r.val).data,
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
                }
                else {
                    // submessage success, don't call reply
                    data = null;
                }
                return (0, ts_results_1.Ok)({ events, data });
            }
            // if panicked then throw Error
            const errMsg = r.val.toString();
            if (errMsg.startsWith('abort: panicked')) {
                throw new Error(errMsg);
            }
            // submessage failed
            if (reply_on === cosmwasm_vm_js_1.ReplyOn.Error || reply_on === cosmwasm_vm_js_1.ReplyOn.Always) {
                // submessage failed, call reply
                let replyMsg = {
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
                let { events, data } = replyRes.val;
                return (0, ts_results_1.Ok)({ events, data });
            }
            // submessage failed, don't call reply (equivalent to normal message)
            return r;
        });
    }
    async reply(contractAddress, replyMsg, traces = []) {
        const logs = [];
        const contract = this.getContract(contractAddress);
        const response = contract.reply(replyMsg, logs);
        const tracebase = {
            [transactional_1.NEVER_IMMUTIFY]: true,
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
        let res = (0, wasm_util_1.buildAppResponse)(contractAddress, customEvent, response.val);
        let subtraces = [];
        let result = await this.handleContractResponse(contractAddress, response.val.messages, res, subtraces);
        traces.push({
            ...tracebase,
            response,
            result,
            storeSnapshot: this.store.db.data,
        });
        return result;
    }
    query(contractAddress, queryMsg) {
        return this.getContract(contractAddress).query(queryMsg);
    }
    queryTrace(trace, queryMsg) {
        let { contractAddress, storeSnapshot } = trace;
        return this.getContract(contractAddress).query(queryMsg, storeSnapshot);
    }
    async handleMsg(sender, wasmMsg, traces = []) {
        return this.store.tx(async () => {
            if ('execute' in wasmMsg) {
                const { contract_addr, funds, msg } = wasmMsg.execute;
                // execute contract from handling Response should not increase block height
                return await this.executeContract(sender, funds, contract_addr, (0, cosmwasm_stargate_1.fromBinary)(msg), traces, true);
            }
            if ('instantiate' in wasmMsg) {
                const { code_id, funds, msg, label, admin } = wasmMsg.instantiate;
                return await this.instantiateContract(sender, funds, code_id, (0, cosmwasm_stargate_1.fromBinary)(msg), label, admin, null, traces, true);
            }
            if ('instantiate2' in wasmMsg) {
                const { code_id, funds, msg, label, admin, salt } = wasmMsg.instantiate2;
                return await this.instantiateContract(sender, funds, code_id, (0, cosmwasm_stargate_1.fromBinary)(msg), label, admin, (0, cosmwasm_stargate_1.fromBinary)(salt), traces, true);
            }
            if ('migrate' in wasmMsg) {
                const { contract_addr, new_code_id, msg } = wasmMsg.migrate;
                return await this.migrateContract(sender, new_code_id, contract_addr, (0, cosmwasm_stargate_1.fromBinary)(msg), traces, true);
            }
            throw new Error('Unknown wasm message');
        });
    }
    querySmart(smart) {
        const { contract_addr, msg } = smart;
        const result = this.query(contract_addr, (0, cosmwasm_stargate_1.fromBinary)(msg));
        // call query from other contract
        if (result.ok) {
            return result.val;
        }
        // wrap Err message for contract query result
        const errMsg = result.val.toString();
        // panic divide by zero should not process in query but return original value
        if (errMsg.startsWith('Divide by zero:')) {
            return '0';
        }
        // TODO: differentiate error between js and contract
        // contract error
        return (0, ts_results_1.Err)(errMsg);
    }
    queryRaw(raw) {
        const { contract_addr, key } = raw;
        const storage = this.getContractStorage(contract_addr);
        if (!storage) {
            throw new Error(`Contract ${contract_addr} not found`);
        }
        let value;
        // check if storage is BinaryKVIterStorage then key must be Uint8Array
        if (this.chain.kvIterStorageRegistry === cosmwasm_vm_js_1.BinaryKVIterStorage) {
            // @ts-ignore
            const binaryValue = storage.get((0, encoding_1.fromBase64)(key));
            // if empty than just ignore
            if (binaryValue)
                value = (0, encoding_1.toBase64)(binaryValue);
        }
        else {
            // @ts-ignore
            value = storage.get(key);
        }
        // return default value instead of empty to prevent throw error
        if (value === undefined) {
            // throw new Error(`Key ${key} not found`);
            value = '';
        }
        return value;
    }
    queryContractInfo(contractInfo) {
        const { contract_addr } = contractInfo;
        const info = this.getContractInfo(contract_addr);
        if (info === undefined) {
            throw new Error(`No such contract: ${contract_addr}`);
        }
        const { codeId: code_id, creator, admin } = info;
        const resp = {
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
    queryCodeInfo(codeInfo) {
        const { code_id } = codeInfo;
        const info = this.getCodeInfo(code_id);
        if (info === undefined) {
            throw new Error(`No such code: ${code_id}`);
        }
        const { creator } = info;
        const resp = {
            code_id,
            creator,
            checksum: WasmModule.checksumCache[code_id],
        };
        return resp;
    }
    // should wrap into Querier system error:
    handleQuery(query) {
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
    lens(storage) {
        return storage ? lensFromSnapshot(storage) : this.store;
    }
    pushTrace(traces, details) {
        //@ts-ignore
        traces.push({
            [transactional_1.NEVER_IMMUTIFY]: true,
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
exports.WasmModule = WasmModule;
function lensFromSnapshot(snapshot) {
    return new transactional_1.Transactional(snapshot).lens('wasm');
}
//# sourceMappingURL=module.js.map