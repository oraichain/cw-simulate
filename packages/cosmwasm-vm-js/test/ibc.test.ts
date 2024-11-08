import { readFileSync } from 'fs';
import path from 'path';
import { BinaryKVIterStorage, VMInstance } from '../src';
import { BasicBackendApi, BasicQuerier, IBackend } from '../src/backend';

const wasmByteCode = readFileSync(
  path.resolve(__dirname, '..', 'testdata', 'v1.1', 'ibc_reflect.wasm')
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
  it('reply', async () => {
    await vm.build(wasmByteCode);

    let region = vm.instantiate(mockEnv, mockInfo, { reflect_code_id: 101 });
    expect('ok' in region).toBeTruthy();

    region = vm.ibc_channel_open(mockEnv, {
      open_init: {
        channel: {
          endpoint: {
            port_id: 'my_port',
            channel_id: 'channel-0',
          },
          counterparty_endpoint: {
            port_id: 'their_port',
            channel_id: 'channel-7',
          },
          order: 'ORDER_ORDERED',
          version: 'ibc-reflect-v1',
          connection_id: 'connection-2',
        },
      },
    });

    expect('ok' in region).toBeTruthy();
  });
});
