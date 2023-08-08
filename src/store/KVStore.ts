import { AbstractSortedSet } from '../sortedset';

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
  static count = false;
  private _set = new AbstractSortedSet({
    onInsertConflict: () => {
      throw new Error('Value already in set');
    },
    comparator: ([a], [b]) => {
      return memcmp(a, b);
    },
  });

  get(key: Uint8Array): Uint8Array {
    const result = this._set.findIterator([key]).value();
    if (result === undefined) {
      throw new Error('Key not found');
    }
    return result[1];
  }

  has(key: Uint8Array): boolean {
    return this._set.contains([key]);
  }

  set(key: Uint8Array, value: Uint8Array): void {
    this._set.insert([key, value]);
  }

  delete(key: Uint8Array): void {
    this._set.remove([key]);
  }

  iterator(start: Uint8Array, end: Uint8Array): Iterable<[Uint8Array, Uint8Array]> {
    let iter = start ? this._set.findIterator([start]) : this._set.beginIterator();
    const ret = [];
    while (true) {
      const item = iter.value();
      if (!item || (end && memcmp(item[0], end) >= 0)) break;
      ret.push(item);
      iter = iter.next();
    }
    return ret;
  }

  reverseIterator(start: Uint8Array, end: Uint8Array): Iterable<[Uint8Array, Uint8Array]> {
    let iter = end ? this._set.findIterator([end]).previous() : this._set.endIterator();
    const ret = [];
    while (true) {
      const item = iter.value();
      if (!item || memcmp(item[0], start) < 0) break;
      ret.push(item);
      iter = iter.previous();
    }
    return ret;
  }
}
