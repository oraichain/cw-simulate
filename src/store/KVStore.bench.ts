import { Map } from 'immutable';
import { fromBase64, toAscii, toBase64 } from '@cosmjs/encoding';
import { KVStore as NativeKVStore } from './KVStore';

function memcmp(a: Uint8Array, b: Uint8Array): number {
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i++) {
    const diff = a[i] - b[i];
    if (diff !== 0) {
      return diff;
    }
  }
  return a.length - b.length;
}

export interface IKVStore {
  get(key: Uint8Array): Uint8Array;
  has(key: Uint8Array): boolean;
  set(key: Uint8Array, value: Uint8Array): void;
  delete(key: Uint8Array): void;
  iterator(start: Uint8Array, end: Uint8Array): Iterable<[Uint8Array, Uint8Array]>;
  reverseIterator(start: Uint8Array, end: Uint8Array): Iterable<[Uint8Array, Uint8Array]>;
}

export class KVStore implements IKVStore {
  private _table: Map<string, string> = Map();

  static _enc(key: Uint8Array): string {
    return toBase64(key);
  }

  static _dec(key: string): Uint8Array {
    return fromBase64(key);
  }

  get(key: Uint8Array): Uint8Array {
    let keyBz = KVStore._enc(key);
    let result = this._table.get(keyBz);
    if (result === undefined) {
      throw new Error('Key not found');
    }
    return KVStore._dec(result);
  }

  has(key: Uint8Array): boolean {
    let keyBz = KVStore._enc(key);
    return this._table.has(keyBz);
  }

  set(key: Uint8Array, value: Uint8Array): void {
    let keyBz = KVStore._enc(key);
    let valueBz = KVStore._enc(value);
    this._table = this._table.set(keyBz, valueBz);
  }

  delete(key: Uint8Array): void {
    let keyBz = KVStore._enc(key);
    this._table = this._table.remove(keyBz);
  }

  iterator(start: Uint8Array, end: Uint8Array): Iterable<[Uint8Array, Uint8Array]> {
    return this._table
      .entrySeq()
      .map(([key, value]) => [KVStore._dec(key), KVStore._dec(value)] as [Uint8Array, Uint8Array])
      .filter(([key, _]) => memcmp(key, start) >= 0 && memcmp(key, end) < 0);
  }

  reverseIterator(start: Uint8Array, end: Uint8Array): Iterable<[Uint8Array, Uint8Array]> {
    return this._table
      .entrySeq()
      .map(([key, value]) => [KVStore._dec(key), KVStore._dec(value)] as [Uint8Array, Uint8Array])
      .filter(([key, _]) => memcmp(key, start) >= 0 && memcmp(key, end) < 0)
      .reverse();
  }
}

let start = toAscii('1000');
let stop = toAscii('1010');
let store = new KVStore();
let store1 = new NativeKVStore();
for (let i = 0; i < 10000; ++i) store.set(toAscii(i.toString()), toAscii(i.toString()));
for (let i = 0; i < 10000; ++i) store1.set(toAscii(i.toString()), toAscii(i.toString()));

console.time('ImmutableSortedSet');
for (let i = 0; i < 100; ++i) [...store1.reverseIterator(start, stop)];
console.timeLog(
  'ImmutableSortedSet',
  [...store1.reverseIterator(start, stop)].map(([k, v]) => [Buffer.from(k).toString(), Buffer.from(v).toString()])
);

console.time('ImmutableMap');
for (let i = 0; i < 100; ++i) [...store.iterator(start, stop)].sort().reverse();
console.timeLog(
  'ImmutableMap',
  [...store.iterator(start, stop)]
    .sort()
    .reverse()
    .map(([k, v]) => [Buffer.from(k).toString(), Buffer.from(v).toString()])
);
