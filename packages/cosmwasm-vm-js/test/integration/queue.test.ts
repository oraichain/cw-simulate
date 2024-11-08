import { readFileSync } from 'fs';
import { VMInstance } from '../../src/instance';
import {
  BasicBackendApi,
  BasicQuerier,
  IBackend,
  BinaryKVIterStorage,
} from '../../src/backend';
import { expectResponseToBeOk, parseBase64Response } from '../common/vm';
import { Environment } from '../../src';
import path from 'path';

const wasmBytecode = readFileSync(
  path.resolve(__dirname, '..', '..', 'testdata', 'v1.1', 'queue.wasm')
);

const creator = 'creator';
const mockContractAddr = 'cosmos2contract';

const mockEnv = {
  block: {
    height: 12345,
    time: '1571797419879305533',
    chain_id: 'cosmos-testnet-14002',
  },
  contract: { address: mockContractAddr },
};

const mockInfo: { sender: string; funds: { amount: string; denom: string }[] } =
  {
    sender: creator,
    funds: [],
  };

let vm: VMInstance;
describe('queue', () => {
  beforeEach(async () => {
    const backend: IBackend = {
      backend_api: new BasicBackendApi('terra'),
      storage: new BinaryKVIterStorage(),
      querier: new BasicQuerier(),
    };
    const env = new Environment(backend.backend_api, 100_000_000_000_000);
    vm = new VMInstance(backend, env);
    await vm.build(wasmBytecode);
  });

  it('instantiate_and_query', async () => {
    // Arrange
    const instantiateResponse = vm.instantiate(mockEnv, mockInfo, {});

    // Act
    const countResponse = vm.query(mockEnv, { count: {} });
    const sumResponse = vm.query(mockEnv, { sum: {} });

    // Assert
    expect((instantiateResponse as any).ok.messages.length).toBe(0);

    expectResponseToBeOk(countResponse);
    expect(parseBase64OkResponse(countResponse)).toEqual({ count: 0 });

    expectResponseToBeOk(sumResponse);
    expect(parseBase64OkResponse(sumResponse)).toEqual({ sum: 0 });
  });

  it('push_and_query', () => {
    // Arrange
    vm.instantiate(mockEnv, mockInfo, {});

    // Act
    vm.execute(mockEnv, mockInfo, { enqueue: { value: 25 } });

    // Assert
    const countResponse = vm.query(mockEnv, { count: {} });
    expect(parseBase64OkResponse(countResponse)).toEqual({ count: 1 });

    const sumResponse = vm.query(mockEnv, { sum: {} });
    expect(parseBase64OkResponse(sumResponse)).toEqual({ sum: 25 });
  });

  it('multiple_push', () => {
    // Arrange
    vm.instantiate(mockEnv, mockInfo, {});

    // Act
    vm.execute(mockEnv, mockInfo, { enqueue: { value: 25 } });
    vm.execute(mockEnv, mockInfo, { enqueue: { value: 35 } });
    vm.execute(mockEnv, mockInfo, { enqueue: { value: 45 } });

    // Assert
    const countResponse = vm.query(mockEnv, { count: {} });
    expect(parseBase64OkResponse(countResponse)).toEqual({ count: 3 });

    const sumResponse = vm.query(mockEnv, { sum: {} });
    expect(parseBase64OkResponse(sumResponse)).toEqual({ sum: 105 });
  });

  it('push_and_pop', () => {
    // Arrange
    vm.instantiate(mockEnv, mockInfo, {});
    vm.execute(mockEnv, mockInfo, { enqueue: { value: 25 } });
    vm.execute(mockEnv, mockInfo, { enqueue: { value: 17 } });

    // Act
    const dequeueResponse = vm.execute(mockEnv, mockInfo, { dequeue: {} });

    // Assert
    expect(parseBase64Response((dequeueResponse as any).ok.data)).toEqual({
      value: 25,
    });

    const countResponse = vm.query(mockEnv, { count: {} });
    expect(parseBase64OkResponse(countResponse)).toEqual({ count: 1 });

    const sumResponse = vm.query(mockEnv, { sum: {} });
    expect(parseBase64OkResponse(sumResponse)).toEqual({ sum: 17 });
  });

  it('push_and_reduce', () => {
    // Arrange
    vm.instantiate(mockEnv, mockInfo, {});
    vm.execute(mockEnv, mockInfo, { enqueue: { value: 40 } });
    vm.execute(mockEnv, mockInfo, { enqueue: { value: 15 } });
    vm.execute(mockEnv, mockInfo, { enqueue: { value: 85 } });
    vm.execute(mockEnv, mockInfo, { enqueue: { value: -10 } });

    // Act
    const reducerResponse = vm.query(mockEnv, { reducer: {} });

    // Assert
    expect(parseBase64OkResponse(reducerResponse).counters).toStrictEqual([
      [40, 85],
      [15, 125],
      [85, 0],
      [-10, 140],
    ]);
  });

  it('migrate_works', () => {
    // Arrange
    vm.instantiate(mockEnv, mockInfo, {});
    vm.execute(mockEnv, mockInfo, { enqueue: { value: 25 } });
    vm.execute(mockEnv, mockInfo, { enqueue: { value: 17 } });

    // Act
    const migrateResponse = vm.migrate(mockEnv, {});

    // Assert
    expect((migrateResponse as any).ok.messages.length).toEqual(0);

    const countResponse = vm.query(mockEnv, { count: {} });
    expect(parseBase64OkResponse(countResponse)).toEqual({ count: 3 });

    const sumResponse = vm.query(mockEnv, { sum: {} });
    expect(parseBase64OkResponse(sumResponse)).toEqual({ sum: 303 });
  });

  it('query_list', () => {
    // Arrange
    vm.instantiate(mockEnv, mockInfo, {});

    for (let i = 0; i < 37; i++) {
      vm.execute(mockEnv, mockInfo, { enqueue: { value: 40 } });
    }

    for (let i = 0; i < 25; i++) {
      vm.execute(mockEnv, mockInfo, { dequeue: {} });
    }

    // Act
    const listResponse = vm.query(mockEnv, { list: {} });

    // Assert
    const countResponse = vm.query(mockEnv, { count: {} });
    expect(parseBase64OkResponse(countResponse)).toEqual({ count: 12 });

    const list = parseBase64OkResponse(listResponse);

    expect(list.empty).toStrictEqual([]);
    expect(list.early).toStrictEqual([25, 26, 27, 28, 29, 30, 31]);
    expect(list.late).toStrictEqual([32, 33, 34, 35, 36]);
  });

  it('query_open_iterators', async () => {
    // Arrange
    vm.instantiate(mockEnv, mockInfo, {});

    // Act
    const response1 = vm.query(mockEnv, { open_iterators: { count: 1 } });
    const response2 = vm.query(mockEnv, { open_iterators: { count: 2 } });
    const response3 = vm.query(mockEnv, { open_iterators: { count: 321 } });

    // Assert
    expectResponseToBeOk(response1);
    expectResponseToBeOk(response2);
    expectResponseToBeOk(response3);
  });
});

// Helpers

function parseBase64OkResponse(json: object): any {
  const data = (json as { ok: string }).ok;
  if (!data) {
    throw new Error(
      `Response indicates an error state: ${JSON.stringify(json)}`
    );
  }

  return parseBase64Response(data);
}
