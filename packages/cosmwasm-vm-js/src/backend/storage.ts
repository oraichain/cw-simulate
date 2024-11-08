import { fromBase64, toBase64 } from '@cosmjs/encoding';
import { compare, toByteArray, toNumber } from '../helpers/byte-array';
import Immutable from '@oraichain/immutable';

export interface IStorage {
  dict?: Immutable.Map<unknown, unknown>;

  get(key: Uint8Array): Uint8Array | null;

  set(key: Uint8Array, value: Uint8Array): void;

  remove(key: Uint8Array): void;

  keys(): Iterable<Uint8Array>;
}

export class Record {
  public key = Uint8Array.from([]);
  public value = Uint8Array.from([]);
}

export interface Iter {
  data: Array<Record>;
  position: number;
}

export enum Order {
  Ascending = 1,
  Descending = 2,
}

export interface IIterStorage extends IStorage {
  all(iterator_id: Uint8Array): Array<Record>;

  scan(
    start: Uint8Array | null,
    end: Uint8Array | null,
    order: Order
  ): Uint8Array;
  next(iterator_id: Uint8Array): Record | null;
}

export class BasicKVStorage implements IStorage {
  // TODO: Add binary uint / typed Addr maps for cw-storage-plus compatibility
  constructor(public dict: Immutable.Map<string, string> = Immutable.Map()) {}

  *keys() {
    for (const key of this.dict.keys()) {
      yield fromBase64(key);
    }
  }

  get(key: Uint8Array): Uint8Array | null {
    const keyStr = toBase64(key);
    const value = this.dict.get(keyStr);
    if (value === undefined) {
      return null;
    }

    return fromBase64(value);
  }

  set(key: Uint8Array, value: Uint8Array): void {
    const keyStr = toBase64(key);
    this.dict = this.dict.set(keyStr, toBase64(value));
  }

  remove(key: Uint8Array): void {
    this.dict = this.dict.remove(toBase64(key));
  }
}

export class BasicKVIterStorage extends BasicKVStorage implements IIterStorage {
  constructor(
    public dict: Immutable.Map<string, string> = Immutable.Map(),
    public iterators: Map<number, Iter> = new Map()
  ) {
    super(dict);
  }

  all(iterator_id: Uint8Array): Array<Record> {
    const out: Array<Record> = [];

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
  next(iterator_id: Uint8Array): Record | null {
    const iter = this.iterators.get(toNumber(iterator_id));
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

  scan(
    start: Uint8Array | null,
    end: Uint8Array | null,
    order: Order
  ): Uint8Array {
    if (!(order in Order)) {
      throw new Error(`Invalid order value ${order}.`);
    }
    const hasStart = start?.length;
    const hasEnd = end?.length;

    // if there is end namespace
    const filterKeyLength =
      hasStart && start[0] === 0
        ? start[1]
        : hasEnd && end[0] == 0
        ? end[1]
        : 0;

    const newId = this.iterators.size + 1;

    // if start > end, this represents an empty range
    if (hasStart && hasEnd && compare(start, end) === 1) {
      this.iterators.set(newId, { data: [], position: 0 });
      return toByteArray(newId);
    }

    let data: Record[] = [];
    for (const key of this.dict.keys()) {
      let keyArr = fromBase64(key);

      // out of range
      if (
        (hasStart && compare(keyArr, start) < 0) ||
        (hasEnd && compare(keyArr, end) >= 0)
      )
        continue;

      // different namespace
      if (
        filterKeyLength !== 0 &&
        keyArr[0] === 0 &&
        filterKeyLength !== keyArr[1]
      ) {
        continue;
      }

      data.push({ key: keyArr, value: this.get(keyArr)! });
    }

    data.sort((a, b) =>
      order === Order.Descending ? compare(b.key, a.key) : compare(a.key, b.key)
    );

    this.iterators.set(newId, { data, position: 0 });
    return toByteArray(newId);
  }
}

export class BinaryKVStorage implements IStorage {
  constructor(
    public dict: Immutable.SortedMap<
      Uint8Array,
      Uint8Array
    > = Immutable.SortedMap(compare)
  ) {}

  *keys() {
    for (const key of this.dict.keys()) {
      yield key;
    }
  }

  get(key: Uint8Array): Uint8Array | null {
    const value = this.dict.get(key);
    if (value === undefined) {
      return null;
    }
    return value;
  }

  set(key: Uint8Array, value: Uint8Array): void {
    this.dict = this.dict.set(new Uint8Array(key), new Uint8Array(value));
  }

  remove(key: Uint8Array): void {
    this.dict = this.dict.delete(new Uint8Array(key));
  }
}

export class BinaryKVIterStorage
  extends BinaryKVStorage
  implements IIterStorage
{
  constructor(
    dict?: Immutable.SortedMap<Uint8Array, Uint8Array>,
    public iterators: Map<number, Iter> = new Map()
  ) {
    super(dict);
  }

  all(iterator_id: Uint8Array): Array<Record> {
    const out: Array<Record> = [];

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
  next(iterator_id: Uint8Array): Record | null {
    const iter = this.iterators.get(toNumber(iterator_id));
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

  scan(
    start: Uint8Array | null,
    end: Uint8Array | null,
    order: Order
  ): Uint8Array {
    if (!(order in Order)) {
      throw new Error(`Invalid order value ${order}.`);
    }

    const hasStart = start !== null && start.length;
    const hasEnd = end !== null && end.length;

    // if there is end namespace
    const filterKeyLength =
      hasStart && start[0] === 0
        ? start[1]
        : hasEnd && end[0] == 0
        ? end[1]
        : 0;
    const newId = this.iterators.size + 1;

    // if start > end, this represents an empty range
    if (hasStart && hasEnd && compare(start, end) === 1) {
      this.iterators.set(newId, { data: [], position: 0 });
      return toByteArray(newId);
    }

    const data: Record[] = [];

    // we also create a temporary iterator so we just start from here
    let iter = hasStart ? this.dict.from(start) : this.dict;
    if (hasEnd) {
      iter = iter.takeUntil((_, key) => {
        return compare(key, end) >= 0;
      });
    }

    // loop and filter
    iter.forEach((value, key) => {
      // different namespace
      if (filterKeyLength === 0 || key[0] !== 0 || filterKeyLength === key[1]) {
        data.push({ key, value });
      }
    });

    if (order === Order.Descending) data.reverse();

    this.iterators.set(newId, { data, position: 0 });
    return toByteArray(newId);
  }
}
