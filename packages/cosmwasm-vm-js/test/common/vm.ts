import { fromAscii, fromBase64 } from '@cosmjs/encoding';
import { readFileSync } from 'fs';
import {
  VMInstance,
  IBackend,
  BasicBackendApi,
  BinaryKVIterStorage,
  BasicQuerier,
  Region,
} from '../../src';
import { KEY1, VALUE1, KEY2, VALUE2 } from './data';
import path from 'path';

export function wrapResult(res: any) {
  if (res instanceof Region) res = res.json;

  if (typeof res !== 'object') throw new Error('StdResult is not an object');

  const isOk = !!res.ok;
  return {
    isOk,
    isErr: !isOk,
    unwrap: () => res.ok,
    unwrap_err: () => res.err,
  };
}

export const createVM = async (): Promise<VMInstance> => {
  const wasmByteCode = readFileSync(
    path.resolve(__dirname, '..', '..', 'testdata', 'v1.0', 'hackatom.wasm')
  );
  const backend: IBackend = {
    backend_api: new BasicBackendApi('terra'),
    storage: new BinaryKVIterStorage(),
    querier: new BasicQuerier(),
  };

  const vm = new VMInstance(backend);
  vm.backend.storage.set(KEY1, VALUE1);
  vm.backend.storage.set(KEY2, VALUE2);

  await vm.build(wasmByteCode);
  return vm;
};

export const writeData = (vm: VMInstance, data: Uint8Array): Region => {
  return vm.allocate_bytes(data);
};

export const writeObject = (vm: VMInstance, data: [Uint8Array]): Region => {
  return vm.allocate_json(data);
};

export function parseBase64Response(data: string): any {
  let bytes: Uint8Array;
  try {
    bytes = fromBase64(data);
  } catch (_) {
    throw new Error(
      `Data value is not base64-encoded: ${JSON.stringify(data)}`
    );
  }

  let str: string;
  try {
    str = fromAscii(bytes);
  } catch (_) {
    throw new Error(
      `Data value is not ASCII encoded: ${JSON.stringify(bytes)}`
    );
  }

  try {
    return JSON.parse(str);
  } catch (_) {
    throw new Error(`Data value is not valid JSON: ${str}`);
  }
}

export function expectResponseToBeOk(json: object) {
  try {
    expect((json as { ok: string }).ok).toBeDefined();
  } catch (_) {
    throw new Error(
      `Expected response to be ok; instead got: ${JSON.stringify(json)}`
    );
  }
}
