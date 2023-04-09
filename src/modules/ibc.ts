import EventEmitter from 'eventemitter3';
import { CWSimulateApp } from '../CWSimulateApp';
import {
  AppResponse,
  DebugLog,
  IbcBasicResponse,
  IbcChannelCloseMsg,
  IbcChannelConnectMsg,
  IbcChannelOpenMsg,
  IbcChannelOpenResponse,
  IbcEndpoint,
  IbcPacketAckMsg,
  IbcPacketReceiveMsg,
  IbcPacketTimeoutMsg,
  IbcReceiveResponse,
} from '../types';
import { IbcMsg, IbcMsgTransfer } from '@terran-one/cosmwasm-vm-js/src';
import { Err, Ok, Result } from 'ts-results';
import { fromAscii, fromBase64, fromBech32 } from '@cosmjs/encoding';
import { coin } from '@cosmjs/amino';

type IbcMessageType =
  | 'ibc_channel_open'
  | 'ibc_channel_connect'
  | 'ibc_channel_close'
  | 'ibc_packet_receive'
  | 'ibc_packet_ack'
  | 'ibc_packet_timeout'
  | 'transfer';

type IbcMessage = {
  id: string; // unique msg
  endpoint: IbcEndpoint;
  type: IbcMessageType;
  data: any;
};

const emitter = new EventEmitter();
const callbacks = new Map<string, [Function, Function]>();

function getKey(...args: string[]): string {
  return args.join(':');
}

export class IbcModule {
  private readonly chainMap: Map<string, CWSimulateApp>;
  public sequence: number = 0;
  constructor(public readonly chain: CWSimulateApp) {
    this.chainMap = new Map();
    this.handleRelayMsg = this.handleRelayMsg.bind(this);
  }

  private async handleRelayMsg(msg: IbcMessage) {
    const [resolve, reject] = callbacks.get(msg.id);

    try {
      let logs: DebugLog[] = [];
      const destChain = this.chainMap.get(getKey(msg.endpoint.channel_id, msg.endpoint.port_id));

      if (msg.endpoint.port_id.startsWith('wasm.')) {
        const destContractAddress = msg.endpoint.port_id.substring(5); // remove wasm. prefix

        const contract = destChain.wasm.getContract(destContractAddress);
        const ret = contract[msg.type](msg.data, logs) as any;

        if (ret.err) {
          throw new Error(ret.val);
        }

        // process Ibc response
        if (resolve) resolve(await destChain.wasm.handleIbcResponse(contract.address, ret.val));
      } else if (msg.type === 'transfer') {
        const ibcMsg = msg.data as IbcMsgTransfer;

        const currentBalance = destChain.bank.getBalance(ibcMsg.transfer.to_address);

        const hasCoinInd = currentBalance.findIndex(c => c.denom === ibcMsg.transfer.amount.denom);

        if (hasCoinInd !== -1) {
          currentBalance[hasCoinInd] = coin(
            ibcMsg.transfer.amount.amount + currentBalance[hasCoinInd].amount,
            currentBalance[hasCoinInd].denom
          );
        } else {
          currentBalance.push(ibcMsg.transfer.amount);
        }

        destChain.bank.setBalance(ibcMsg.transfer.to_address, currentBalance);
        if (resolve) resolve(<AppResponse>{ events: [], data: null });
      }
    } catch (ex) {
      if (reject) reject(ex);
    } finally {
      callbacks.delete(msg.id);
    }
  }

  public async handleMsg(sender: string, msg: IbcMsg): Promise<Result<AppResponse, string>> {
    if ('send_packet' in msg) {
      const destChain = this.chainMap.get(getKey(msg.send_packet.channel_id, 'transfer'));
      const result = await this.chain.store.tx(async () => {
        try {
          const result = await this.sendPacketReceive({
            packet: {
              data: msg.send_packet.data,
              src: {
                port_id: 'transfer',
                channel_id: msg.send_packet.channel_id,
              },
              dest: {
                port_id: 'transfer',
                channel_id: destChain.chainId,
              },
              sequence: this.sequence++,
              timeout: msg.send_packet.timeout,
            },
            relayer: sender,
          });
          return Ok(result);
        } catch (ex) {
          return Err((ex as Error).message);
        }
      });

      return result.andThen(() =>
        Ok<AppResponse>({
          events: [
            {
              type: 'send_packet',
              attributes: [
                { key: 'packet_data', value: fromAscii(fromBase64(msg.send_packet.data)) },
                {
                  key: 'packet_timeout_height',
                  value: `${msg.send_packet.timeout.block?.revision ?? 0}-${
                    msg.send_packet.timeout.block?.height ?? 0
                  }`,
                },
                {
                  key: 'packet_timeout_timestamp',
                  value: msg.send_packet.timeout?.timestamp ?? '0',
                },
                {
                  key: 'packet_src_channel',
                  value: msg.send_packet.channel_id,
                },
              ],
            },
          ],
          data: null,
        })
      );
    }
    if ('transfer' in msg) {
      const result = await this.chain.store.tx(async () => {
        try {
          const result = await this.sendTransfer(msg.transfer.channel_id, msg);
          return Ok(result);
        } catch (ex) {
          return Err((ex as Error).message);
        }
      });

      return result.andThen(() =>
        Ok<AppResponse>({
          events: [
            {
              type: 'transfer',
              attributes: [
                { key: 'recipient', value: msg.transfer.to_address },
                {
                  key: 'sender',
                  value: sender,
                },
                {
                  key: 'amount',
                  value: `${msg.transfer.amount.amount}${msg.transfer.amount.denom}`,
                },
                {
                  key: 'channel',
                  value: msg.transfer.channel_id,
                },
              ],
            },
          ],
          data: null,
        })
      );
    }

    return Err('Unknown ibc message');
  }

  protected sendMsg<T>(type: IbcMessageType, endpoint: IbcEndpoint, data: any): Promise<T> {
    const destChain = this.chainMap.get(getKey(endpoint.channel_id, endpoint.port_id));
    const eventKey = getKey(destChain.chainId, endpoint.channel_id, endpoint.port_id);

    const id = Date.now().toString();
    return new Promise((resolve, reject) => {
      callbacks.set(id, [resolve, reject]);
      emitter.emit(eventKey, { type, endpoint, data, id });
    });
  }

  public relay(channel: string, port: string, destChain: CWSimulateApp) {
    const eventKey = getKey(destChain.chainId, channel, port);
    this.chainMap.set(getKey(channel, port), destChain);
    emitter.removeAllListeners(eventKey);
    emitter.addListener(eventKey, this.handleRelayMsg);
  }

  public async sendChannelOpen(data: IbcChannelOpenMsg): Promise<IbcChannelOpenResponse> {
    const { counterparty_endpoint } = 'open_init' in data ? data.open_init.channel : data.open_try.channel;
    return this.sendMsg('ibc_channel_open', counterparty_endpoint, data);
  }

  public async sendChannelConnect(data: IbcChannelConnectMsg): Promise<IbcBasicResponse> {
    const { counterparty_endpoint } = 'open_ack' in data ? data.open_ack.channel : data.open_confirm.channel;
    return this.sendMsg('ibc_channel_connect', counterparty_endpoint, data);
  }

  public async sendChannelClose(data: IbcChannelCloseMsg): Promise<IbcBasicResponse> {
    const { counterparty_endpoint } = 'close_init' in data ? data.close_init.channel : data.close_confirm.channel;
    return this.sendMsg('ibc_channel_close', counterparty_endpoint, data);
  }

  public async sendPacketReceive(data: IbcPacketReceiveMsg): Promise<IbcReceiveResponse> {
    const counterparty_endpoint = data.packet.dest;
    return this.sendMsg('ibc_packet_receive', counterparty_endpoint, data);
  }

  public async sendPacketAck(data: IbcPacketAckMsg): Promise<IbcBasicResponse> {
    const counterparty_endpoint = data.original_packet.dest;
    return this.sendMsg('ibc_packet_ack', counterparty_endpoint, data);
  }

  public async sendPacketTimeout(data: IbcPacketTimeoutMsg): Promise<IbcBasicResponse> {
    const counterparty_endpoint = data.packet.dest;
    return this.sendMsg('ibc_packet_timeout', counterparty_endpoint, data);
  }

  public async sendTransfer(destChannelId: string, data: IbcMsgTransfer): Promise<IbcBasicResponse> {
    const counterparty_endpoint: IbcEndpoint = {
      port_id: 'transfer',
      channel_id: destChannelId,
    };
    return this.sendMsg('transfer', counterparty_endpoint, data);
  }
}
