import { List, Map } from '@oraichain/immutable';
import { Result } from 'ts-results';
export type NeverImmutify = typeof NEVER_IMMUTIFY;
export declare const NEVER_IMMUTIFY = "__NEVER_IMMUTIFY__";
type Primitive = boolean | number | bigint | string | null | undefined | symbol;
type NoImmutify = Primitive | ArrayBuffer | ArrayBufferView | {
    [NEVER_IMMUTIFY]: any;
};
type Prefix<P, T extends any[]> = [P, ...T];
type First<T extends any[]> = T extends Prefix<infer F, any[]> ? F : never;
type Shift<T extends any[]> = T extends Prefix<any, infer R> ? R : [];
type Lens<T, P extends PropertyKey[]> = P extends Prefix<any, any[]> ? First<P> extends keyof T ? Shift<P> extends Prefix<any, any[]> ? Lens<T[First<P>], Shift<P>> : T[First<P>] : never : T;
type Immutify<T> = T extends NoImmutify ? T : T extends ArrayLike<infer E> ? List<Immutify<E>> : T extends Record<infer K, infer V> ? Map<K, Immutify<V>> : T;
type TxUpdater = (set: TxSetter) => void;
type TxSetter = (current: Map<unknown, unknown>) => Map<unknown, unknown>;
type LensSetter<T> = <P extends PropertyKey[]>(...path: P) => (value: Lens<T, P> | Immutify<Lens<T, P>>) => void;
type LensDeleter = <P extends PropertyKey[]>(...path: P) => void;
/** Transactional database underlying multi-module chain storage. */
export declare class Transactional {
    private _data;
    constructor(_data?: Map<unknown, unknown>);
    lens<M extends object>(...path: PropertyKey[]): TransactionalLens<M>;
    tx<R extends Result<any, any>>(cb: (update: TxUpdater) => Promise<R>): Promise<R>;
    tx<R extends Result<any, any>>(cb: (update: TxUpdater) => R): R;
    get data(): Map<unknown, unknown>;
}
export declare class TransactionalLens<M extends object> {
    readonly db: Transactional;
    readonly prefix: string[];
    constructor(db: Transactional, prefix: string[]);
    initialize(data: M): this;
    get<P extends PropertyKey[]>(...path: P): Immutify<Lens<M, P>>;
    getObject<P extends PropertyKey[]>(...path: P): Lens<M, P>;
    tx<R extends Result<any, any>>(cb: (setter: LensSetter<M>, deleter: LensDeleter) => Promise<R>): Promise<R>;
    tx<R extends Result<any, any>>(cb: (setter: LensSetter<M>, deleter: LensDeleter) => R): R;
    lens<P extends PropertyKey[]>(...path: P): TransactionalLens<Lens<M, P>>;
    get data(): Immutify<M>;
}
export declare function toImmutable(value: any): any;
export declare function fromImmutable(value: any): any;
export {};
//# sourceMappingURL=transactional.d.ts.map