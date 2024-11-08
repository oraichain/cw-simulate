"use strict";
// @ts-nocheck
Object.defineProperty(exports, "__esModule", { value: true });
const encoding_1 = require("@cosmjs/encoding");
const byte_array_1 = require("../helpers/byte-array");
const storage_1 = require("./storage");
let store = new storage_1.BasicKVIterStorage();
let binaryStore = new storage_1.BinaryKVIterStorage();
const n = 1000000;
let start = (0, byte_array_1.toByteArray)(n >> 1);
let stop = (0, byte_array_1.toByteArray)((n >> 1) + 10);
console.time('BasicKVIterStorage Insert');
for (let i = 0; i < n; ++i)
    store.set((0, byte_array_1.toByteArray)(i), (0, encoding_1.toAscii)(i.toString()));
console.timeEnd('BasicKVIterStorage Insert');
console.time('BinaryKVIterStorage Insert');
for (let i = 0; i < n; ++i)
    binaryStore.set((0, byte_array_1.toByteArray)(i), (0, encoding_1.toAscii)(i.toString()));
console.timeEnd('BinaryKVIterStorage Insert');
let ret;
console.time('BasicKVIterStorage Scan');
ret = store.all(store.scan(start, stop, storage_1.Order.Ascending));
console.timeEnd('BasicKVIterStorage Scan');
console.log(ret.map((record) => [
    (0, byte_array_1.toNumber)(record.key),
    Buffer.from(record.value).toString(),
]));
console.time('BinaryKVIterStorage Scan');
ret = binaryStore.all(binaryStore.scan(start, stop, storage_1.Order.Ascending));
console.timeEnd('BinaryKVIterStorage Scan');
console.log(ret.map((record) => [
    (0, byte_array_1.toNumber)(record.key),
    Buffer.from(record.value).toString(),
]));
//# sourceMappingURL=storage.bench.js.map