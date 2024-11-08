import Immutable from '@oraichain/immutable';
export interface IStorage {
    dict?: Immutable.Map<unknown, unknown>;
    get(key: Uint8Array): Uint8Array | null;
    set(key: Uint8Array, value: Uint8Array): void;
    remove(key: Uint8Array): void;
    keys(): Iterable<Uint8Array>;
}
export declare class Record {
    key: Uint8Array;
    value: Uint8Array;
}
export interface Iter {
    data: Array<Record>;
    position: number;
}
export declare enum Order {
    Ascending = 1,
    Descending = 2
}
export interface IIterStorage extends IStorage {
    all(iterator_id: Uint8Array): Array<Record>;
    scan(start: Uint8Array | null, end: Uint8Array | null, order: Order): Uint8Array;
    next(iterator_id: Uint8Array): Record | null;
}
export declare class BasicKVStorage implements IStorage {
    dict: Immutable.Map<string, string>;
    constructor(dict?: Immutable.Map<string, string>);
    keys(): Generator<Uint8Array, void, unknown>;
    get(key: Uint8Array): Uint8Array | null;
    set(key: Uint8Array, value: Uint8Array): void;
    remove(key: Uint8Array): void;
}
export declare class BasicKVIterStorage extends BasicKVStorage implements IIterStorage {
    dict: Immutable.Map<string, string>;
    iterators: Map<number, Iter>;
    constructor(dict?: Immutable.Map<string, string>, iterators?: Map<number, Iter>);
    all(iterator_id: Uint8Array): Array<Record>;
    next(iterator_id: Uint8Array): Record | null;
    scan(start: Uint8Array | null, end: Uint8Array | null, order: Order): Uint8Array;
}
export declare class BinaryKVStorage implements IStorage {
    dict: Immutable.SortedMap<Uint8Array, Uint8Array>;
    constructor(dict?: Immutable.SortedMap<Uint8Array, Uint8Array>);
    keys(): Generator<Uint8Array, void, unknown>;
    get(key: Uint8Array): Uint8Array | null;
    set(key: Uint8Array, value: Uint8Array): void;
    remove(key: Uint8Array): void;
}
export declare class BinaryKVIterStorage extends BinaryKVStorage implements IIterStorage {
    iterators: Map<number, Iter>;
    constructor(dict?: Immutable.SortedMap<Uint8Array, Uint8Array>, iterators?: Map<number, Iter>);
    all(iterator_id: Uint8Array): Array<Record>;
    next(iterator_id: Uint8Array): Record | null;
    scan(start: Uint8Array | null, end: Uint8Array | null, order: Order): Uint8Array;
}
//# sourceMappingURL=storage.d.ts.map