import { readFileSync } from 'fs';
import { VMInstance } from '../../src/instance';
import {
  BasicBackendApi,
  BinaryKVIterStorage,
  BasicQuerier,
  IBackend,
} from '../../src/backend';
import type { Env, MessageInfo } from '../../src/types';
import { parseBase64Response, wrapResult } from '../common/vm';
import { Environment } from '../../src';
import path from 'path';

const wasmBytecode = readFileSync(
  path.resolve(__dirname, '..', '..', 'testdata', 'v1.1', 'cyberpunk.wasm')
);
const backend: IBackend = {
  backend_api: new BasicBackendApi('terra'),
  storage: new BinaryKVIterStorage(),
  querier: new BasicQuerier(),
};

const creator = 'terra1337xewwfv3jdjuz8e0nea9vd8dpugc0k2dcyt3';

const mockEnv: Env = {
  block: {
    height: 1337,
    time: '2000000000',
    chain_id: 'columbus-5',
  },
  contract: { address: 'terra14z56l0fp2lsf86zy3hty2z47ezkhnthtr9yq76' },
  transaction: null,
};

const mockInfo: MessageInfo = {
  sender: creator,
  funds: [],
};

let vm: VMInstance;
describe('cyberpunk', () => {
  beforeEach(async () => {
    vm = new VMInstance(backend);
    await vm.build(wasmBytecode);
  });

  // port of https://github.com/CosmWasm/cosmwasm/blob/f6a0485088f1084379a5655bcc2956526290c09f/contracts/cyberpunk/tests/integration.rs#L30
  it.skip('execute_argon2', async () => {
    // gas limit not implemented
    // Arrange
    const env = new Environment(backend.backend_api, 100_000_000_000_000);
    vm = new VMInstance(backend, env);
    const initRes = vm.instantiate(mockEnv, mockInfo, {}) as any;
    expect(initRes.messages.length).toStrictEqual(0);

    const gasBefore = vm.remainingGas;

    // Act
    const executeRes = vm.execute(mockEnv, mockInfo, {
      mem_cost: 256,
      time_cost: 5,
    });

    // Assert
    // TODO
  });

  it('test_env', async () => {
    // Arrange
    const initRes = wrapResult(vm.instantiate(mockEnv, mockInfo, {})).unwrap();
    expect(initRes.messages.length).toStrictEqual(0);

    // Act 1
    const res = wrapResult(
      vm.execute(mockEnv, mockInfo, { mirror_env: {} })
    ).unwrap();

    // Assert 1
    expect(res.data).toBeDefined();
    let receivedEnv = parseBase64Response(res.data);
    expect(receivedEnv).toEqual(mockEnv);

    // Act 2
    const data = wrapResult(vm.query(mockEnv, { mirror_env: {} })).unwrap();
    receivedEnv = parseBase64Response(data);
    expect(receivedEnv).toEqual(mockEnv);
  });
});
