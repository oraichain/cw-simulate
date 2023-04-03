import fs from 'fs';
import { SimulateCosmWasmClient } from './SimulateCosmWasmClient';

const bytecode = fs.readFileSync('./testing/cw_simulate_tests-aarch64.wasm');

describe('SimulateCosmWasmClient', () => {
  it('works', async () => {
    {
      const client = new SimulateCosmWasmClient({
        chainId: 'Oraichain',
        bech32Prefix: 'orai',
      });

      const { codeId } = await client.upload('alice', bytecode, 'auto');

      const { contractAddress } = await client.instantiate('alice', codeId, {}, '', 'auto');

      const result = await client.execute(
        'alice',
        contractAddress,
        {
          debug: { msg: 'foobar' },
        },
        'auto'
      );
      expect(result.events[0].attributes[0].value).toEqual(contractAddress);
    }
  });
});
