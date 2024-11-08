// @ts-nocheck

import { toAscii } from '@cosmjs/encoding';
import { toByteArray, toNumber } from '../helpers/byte-array';
import { BasicKVIterStorage, BinaryKVIterStorage, Order } from './storage';

let store = new BasicKVIterStorage();
let binaryStore = new BinaryKVIterStorage();
const n = 1000000;
let start = toByteArray(n >> 1);
let stop = toByteArray((n >> 1) + 10);

console.time('BasicKVIterStorage Insert');
for (let i = 0; i < n; ++i) store.set(toByteArray(i), toAscii(i.toString()));
console.timeEnd('BasicKVIterStorage Insert');
console.time('BinaryKVIterStorage Insert');
for (let i = 0; i < n; ++i)
  binaryStore.set(toByteArray(i), toAscii(i.toString()));
console.timeEnd('BinaryKVIterStorage Insert');

let ret;
console.time('BasicKVIterStorage Scan');
ret = store.all(store.scan(start, stop, Order.Ascending));
console.timeEnd('BasicKVIterStorage Scan');
console.log(
  ret.map((record) => [
    toNumber(record.key),
    Buffer.from(record.value).toString(),
  ])
);

console.time('BinaryKVIterStorage Scan');
ret = binaryStore.all(binaryStore.scan(start, stop, Order.Ascending));
console.timeEnd('BinaryKVIterStorage Scan');
console.log(
  ret.map((record) => [
    toNumber(record.key),
    Buffer.from(record.value).toString(),
  ])
);
