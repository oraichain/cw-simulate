import { readFileSync } from 'fs';
import { CWSimulateApp } from '../CWSimulateApp';
import path from 'path';
import { AppResponse, IbcOrder } from '../types';
import { fromBinary, toBinary } from '../util';
import { fromBech32, toBech32 } from '@cosmjs/encoding';
import { coins } from '@cosmjs/amino';

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
      'ibc reflect'
    );

    oraiPort = 'wasm.' + (oraiRet.val as AppResponse).events[0].attributes[0].value;
  });

  it('handle reflect', async () => {
    terraChain.ibc.relay('channel-0', oraiPort, oraiChain);

    const channelOpenRes = await terraChain.ibc.send_channel_open({
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

    const channelConnectRes = await terraChain.ibc.send_channel_connect({
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
    let packetReceiveRes = await terraChain.ibc.send_packet_receive({
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
        sequence: 27,
        timeout: {
          block: {
            revision: 1,
            height: 12345678,
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
    packetReceiveRes = await terraChain.ibc.send_packet_receive({
      packet: {
        data: toBinary({
          dispatch: {
            msgs: [
              {
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
        sequence: 27,
        timeout: {
          block: {
            revision: 1,
            height: 12345678,
          },
        },
      },
      relayer: terraSenderAddress,
    });

    const bobBalance = oraiChain.bank.getBalance(bobAddress);
    expect(bobBalance).toEqual(coins(123456789, 'orai'));
  });
});
