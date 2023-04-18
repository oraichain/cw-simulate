import { coin, coins } from '@cosmjs/amino';
import { fromBinary, toBinary } from '@cosmjs/cosmwasm-stargate';
import { fromBech32, toBech32 } from '@cosmjs/encoding';
import { CosmosMsg, IbcMsgTransfer } from '@terran-one/cosmwasm-vm-js';
import { readFileSync } from 'fs';
import path from 'path';
import { CWSimulateApp } from '../CWSimulateApp';
import { AppResponse, IbcOrder } from '../types';

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

    const bobBalance = oraiChain.bank.getBalance(bobAddress);
    expect(bobBalance).toEqual(coins(123456789, 'orai'));

    const { val } = (await oraiChain.ibc.handleMsg(oraiSenderAddress, {
      close_channel: { channel_id: 'channel-0' },
    })) as { val: AppResponse };

    // call handle will merge all events from application module
    expect(val.events[3]).toEqual({
      type: 'channel_close_init',
      attributes: [
        { key: 'port_id', value: oraiPort },
        {
          key: 'channel_id',
          value: oraiSenderAddress,
        },
        {
          key: 'counterparty_port_id',
          value: terraPort,
        },
        {
          key: 'counterparty_channel_id',
          value: 'channel-0',
        },
        {
          key: 'connection_id',
          value: 'connection-0',
        },
        {
          key: 'action',
          value: 'channel_close_init',
        },
        {
          key: 'module',
          value: 'ibc_channel',
        },
      ],
    });
  });

  it('ibc-handle-msg', async () => {
    // Arrange
    oraiChain.ibc.relay('channel-0', oraiPort, 'channel-0', terraPort, terraChain);

    // call transfer module, does not require wasm module
    let msg: IbcMsgTransfer = {
      transfer: {
        channel_id: 'channel-0',
        amount: coin('100000000', 'ust'),
        to_address: oraiSenderAddress,

        timeout: {
          timestamp: '123456',
        },
      },
    };
    // to receive events and attributes we must call handleMsg, otherwise we only get response from sending message
    const ret = await terraChain.ibc.handleMsg(terraSenderAddress, msg);
    console.log(JSON.stringify(ret.val));

    expect(oraiChain.bank.getBalance(oraiSenderAddress)).toEqual(coins('100000000', 'ust'));
  });
});
