import { Coin } from '@cosmjs/amino';
import { IbcMsg, IbcTimeout } from '@oraichain/cosmwasm-vm-js';
import EventEmitter from 'eventemitter3';
import { Err, Ok, Result } from 'ts-results';
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
  IbcOrder,
  IbcPacketAckMsg,
  IbcPacketReceiveMsg,
  IbcPacketTimeoutMsg,
  IbcReceiveResponse,
} from '../types';
import { fromBase64, toHex, toUtf8 } from '@cosmjs/encoding';
import { sha256 } from '@cosmjs/crypto';

const DEFAULT_IBC_TIMEOUT = 2000;
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
  counterparty_endpoint: IbcEndpoint;
  type: IbcMessageType;
  data: any;
};

// source chain_id +':' + channel_id =>
type ChannelInfo = {
  channel_id: string;
  source_port_id: string;
  port_id: string;
  version?: string;
  connection_id?: string;
  chain: CWSimulateApp;
};

type MiddleWareCallback = (msg: IbcMessage, appRes: AppResponse) => Promise<void> | void;

const emitter = new EventEmitter();
const callbacks = new Map<string, [Function, Function, NodeJS.Timeout]>();
const relayMap = new Map<string, ChannelInfo>();
const middleWares = new Map<string, MiddleWareCallback[]>();
const denomMap = new Map<string, string>();

function getKey(...args: string[]): string {
  return args.join(':');
}

export type IbcTransferData = {
  channelId: string;
  token: Coin;
  sender: string;
  receiver: string;
  timeout: IbcTimeout;
  memo?: string;
};

export class IbcModule {
  public sequence: number = 0;

  constructor(public readonly chain: CWSimulateApp) {
    this.handleRelayMsg = this.handleRelayMsg.bind(this);
  }

  public addMiddleWare(callback: MiddleWareCallback) {
    middleWares.get(this.chain.chainId).push(callback);
  }

  public removeMiddelWare(callback: MiddleWareCallback) {
    const chainMiddleWares = middleWares.get(this.chain.chainId);
    const findInd = chainMiddleWares.findIndex(c => c === callback);
    if (findInd !== -1) chainMiddleWares.splice(findInd, 1);
  }

  // connection is optional: you can set what ever
  public relay(
    sourceChannel: string,
    sourcePort: string,
    destChannel: string,
    destPort: string,
    destChain: CWSimulateApp
  ) {
    this.innerRelay(sourceChannel, sourcePort, destChannel, destPort, destChain);
    destChain.ibc.innerRelay(destChannel, destPort, sourceChannel, sourcePort, this.chain);
  }

  public getContractIbcPort(address: string): string | null {
    const contractIbcPort = `wasm.${address}`;
    for (const channelInfo of relayMap.values()) {
      if (channelInfo.source_port_id === contractIbcPort) {
        return contractIbcPort;
      }
    }
    return null;
  }

  private async handleRelayMsg(msg: IbcMessage) {
    const [resolve, reject, timer] = callbacks.get(msg.id);

    try {
      let logs: DebugLog[] = [];

      const { chain: destChain } = relayMap.get(getKey(this.chain.chainId, msg.endpoint.channel_id));

      // transfer token via IBC dest denom will be calculated as sha256(channel/port), and check reverse as well
      if (msg.type === 'transfer') {
        // ibc_denom := 'ibc/' + sha256('transfer/dest/denom')
        const ibcMsg = msg.data as IbcTransferData;
        // burn on source chain, may throw error if not enough balance
        this.chain.bank.burn(ibcMsg.sender, [ibcMsg.token]);
        let destDenom: string;
        if (ibcMsg.token.denom.startsWith('ibc/')) {
          // need map back, surely if denomMap is not set, the balance is zero as well
          destDenom = denomMap.get(ibcMsg.token.denom);
        } else {
          // calculate dest denom
          destDenom =
            'ibc/' + toHex(sha256(toUtf8(`transfer/${msg.counterparty_endpoint.channel_id}/${ibcMsg.token.denom}`)));
          // create denom map
          denomMap.set(destDenom, ibcMsg.token.denom);
        }
        // mint on dest chain and burn on source chain
        destChain.bank.mint(ibcMsg.receiver, [{ denom: destDenom, amount: ibcMsg.token.amount }]);
        if (resolve) resolve(<AppResponse>{ events: [], data: null });
      } else {
        if (msg.counterparty_endpoint.port_id.startsWith('wasm.')) {
          const destContractAddress = msg.counterparty_endpoint.port_id.substring(5); // remove wasm. prefix

          const contract = destChain.wasm.getContract(destContractAddress);

          if (!(msg.type in contract)) {
            throw new Error(`Contract ${destContractAddress} does not have entrypoint ${msg.type}`);
          }

          const ret = contract[msg.type](msg.data, logs) as any;

          if (ret.err) {
            throw new Error(ret.val);
          }

          // process Ibc response
          if (resolve) resolve(await destChain.wasm.handleIbcResponse(contract.address, ret.val));
        } else {
          const chainMiddleWares = middleWares.get(destChain.chainId);
          if (!chainMiddleWares.length) {
            // we are not focus on IBC implementation at application modules, currently we only focus on IBC contract implementation
            throw new Error(`Method ${msg.type} has not been implemented on chain ${destChain.chainId}`);
          }

          // run through callback following the order
          const appRes: AppResponse = { events: [], data: null };
          for (const middleware of chainMiddleWares) {
            await middleware(msg, appRes);
          }
          if (resolve) resolve(appRes);
        }
      }
    } catch (ex) {
      if (reject) reject(ex);
    } finally {
      clearTimeout(timer);
      callbacks.delete(msg.id);
    }
  }

  // currently we only support handleMsg from cosmwasm contract that is IbcMsg, other event will not be covered from this module
  // it is at application level
  public async handleMsg(sender: string, msg: IbcMsg): Promise<Result<AppResponse, string>> {
    if ('send_packet' in msg) {
      const destInfo = relayMap.get(getKey(this.chain.chainId, msg.send_packet.channel_id));
      if (!destInfo) {
        throw new Error('Chain is not relayed yet');
      }

      const result = await this.chain.store.tx(async () => {
        try {
          const result = await this.sendPacketReceive({
            packet: {
              data: msg.send_packet.data,
              src: {
                port_id: destInfo.source_port_id,
                channel_id: msg.send_packet.channel_id,
              },
              dest: {
                port_id: destInfo.port_id,
                channel_id: destInfo.channel_id,
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

      return result.andThen(ret =>
        Ok<AppResponse>({
          ...ret,
          events: [
            ...ret.events,
            {
              type: 'send_packet',
              attributes: [
                { key: 'packet_data_hex', value: toHex(fromBase64(msg.send_packet.data)) },
                {
                  key: 'packet_timeout_height',
                  value: (msg.send_packet.timeout.block?.height ?? 0).toString(),
                },
                {
                  key: 'packet_sequence',
                  value: this.sequence.toString(),
                },
                {
                  key: 'packet_timeout_timestamp',
                  value: msg.send_packet.timeout.timestamp ?? '',
                },
                {
                  key: 'packet_src_channel',
                  value: msg.send_packet.channel_id,
                },
                {
                  key: 'packet_src_port',
                  value: destInfo.source_port_id,
                },
                {
                  key: 'packet_dest_channel',
                  value: destInfo.channel_id,
                },
                {
                  key: 'packet_dest_port',
                  value: destInfo.port_id,
                },
                {
                  key: 'packet_channel_ordering',
                  value: IbcOrder.Unordered,
                },
                {
                  key: 'connection_id',
                  value: destInfo.connection_id,
                },
                {
                  key: 'action',
                  value: 'application-module-defined-field',
                },
                {
                  key: 'module',
                  value: 'ibc_channel',
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
          // channel_id is source channel
          const msgData: IbcTransferData = {
            sender,
            channelId: msg.transfer.channel_id,
            timeout: msg.transfer.timeout,
            token: msg.transfer.amount,
            receiver: msg.transfer.to_address,
          };
          const result = await this.sendTransfer(msgData);
          return Ok(result);
        } catch (ex) {
          return Err((ex as Error).message);
        }
      });

      return result.andThen(ret =>
        Ok<AppResponse>({
          ...ret,
          events: [
            ...ret.events,
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

    if ('close_channel' in msg) {
      const destInfo = relayMap.get(getKey(this.chain.chainId, msg.close_channel.channel_id));
      if (!destInfo) {
        throw new Error('Chain is not relayed yet');
      }

      const result = await this.chain.store.tx(async () => {
        try {
          // when source channel call handle close msg, we can call sendChannelClose from dest chain to trigger it,
          const result = await destInfo.chain.ibc.sendChannelClose({
            close_init: {
              channel: {
                order: IbcOrder.Unordered,
                version: destInfo.version,
                connection_id: destInfo.connection_id,
                counterparty_endpoint: {
                  channel_id: msg.close_channel.channel_id,
                  port_id: destInfo.source_port_id,
                },
                endpoint: {
                  channel_id: destInfo.channel_id,
                  port_id: destInfo.port_id,
                },
              },
            },
          });

          return Ok(result);
        } catch (ex) {
          return Err((ex as Error).message);
        }
      });

      return result.andThen(ret =>
        Ok<AppResponse>({
          ...ret,
          events: [
            ...ret.events,
            {
              type: 'channel_close_init',
              attributes: [
                { key: 'port_id', value: destInfo.source_port_id },
                {
                  key: 'channel_id',
                  value: sender,
                },
                {
                  key: 'counterparty_port_id',
                  value: destInfo.port_id,
                },
                {
                  key: 'counterparty_channel_id',
                  value: destInfo.channel_id,
                },
                {
                  key: 'connection_id',
                  value: destInfo.connection_id,
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
            },
          ],
          data: null,
        })
      );
    }

    return Err('Unknown ibc message');
  }

  // this method should be called from relayer, because blockchain can not call other rpc
  // such as A -> sendChannelOpen(open_init) -> B
  // if success then B -> sendChannelOpen(open_confirm) -> B
  // same for sendChannelConnect and sendChannelClose
  protected sendMsg<T>(
    type: IbcMessageType,
    endpoint: IbcEndpoint,
    counterparty_endpoint: IbcEndpoint,
    data: any
  ): Promise<T> {
    const eventKey = getKey(this.chain.chainId, endpoint.channel_id);
    const id = Date.now().toString();

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Call ${type} timeout after ${DEFAULT_IBC_TIMEOUT}`)),
        DEFAULT_IBC_TIMEOUT
      );
      callbacks.set(id, [resolve, reject, timer]);
      emitter.emit(eventKey, { type, endpoint, counterparty_endpoint, data, id }); // call handleRelayMsg
    });
  }

  protected innerRelay(
    sourceChannel: string,
    sourcePort: string,
    destChannel: string,
    destPort: string,
    destChain: CWSimulateApp
  ) {
    const eventKey = getKey(this.chain.chainId, sourceChannel);
    // override
    relayMap.set(eventKey, {
      channel_id: destChannel,
      port_id: destPort,
      source_port_id: sourcePort,
      chain: destChain,
    });
    // reset all
    middleWares.set(this.chain.chainId, []);
    emitter.removeAllListeners(eventKey);
    emitter.addListener(eventKey, this.handleRelayMsg);
  }

  public sendChannelOpen(data: IbcChannelOpenMsg): Promise<IbcChannelOpenResponse> {
    const { endpoint, counterparty_endpoint } = 'open_init' in data ? data.open_init.channel : data.open_try.channel;
    return this.sendMsg('ibc_channel_open', endpoint, counterparty_endpoint, data);
  }

  public sendChannelConnect(data: IbcChannelConnectMsg): Promise<IbcBasicResponse> {
    const { endpoint, counterparty_endpoint } = 'open_ack' in data ? data.open_ack.channel : data.open_confirm.channel;

    // update version
    if ('open_ack' in data) {
      const { channel } = data.open_ack;
      // update version and connection_id (if success? - should implement at wrap method to send open, confirm ack packet)
      const destInfo = relayMap.get(getKey(this.chain.chainId, channel.endpoint.channel_id));
      destInfo.version = channel.version;
      destInfo.connection_id = channel.connection_id;
      const sourceInfo = relayMap.get(getKey(destInfo.chain.chainId, channel.counterparty_endpoint.channel_id));
      sourceInfo.version = channel.version;
      sourceInfo.connection_id = channel.connection_id;
    }
    return this.sendMsg('ibc_channel_connect', endpoint, counterparty_endpoint, data);
  }

  public sendChannelClose(data: IbcChannelCloseMsg): Promise<IbcBasicResponse> {
    const { endpoint, counterparty_endpoint } =
      'close_init' in data ? data.close_init.channel : data.close_confirm.channel;
    return this.sendMsg('ibc_channel_close', endpoint, counterparty_endpoint, data);
  }

  public sendPacketReceive(data: IbcPacketReceiveMsg): Promise<IbcReceiveResponse> {
    return this.sendMsg('ibc_packet_receive', data.packet.src, data.packet.dest, data);
  }

  public sendPacketAck(data: IbcPacketAckMsg): Promise<IbcBasicResponse> {
    return this.sendMsg('ibc_packet_ack', data.original_packet.src, data.original_packet.dest, data);
  }

  public sendPacketTimeout(data: IbcPacketTimeoutMsg): Promise<IbcBasicResponse> {
    return this.sendMsg('ibc_packet_timeout', data.packet.src, data.packet.dest, data);
  }

  public sendTransfer(data: IbcTransferData): Promise<IbcBasicResponse> {
    // from source channel => get dest channel
    const destInfo = relayMap.get(getKey(this.chain.chainId, data.channelId));
    if (!destInfo) {
      throw new Error('Chain is not relayed yet');
    }

    const endpoint: IbcEndpoint = {
      port_id: destInfo.source_port_id,
      channel_id: data.channelId,
    };

    const destEndpoint: IbcEndpoint = {
      port_id: destInfo.port_id,
      channel_id: destInfo.channel_id,
    };

    return this.sendMsg('transfer', endpoint, destEndpoint, data);
  }
}
