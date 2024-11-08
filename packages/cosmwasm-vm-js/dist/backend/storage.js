"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BinaryKVIterStorage = exports.BinaryKVStorage = exports.BasicKVIterStorage = exports.BasicKVStorage = exports.Order = exports.Record = void 0;
const encoding_1 = require("@cosmjs/encoding");
const byte_array_1 = require("../helpers/byte-array");
const immutable_1 = __importDefault(require("@oraichain/immutable"));
class Record {
    key = Uint8Array.from([]);
    value = Uint8Array.from([]);
}
exports.Record = Record;
var Order;
(function (Order) {
    Order[Order["Ascending"] = 1] = "Ascending";
    Order[Order["Descending"] = 2] = "Descending";
})(Order || (exports.Order = Order = {}));
class BasicKVStorage {
    dict;
    // TODO: Add binary uint / typed Addr maps for cw-storage-plus compatibility
    constructor(dict = immutable_1.default.Map()) {
        this.dict = dict;
    }
    *keys() {
        for (const key of this.dict.keys()) {
            yield (0, encoding_1.fromBase64)(key);
        }
    }
    get(key) {
        const keyStr = (0, encoding_1.toBase64)(key);
        const value = this.dict.get(keyStr);
        if (value === undefined) {
            return null;
        }
        return (0, encoding_1.fromBase64)(value);
    }
    set(key, value) {
        const keyStr = (0, encoding_1.toBase64)(key);
        this.dict = this.dict.set(keyStr, (0, encoding_1.toBase64)(value));
    }
    remove(key) {
        this.dict = this.dict.remove((0, encoding_1.toBase64)(key));
    }
}
exports.BasicKVStorage = BasicKVStorage;
class BasicKVIterStorage extends BasicKVStorage {
    dict;
    iterators;
    constructor(dict = immutable_1.default.Map(), iterators = new Map()) {
        super(dict);
        this.dict = dict;
        this.iterators = iterators;
    }
    all(iterator_id) {
        const out = [];
        while (true) {
            const record = this.next(iterator_id);
            if (record === null) {
                break;
            }
            out.push(record);
        }
        return out;
    }
    // Get next element of iterator with ID `iterator_id`.
    // Creates a region containing both key and value and returns its address.
    // Ownership of the result region is transferred to the contract.
    // The KV region uses the format value || valuelen || key || keylen, where valuelen and keylen are fixed-size big-endian u32 values.
    // An empty key (i.e. KV region ends with \0\0\0\0) means no more element, no matter what the value is.
    next(iterator_id) {
        const iter = this.iterators.get((0, byte_array_1.toNumber)(iterator_id));
        if (iter === undefined) {
            throw new Error(`Iterator not found.`);
        }
        const record = iter.data[iter.position];
        if (!record) {
            return null;
        }
        iter.position += 1;
        return record;
    }
    scan(start, end, order) {
        if (!(order in Order)) {
            throw new Error(`Invalid order value ${order}.`);
        }
        const hasStart = start?.length;
        const hasEnd = end?.length;
        // if there is end namespace
        const filterKeyLength = hasStart && start[0] === 0
            ? start[1]
            : hasEnd && end[0] == 0
                ? end[1]
                : 0;
        const newId = this.iterators.size + 1;
        // if start > end, this represents an empty range
        if (hasStart && hasEnd && (0, byte_array_1.compare)(start, end) === 1) {
            this.iterators.set(newId, { data: [], position: 0 });
            return (0, byte_array_1.toByteArray)(newId);
        }
        let data = [];
        for (const key of this.dict.keys()) {
            let keyArr = (0, encoding_1.fromBase64)(key);
            // out of range
            if ((hasStart && (0, byte_array_1.compare)(keyArr, start) < 0) ||
                (hasEnd && (0, byte_array_1.compare)(keyArr, end) >= 0))
                continue;
            // different namespace
            if (filterKeyLength !== 0 &&
                keyArr[0] === 0 &&
                filterKeyLength !== keyArr[1]) {
                continue;
            }
            data.push({ key: keyArr, value: this.get(keyArr) });
        }
        data.sort((a, b) => order === Order.Descending ? (0, byte_array_1.compare)(b.key, a.key) : (0, byte_array_1.compare)(a.key, b.key));
        this.iterators.set(newId, { data, position: 0 });
        return (0, byte_array_1.toByteArray)(newId);
    }
}
exports.BasicKVIterStorage = BasicKVIterStorage;
class BinaryKVStorage {
    dict;
    constructor(dict = immutable_1.default.SortedMap(byte_array_1.compare)) {
        this.dict = dict;
    }
    *keys() {
        for (const key of this.dict.keys()) {
            yield key;
        }
    }
    get(key) {
        const value = this.dict.get(key);
        if (value === undefined) {
            return null;
        }
        return value;
    }
    set(key, value) {
        this.dict = this.dict.set(new Uint8Array(key), new Uint8Array(value));
    }
    remove(key) {
        this.dict = this.dict.delete(new Uint8Array(key));
    }
}
exports.BinaryKVStorage = BinaryKVStorage;
class BinaryKVIterStorage extends BinaryKVStorage {
    iterators;
    constructor(dict, iterators = new Map()) {
        super(dict);
        this.iterators = iterators;
    }
    all(iterator_id) {
        const out = [];
        while (true) {
            const record = this.next(iterator_id);
            if (record === null) {
                break;
            }
            out.push(record);
        }
        return out;
    }
    // Get next element of iterator with ID `iterator_id`.
    // Creates a region containing both key and value and returns its address.
    // Ownership of the result region is transferred to the contract.
    // The KV region uses the format value || valuelen || key || keylen, where valuelen and keylen are fixed-size big-endian u32 values.
    // An empty key (i.e. KV region ends with \0\0\0\0) means no more element, no matter what the value is.
    next(iterator_id) {
        const iter = this.iterators.get((0, byte_array_1.toNumber)(iterator_id));
        if (iter === undefined) {
            throw new Error(`Iterator not found.`);
        }
        const record = iter.data[iter.position];
        if (!record) {
            return null;
        }
        iter.position += 1;
        return record;
    }
    scan(start, end, order) {
        if (!(order in Order)) {
            throw new Error(`Invalid order value ${order}.`);
        }
        const hasStart = start !== null && start.length;
        const hasEnd = end !== null && end.length;
        // if there is end namespace
        const filterKeyLength = hasStart && start[0] === 0
            ? start[1]
            : hasEnd && end[0] == 0
                ? end[1]
                : 0;
        const newId = this.iterators.size + 1;
        // if start > end, this represents an empty range
        if (hasStart && hasEnd && (0, byte_array_1.compare)(start, end) === 1) {
            this.iterators.set(newId, { data: [], position: 0 });
            return (0, byte_array_1.toByteArray)(newId);
        }
        const data = [];
        // we also create a temporary iterator so we just start from here
        let iter = hasStart ? this.dict.from(start) : this.dict;
        if (hasEnd) {
            iter = iter.takeUntil((_, key) => {
                return (0, byte_array_1.compare)(key, end) >= 0;
            });
        }
        // loop and filter
        iter.forEach((value, key) => {
            // different namespace
            if (filterKeyLength === 0 || key[0] !== 0 || filterKeyLength === key[1]) {
                data.push({ key, value });
            }
        });
        if (order === Order.Descending)
            data.reverse();
        this.iterators.set(newId, { data, position: 0 });
        return (0, byte_array_1.toByteArray)(newId);
    }
}
exports.BinaryKVIterStorage = BinaryKVIterStorage;
//# sourceMappingURL=storage.js.map