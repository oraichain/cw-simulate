import { sha256 } from '@cosmjs/crypto';
import { fromHex, toHex } from '@cosmjs/encoding';
import fs from 'fs';
import { SimulateCosmWasmClient } from './SimulateCosmWasmClient';
import { instantiate2Address } from '@cosmjs/cosmwasm-stargate';

const bytecode = fs.readFileSync('./testing/hello_world-aarch64.wasm');
const sender = 'orai12zyu8w93h0q2lcnt50g3fn0w3yqnhy4fvawaqz';

describe('SimulateCosmWasmClient', () => {
  it('works', async () => {
    {
      const client = new SimulateCosmWasmClient({
        chainId: 'Oraichain',
        bech32Prefix: 'orai',
        metering: true,
      });

      const { codeId } = await client.upload(sender, bytecode, 'auto');

      const { contractAddress } = await client.instantiate(sender, codeId, { count: 10 }, '', 'auto');
      console.log(contractAddress);

      const result = await client.execute(
        sender,
        contractAddress,
        {
          increment: {},
        },
        'auto'
      );

      console.log(result);

      expect(result.events[0].attributes[0].value).toEqual(contractAddress);

      expect(await client.queryContractSmart(contractAddress, { get_count: {} })).toEqual({ count: 11 });

      const bytes = client.toBytes();
      const clientRestore = await SimulateCosmWasmClient.from(bytes);

      const codes = await clientRestore.getCodes();
      expect(codes).toEqual([
        {
          id: codeId,
          creator: sender,
          checksum: toHex(sha256(bytecode)),
        },
      ]);
    }
  });

  it('instantiate2', async () => {
    {
      const client = new SimulateCosmWasmClient({
        chainId: 'Oraichain',
        bech32Prefix: 'orai',
        metering: true,
      });

      const { codeId } = await client.upload(sender, bytecode, 'auto');
      const { checksum } = await client.getCodeDetails(codeId);
      const salt = Buffer.allocUnsafe(8);
      crypto.getRandomValues(salt);
      const predictContractAddress = instantiate2Address(fromHex(checksum), sender, salt, client.app.bech32Prefix);
      const { contractAddress } = await client.instantiate2(sender, codeId, salt, { count: 10 }, '', 'auto');
      expect(contractAddress).toEqual(predictContractAddress);

      const result = await client.execute(
        sender,
        contractAddress,
        {
          increment: {},
        },
        'auto'
      );

      console.log(result);

      expect(result.events[0].attributes[0].value).toEqual(contractAddress);

      expect(await client.queryContractSmart(contractAddress, { get_count: {} })).toEqual({ count: 11 });

      const bytes = client.toBytes();
      const clientRestore = await SimulateCosmWasmClient.from(bytes);

      const codes = await clientRestore.getCodes();
      expect(codes).toEqual([
        {
          id: codeId,
          creator: sender,
          checksum: toHex(sha256(bytecode)),
        },
      ]);
    }
  });
});
