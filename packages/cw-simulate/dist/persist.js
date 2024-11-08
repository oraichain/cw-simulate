"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.load = exports.save = exports.serde = void 0;
const serde_1 = __importStar(require("@kiruse/serde"));
const types_1 = require("@kiruse/serde/dist/types");
const immutable_1 = require("@oraichain/immutable");
const ts_results_1 = require("ts-results");
const CWSimulateApp_1 = require("./CWSimulateApp");
exports.serde = (0, serde_1.default)()
    .standard()
    .setSimple('immutable-list', (list, data) => {
    return {
        data: data(list.toArray()),
        // ownerID is a unique object that should not even appear on
        // other Immutable data structures. When present, it signifies
        // that the Immutable should be mutated in-place rather than
        // creating copies of its data.
        mutable: !!list.__ownerID,
    };
}, ({ data, mutable }, deref) => {
    if (!data.length)
        return (0, immutable_1.List)();
    const list = (0, immutable_1.List)().asMutable();
    types_1.Reference.all(deref, data, values => {
        list.push(...values);
        !mutable && list.asImmutable();
    });
    return list;
})
    .setSimple('immutable-map', (map, data) => {
    return {
        data: data(map.toObject()),
        // same as with List above
        mutable: !!map.__ownerID,
    };
}, ({ data, mutable }, deref) => {
    const map = (0, immutable_1.Map)().asMutable();
    const keys = Object.keys(data);
    if (!keys.length)
        return (0, immutable_1.Map)();
    types_1.Reference.all(deref, keys.map(k => data[k]), values => {
        values.forEach((value, i) => {
            const key = keys[i];
            map.set(key, value);
        });
        !mutable && map.asImmutable();
    });
    return map;
})
    .setSimple('cw-simulate-app', (app) => ({
    chainId: app.chainId,
    bech32Prefix: app.bech32Prefix,
    store: app.store.db.data,
}), ({ chainId, bech32Prefix, store }, deref) => {
    // for sorted type, metering, need to update when restored succesfully
    const app = new CWSimulateApp_1.CWSimulateApp({
        chainId,
        bech32Prefix,
    });
    types_1.Reference.all(deref, [store], ([map]) => {
        app.store.db.tx(update => {
            update(() => map);
            return (0, ts_results_1.Ok)(undefined);
        });
    });
    return app;
});
const save = (app) => exports.serde.serializeAs('cw-simulate-app', app).compress().buffer;
exports.save = save;
const load = async (bytes) => {
    const app = exports.serde.deserializeAs('cw-simulate-app', bytes);
    const contracts = [...app.wasm.store.get('contracts').keys()];
    await Promise.all(contracts.map(address => app.wasm.getContract(address).init()));
    return app;
};
exports.load = load;
// Inject SERDE
immutable_1.Map.prototype[serde_1.SERDE] = 'immutable-map';
immutable_1.List.prototype[serde_1.SERDE] = 'immutable-list';
//# sourceMappingURL=persist.js.map