"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNewResponse = exports.getOldInfo = exports.getOldEnv = void 0;
const types_1 = require("../types");
function getOldEnv({ contract, block: { time, height, chain_id }, }) {
    const time_nanos = Number(time);
    return {
        contract,
        block: {
            time: Math.round(time_nanos / 1_000_000_000),
            time_nanos,
            height,
            chain_id,
        },
    };
}
exports.getOldEnv = getOldEnv;
function getOldInfo({ sender, funds }) {
    return {
        sender,
        sent_funds: funds,
    };
}
exports.getOldInfo = getOldInfo;
function getNewResponse(json) {
    if ('ok' in json) {
        const { submessages, data, attributes, messages } = json.ok;
        const newResponse = {
            attributes,
            data,
            events: [],
            messages: [],
        };
        // this is for version 5
        if (submessages) {
            newResponse.messages.push(...submessages);
        }
        for (const message of messages) {
            let newMessage;
            if ('wasm' in message) {
                const oldWasmMsg = message.wasm;
                if ('instantiate' in oldWasmMsg) {
                    const { code_id, msg, send, label } = oldWasmMsg.instantiate;
                    newMessage = {
                        wasm: {
                            instantiate: {
                                admin: null,
                                code_id,
                                msg,
                                funds: send,
                                label: label ?? '',
                            },
                        },
                    };
                }
                else if ('execute' in oldWasmMsg) {
                    const { contract_addr, msg, send } = oldWasmMsg.execute;
                    newMessage = {
                        wasm: {
                            execute: {
                                contract_addr,
                                msg,
                                funds: send,
                            },
                        },
                    };
                }
            }
            else {
                newMessage = message;
            }
            // other type of message we currently does not support
            if (newMessage) {
                newResponse.messages.push({
                    id: 0,
                    msg: newMessage,
                    reply_on: types_1.ReplyOn.Never,
                    gas_limit: null,
                });
            }
        }
        return { ok: newResponse };
    }
    return json;
}
exports.getNewResponse = getNewResponse;
//# sourceMappingURL=convert.js.map