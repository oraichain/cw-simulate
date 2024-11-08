import { Result } from 'ts-results';
import { RustResult, DebugLog } from './types';
export declare const isArrayLike: (value: any) => value is any[];
export declare function fromRustResult<T>(res: RustResult<T>): Result<T, string>;
export declare function fromRustResult<T>(res: any): Result<T, string>;
export declare function toRustResult<T>(res: Result<T, string>): RustResult<T>;
export declare const isRustResult: <T = unknown>(value: any) => value is RustResult<T>;
export declare const isTSResult: <T = unknown, E = string>(value: any) => value is Result<T, E>;
export declare const getTransactionHash: (height: number, data: any, encoding?: BufferEncoding) => string;
export declare const printDebug: (log: DebugLog) => void;
//# sourceMappingURL=util.d.ts.map