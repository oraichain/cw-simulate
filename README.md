# `cw-simulate`

This package combines `cosmwasm-vm-js` with additional abstractions and state management to
more accurately simulate the effects of CosmWasm contracts on the blockchain environments on which
they are hosted.

## Features

- configure multiple host chain environments with chain-specific settings / state
- multiple simultaneous contract instances can exist per chain
- chain modules can be simulated through custom user code
- Simulating block creation
- [extensible for further instrumentation via custom middlewares](#ibc-mocks-with-opening-channels-and-receiving-ibc-messages)
- [Simulating IBC states](#ibc-mocks-with-opening-channels-and-receiving-ibc-messages)
- [Gas simulation](#cosmwasm-contract-interaction)
- [Simulating address native balances](#manipulate-native-balances).
- [Download current contract states on the mainnet for simulation](#load-fork-state-from-mainnet)

## Getting Started

Import the `cw-simulate` library from NPM in your `package.json`.

```bash
$ npm install "@oraichain/cw-simulate" --save-dev
```

If you're using Yarn:

```bash
$ yarn add "@oraichain/cw-simulate" -D
```

## Usage

1. Create a `SimulateCosmWasmClient` object - this is a simulation environment describing a single chain that extends SigningCosmWasmClient.
2. As needed, per chain:
   - Upload the WASM bytecode using `client.update`. This will register a new `codeId` to reference the uploaded contract code.
   - Create a new contract instance using `client.instantiate`, passing in the `codeId` generated in the previous step.
   - From the response, retrieve the `contractAddress` to refer to the contract instance.

- You can now run `execute` and `query` messages against the instance, and they should work as expected.

3. As needed:
   - Mint, burn, set native balances for addresses.
   - Create IBC channels and invoke IBC receive messages.
   - Fork contract states at a given height, called A, and apply cosmwasm txs from height A to height B for testing and debugging.

## Examples

Below are `cw-simulate` examples that simulate CosmWasm, bank, and IBC modules. If you want us to support another type of module, please create an issue request!

### CosmWasm Contract Interaction

```ts
import { sha256 } from '@cosmjs/crypto';
import { fromHex, toHex } from '@cosmjs/encoding';
import fs from 'fs';
import { SimulateCosmWasmClient } from './SimulateCosmWasmClient';
import { instantiate2Address } from '@cosmjs/cosmwasm-stargate';

// import the wasm bytecode
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

      // deploy
      const { codeId } = await client.upload(sender, bytecode, 'auto');
      const { contractAddress } = await client.instantiate(sender, codeId, { count: 10 }, '', 'auto');
      console.log(contractAddress);

      // execute the contract
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
      // query
      expect(await client.queryContractSmart(contractAddress, { get_count: {} })).toEqual({ count: 11 });
    }
  });
});
```

### IBC mocks with opening channels and receiving IBC messages

```ts
import { coin, coins } from '@cosmjs/amino';
import { fromBinary, toBinary } from '@cosmjs/cosmwasm-stargate';
import { fromBech32, toBech32 } from '@cosmjs/encoding';
import { CosmosMsg, IbcMsgTransfer } from '@oraichain/cosmwasm-vm-js';
import { readFileSync } from 'fs';
import path from 'path';
import { CWSimulateApp } from '../CWSimulateApp';
import { AppResponse, IbcOrder } from '../types';
import { ibcDenom } from './ibc';

const terraChain = new CWSimulateApp({
  chainId: 'test-1',
  bech32Prefix: 'terra',
});
const oraiChain = new CWSimulateApp({
  chainId: 'Oraichain',
  bech32Prefix: 'orai',
});
const oraiSenderAddress = 'orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g';
const bobAddress = 'orai1ur2vsjrjarygawpdwtqteaazfchvw4fg6uql76';
const terraSenderAddress = toBech32(terraChain.bech32Prefix, fromBech32(oraiSenderAddress).data);

describe.only('IBCModule', () => {
  let oraiPort: string;
  let terraPort: string = 'transfer';
  let contractAddress: string;
  beforeEach(async () => {
    const reflectCodeId = oraiChain.wasm.create(
      oraiSenderAddress,
      readFileSync(path.join(__dirname, '..', '..', 'testing', 'reflect.wasm'))
    );
    const ibcReflectCodeId = oraiChain.wasm.create(
      oraiSenderAddress,
      readFileSync(path.join(__dirname, '..', '..', 'testing', 'ibc_reflect.wasm'))
    );

    const oraiRet = await oraiChain.wasm.instantiateContract(
      oraiSenderAddress,
      [],
      ibcReflectCodeId,
      { reflect_code_id: reflectCodeId },
      'ibc-reflect'
    );
    contractAddress = (oraiRet.val as AppResponse).events[0].attributes[0].value;
    oraiPort = 'wasm.' + contractAddress;
  });

  it('handle-reflect', async () => {
    oraiChain.ibc.relay('channel-0', oraiPort, 'channel-0', terraPort, terraChain);
    expect(oraiPort).toEqual(oraiChain.ibc.getContractIbcPort(contractAddress));
    const channelOpenRes = await terraChain.ibc.sendChannelOpen({
      open_init: {
        channel: {
          counterparty_endpoint: {
            port_id: oraiPort,
            channel_id: 'channel-0',
          },
          endpoint: {
            port_id: terraPort,
            channel_id: 'channel-0',
          },
          order: IbcOrder.Ordered,
          version: 'ibc-reflect-v1',
          connection_id: 'connection-0',
        },
      },
    });
    expect(channelOpenRes).toEqual({ version: 'ibc-reflect-v1' });

    const channelConnectRes = await terraChain.ibc.sendChannelConnect({
      open_ack: {
        channel: {
          counterparty_endpoint: {
            port_id: oraiPort,
            channel_id: 'channel-0',
          },
          endpoint: {
            port_id: terraPort,
            channel_id: 'channel-0',
          },
          order: IbcOrder.Ordered,
          version: 'ibc-reflect-v1',
          connection_id: 'connection-0',
        },
        counterparty_version: 'ibc-reflect-v1',
      },
    });

    expect(channelConnectRes.attributes).toEqual([
      { key: 'action', value: 'ibc_connect' },
      { key: 'channel_id', value: 'channel-0' },
    ]);

    // get reflect address
    let packetReceiveRes = await terraChain.ibc.sendPacketReceive({
      packet: {
        data: toBinary({
          who_am_i: {},
        }),
        src: {
          port_id: terraPort,
          channel_id: 'channel-0',
        },
        dest: {
          port_id: oraiPort,
          channel_id: 'channel-0',
        },
        sequence: terraChain.ibc.sequence++,
        timeout: {
          block: {
            revision: 1,
            height: terraChain.height,
          },
        },
      },
      relayer: terraSenderAddress,
    });
    const res = fromBinary(packetReceiveRes.acknowledgement) as { ok: { account: string } };
    const reflectContractAddress = res.ok.account;
    expect(reflectContractAddress).toEqual(oraiChain.wasm.getContracts()[1].address);
    // set some balance for reflect contract
    oraiChain.bank.setBalance(reflectContractAddress, coins('500000000000', 'orai'));

    // send message to bob on oraichain
    packetReceiveRes = await terraChain.ibc.sendPacketReceive({
      packet: {
        data: toBinary({
          dispatch: {
            msgs: [
              <CosmosMsg>{
                bank: {
                  send: {
                    to_address: bobAddress,
                    amount: coins(123456789, 'orai'),
                  },
                },
              },
            ],
          },
        }),
        src: {
          port_id: terraPort,
          channel_id: 'channel-0',
        },
        dest: {
          port_id: oraiPort,
          channel_id: 'channel-0',
        },
        sequence: terraChain.ibc.sequence++,
        timeout: {
          block: {
            revision: 1,
            height: terraChain.height,
          },
        },
      },
      relayer: terraSenderAddress,
    });
  });
});
```

### Manipulate native balances

```ts
import { BankMsg } from '@oraichain/cosmwasm-vm-js';
import { cmd, exec, TestContract } from '../../testing/wasm-util';
import { CWSimulateApp } from '../CWSimulateApp';
import { BankQuery } from './bank';

type WrappedBankMsg = {
  bank: BankMsg;
};

const coin = (denom: string, amount: string | number) => ({ denom, amount: `${amount}` });

describe.only('BankModule', () => {
  let chain: CWSimulateApp;

  beforeEach(function () {
    chain = new CWSimulateApp({
      chainId: 'test-1',
      bech32Prefix: 'terra',
    });
  });

  it('handle send', () => {
    // Arrange
    const bank = chain.bank;
    // Set balance to arbitrary address
    bank.setBalance('alice', [coin('foo', 1000)]);

    // Can also send to other addresses
    bank.send('alice', 'bob', [coin('foo', 100)]).unwrap();

    // Assert
    expect(bank.getBalance('alice')).toEqual([coin('foo', 900)]);
    expect(bank.getBalance('bob')).toEqual([coin('foo', 100)]);
    expect(bank.getBalances()).toEqual({
      alice: [coin('foo', 900)],
      bob: [coin('foo', 100)],
    });
  });
});
```

### Load fork state from mainnet

```ts
import { DownloadState } from '@oraichain/cw-simulate';
const downloadState = new DownloadState('https://rpc.orai.io', path.resolve(__dirname, 'data'));
await downloadState.loadState(client, senderAddress, contractAddress, 'label');
```

### Fork contract states and apply production cosmwasm txs for testing and debugging

Besides downloading production contract states, you can also download states from a custom chain height, called A and apply cosmwasm txs from height A to B. Instead of spending hours forking the entire chain, it only take a few seconds to replay your production transactions.

Below is an example from a [demo file](./src/sync-test.ts) that demonstrates the power of cw-simulate:

```ts
import { resolve } from 'path';
import { SyncState } from './sync';
import dotenv from 'dotenv';
import { COSMOS_CHAIN_IDS, ORAI } from '@oraichain/common';
dotenv.config();

const SENDER = 'orai1hvr9d72r5um9lvt0rpkd4r75vrsqtw6yujhqs2';

(async () => {
  const startHeight = 36975366;
  const endHeight = 36975369;
  const syncState = new SyncState(
    SENDER,
    { rpc: process.env.RPC ?? 'https://rpc.orai.io', chainId: COSMOS_CHAIN_IDS.ORAICHAIN, bech32Prefix: ORAI },
    resolve(__dirname, '../', 'data')
  );
  const relatedContracts = [
    'orai12sxqkgsystjgd9faa48ghv3zmkfqc6qu05uy20mvv730vlzkpvls5zqxuz',
    'orai1wuvhex9xqs3r539mvc6mtm7n20fcj3qr2m0y9khx6n5vtlngfzes3k0rq9',
    'orai1rdykz2uuepxhkarar8ql5ajj5j37pq8h8d4zarvgx2s8pg0af37qucldna',
    'orai1yglsm0u2x3xmct9kq3lxa654cshaxj9j5d9rw5enemkkkdjgzj7sr3gwt0',
  ];

  const customWasmCodePaths = {
    orai12sxqkgsystjgd9faa48ghv3zmkfqc6qu05uy20mvv730vlzkpvls5zqxuz: resolve(
      __dirname,
      '../',
      'data',
      startHeight.toString(),
      'cw-app-bitcoin.wasm'
    ),
  };

  const { results, simulateClient } = await syncState.sync(
    startHeight,
    endHeight,
    relatedContracts,
    customWasmCodePaths
  );
  console.dir(results, { depth: null });
})();
```

1. Firstly, we initialize a `SyncState` instance, passing several basic arguments, from contract admins, chain infos, and the location to store contract states.
2. The next and final step is to call the `sync()` method, which allows us to fork and apply txs from `startheight` to `endHeight`. `relatedContracts` are a set of related contracts that are used during the syncing process. `customWasmCodePaths` is a Map, where `key` is the contract address, and `value` is the path to that contract's wasm code. If left empty, the contracts will use their wasm codes at `startHeight`
3. `sync()` returns a list of tx results, and the `simulateClient`, which holds all contract states at `endHeight` after applying the txs.

This is essentially a small-scaled fork, allowing developers to use their custom wasm codes to debug and gain more insights of what happened in the past.

There's only one catch: you need an **archived node** to retrieve history states and txs. This requirement is understandable because without a node keeping old blocks and states, there's no way to retrieve them.

### Real test-suites for production-grade dApps

We have applied `cw-simulate` in almost every corner of Oraichain Labs' dApps, and they have worked wonders. See the following real test-suites:

- [TonBridge SDK e2e testing](https://github.com/oraichain/tonbridge-sdk/tree/main/packages/contracts-demo/tests)
- [IBC Bridge Wasm e2e testing](https://github.com/oraichain/ibc-bridge-wasm/tree/master/simulate-tests)

## Using with Vue.js and vite

Vite doesn't include shims for Node variables like Webpack 4 does, and cw-simulate currently relies on these. The following workaround exists:

1. Add the `buffer` package (`npm add buffer`)
2. Add the following to your `index.html` (inside the `body` tag, before your other js imports):

```html
<script>
  window.global = window;
</script>
<script type="module">
  import { Buffer } from 'buffer';
  window.Buffer = Buffer;
</script>
```

See [this github issue](https://github.com/vitejs/vite/issues/2618) for more details.
