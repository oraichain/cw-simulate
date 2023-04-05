import { readFileSync } from 'fs';
import { CWSimulateApp } from '../CWSimulateApp';
import path from 'path';
import { AppResponse, IbcOrder, RustResult } from '../types';
import { coins } from '@cosmjs/amino';
import { fromBinary, toBinary } from '../util';
import { fromBech32, toBech32 } from '@cosmjs/encoding';
import { Result } from 'ts-results';

const oraiSenderAddress = 'orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g';

describe.only('IBCModule', () => {
  let terraChain: CWSimulateApp;
  let oraiChain: CWSimulateApp;
  let oraiPort: string;
  let terraPort: string;
  beforeEach(async () => {
    terraChain = new CWSimulateApp({
      chainId: 'test-1',
      bech32Prefix: 'terra',
    });

    oraiChain = new CWSimulateApp({
      chainId: 'Oraichain',
      bech32Prefix: 'orai',
    });

    const terraSenderAddress = toBech32(terraChain.bech32Prefix, fromBech32(oraiSenderAddress).data);

    // currently we update price directly to feepool contract, and we can proxy to oracle hub later
    const terraSendCodeId = terraChain.wasm.create(
      terraSenderAddress,
      readFileSync(path.join(__dirname, '..', '..', 'testing', 'ibc_reflect_send.wasm'))
    );
    const terraCodeId = terraChain.wasm.create(
      terraSenderAddress,
      readFileSync(path.join(__dirname, '..', '..', 'testing', 'ibc_reflect.wasm'))
    );
    const oraiSendCodeId = oraiChain.wasm.create(
      oraiSenderAddress,
      readFileSync(path.join(__dirname, '..', '..', 'testing', 'ibc_reflect_send.wasm'))
    );
    const oraiCodeId = oraiChain.wasm.create(
      oraiSenderAddress,
      readFileSync(path.join(__dirname, '..', '..', 'testing', 'ibc_reflect.wasm'))
    );

    const oraiRet = await oraiChain.wasm.instantiateContract(
      oraiSenderAddress,
      [],
      oraiCodeId,
      { reflect_code_id: terraSendCodeId },
      'ibc reflect'
    );

    oraiPort = 'wasm.' + (oraiRet.val as AppResponse).events[0].attributes[0].value;

    const terraRet = await terraChain.wasm.instantiateContract(
      terraSenderAddress,
      [],
      terraCodeId,
      { reflect_code_id: oraiSendCodeId },
      'ibc reflect'
    );
    terraPort = 'wasm.' + (terraRet.val as AppResponse).events[0].attributes[0].value;
  });

  it('handle reflect', async () => {
    terraChain.ibc.relay('channel-0', oraiPort, oraiChain);
    oraiChain.ibc.relay('channel-0', terraPort, terraChain);

    const channelOpenRes = await terraChain.ibc.channel_open({
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

    const channelConnectRes = await terraChain.ibc.channel_connect({
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

    // send message to bob on oraichain
    const data = toBinary({
      who_am_i: {},
    });

    const packetReceiveRes = await terraChain.ibc.packet_receive({
      packet: {
        data,
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
      relayer: oraiSenderAddress,
    });

    // check contract remote
    const oraichainContractAddreses = oraiChain.wasm.getContracts().map(c => c.address);
    const res = fromBinary(packetReceiveRes.acknowledgement) as { ok: { account: string } };
    const remoteOraiContractAddress = res.ok.account;
    expect(remoteOraiContractAddress).toEqual(oraichainContractAddreses[1]);
  });
});
