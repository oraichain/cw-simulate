"use strict";
// @ts-nocheck
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.wrapReplyResponse = wrapReplyResponse;
exports.buildContractAddress = buildContractAddress;
exports.buildAppResponse = buildAppResponse;
const crypto_1 = require("@cosmjs/crypto");
const protobufjs_1 = __importDefault(require("protobufjs"));
const cosmwasm_vm_js_1 = require("@oraichain/cosmwasm-vm-js");
const encoding_1 = require("@cosmjs/encoding");
const protobufRoot = protobufjs_1.default.Root.fromJSON({
    nested: {
        MsgInstantiateContractResponse: {
            fields: {
                address: {
                    type: 'string',
                    id: 1,
                },
                data: {
                    type: 'bytes',
                    id: 2,
                },
            },
        },
    },
});
function wrapReplyResponse(res) {
    const MsgInstantiateContractResponse = protobufRoot.lookupType('MsgInstantiateContractResponse');
    const payload = {
        data: res.data,
        address: null,
    };
    for (const event of res.events) {
        const address = event.attributes.find(attr => attr.key === '_contract_address')?.value;
        if (address) {
            payload.address = address;
            break;
        }
    }
    const message = MsgInstantiateContractResponse.create(payload); //;
    return {
        events: res.events,
        data: (0, encoding_1.toBase64)(MsgInstantiateContractResponse.encode(message).finish()),
    };
}
function buildContractAddress(codeId, instanceId) {
    const payload = Buffer.alloc(21); // wasm0 + contractId = 5 + 16, and initialized to 0 by default
    payload.write('wasm');
    // append code id
    (0, cosmwasm_vm_js_1.writeUInt32BE)(payload, codeId, 9);
    (0, cosmwasm_vm_js_1.writeUInt32BE)(payload, instanceId, 17);
    let hasher = new crypto_1.Sha256();
    hasher.update(Buffer.from('module', 'utf-8'));
    let th = hasher.digest();
    hasher = new crypto_1.Sha256(th);
    hasher.update(payload);
    let hash = hasher.digest();
    return hash.slice(0, 20);
}
function buildAppResponse(contract, customEvent, response) {
    const appEvents = [];
    // add custom event
    appEvents.push(customEvent);
    // add contract attributes under `wasm` event type
    if (response.attributes.length > 0) {
        appEvents.push({
            type: 'wasm',
            attributes: [
                {
                    key: '_contract_address',
                    value: contract,
                },
                ...response.attributes,
            ],
        });
    }
    // add events and prefix with `wasm-`
    for (const event of response.events) {
        appEvents.push({
            type: `wasm-${event.type}`,
            attributes: [{ key: '_contract_address', value: contract }, ...event.attributes],
        });
    }
    return {
        events: appEvents,
        data: response.data,
    };
}
//# sourceMappingURL=wasm-util.js.map