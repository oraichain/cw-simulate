import { readFileSync } from 'fs';
import path from 'path';
import { VMInstance } from '../src/instance';
import {
  BasicBackendApi,
  BinaryKVIterStorage,
  BasicQuerier,
  IBackend,
} from '../src/backend';

const wasmBytecode = readFileSync(
  path.resolve(__dirname, '..', 'testdata', 'v1.0', 'cosmwasm_vm_test.wasm')
);
const backend: IBackend = {
  backend_api: new BasicBackendApi('terra'),
  storage: new BinaryKVIterStorage(),
  querier: new BasicQuerier(),
};

const vm = new VMInstance(backend);
const mockEnv = {
  block: {
    height: 1337,
    time: '2000000000',
    chain_id: 'columbus-5',
  },
  contract: {
    address: 'terra14z56l0fp2lsf86zy3hty2z47ezkhnthtr9yq76',
  },
};

const mockInfo = {
  sender: 'terra1337xewwfv3jdjuz8e0nea9vd8dpugc0k2dcyt3',
  funds: [],
};

describe('CosmWasmVM', () => {
  it('instantiates', async () => {
    await vm.build(wasmBytecode);

    const json = vm.instantiate(mockEnv, mockInfo, { count: 20 });
    const actual = {
      ok: {
        attributes: [
          { key: 'method', value: 'instantiate' },
          {
            key: 'owner',
            value: 'terra1337xewwfv3jdjuz8e0nea9vd8dpugc0k2dcyt3',
          },
          { key: 'count', value: '20' },
        ],
        data: null,
        events: [],
        messages: [],
      },
    };
    expect(json).toEqual(actual);
  });

  it('execute', async () => {
    await vm.build(wasmBytecode);

    let json = vm.instantiate(mockEnv, mockInfo, { count: 20 });
    let currentGasUsed = vm.gasUsed;
    json = vm.execute(mockEnv, mockInfo, { increment: {} });
    console.log('gasUsed', vm.gasUsed - currentGasUsed);
    console.log(json);
    const actual = {
      ok: {
        attributes: [{ key: 'method', value: 'try_increment' }],
        data: null,
        events: [],
        messages: [],
      },
    };
    expect(json).toEqual(actual);
  });
});
