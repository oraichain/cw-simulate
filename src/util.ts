import { Err, Ok, Result } from 'ts-results';
import { RustResult, DebugLog } from './types';
import { sha256 } from '@cosmjs/crypto';
import { toHex } from '@cosmjs/encoding';

export const isArrayLike = (value: any): value is any[] =>
  typeof value === 'object' && typeof value.length === 'number';

export function fromRustResult<T>(res: RustResult<T>): Result<T, string>;
export function fromRustResult<T>(res: any): Result<T, string>;
export function fromRustResult<T>(res: any): Result<T, string> {
  if ('ok' in res) {
    return Ok(res.ok);
  } else if (typeof res.error === 'string') {
    return Err(res.error);
  } else throw new Error('Invalid RustResult type');
}
export function toRustResult<T>(res: Result<T, string>): RustResult<T> {
  if (res.ok) {
    return { ok: res.val };
  } else {
    return { error: res.val as string };
  }
}

export const isRustResult = <T = unknown>(value: any): value is RustResult<T> => 'ok' in value || 'err' in value;
export const isTSResult = <T = unknown, E = string>(value: any): value is Result<T, E> =>
  typeof value.ok === 'boolean' && typeof value.err === 'boolean' && 'val' in value;

export const getTransactionHash = (height: number, data: any, encoding?: BufferEncoding) => {
  const buf = Buffer.from(JSON.stringify({ data, height }), encoding);
  return toHex(sha256(buf));
};

// debug debug print
export const printDebug = (log: DebugLog) => {
  if (log.type === 'print') {
    console.log(log.message);
  }
};
