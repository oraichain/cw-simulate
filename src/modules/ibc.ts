import EventEmitter from 'eventemitter3';
import { Result } from 'ts-results';
import { CWSimulateApp } from '../CWSimulateApp';
import {
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
  TraceLog,
} from '../types';
import Contract from './wasm/contract';
import { buildAppResponse } from './wasm/wasm-util';

type IbcMessage = {
  id: string; // unique msg
  type:
    | 'ibc_channel_open'
    | 'ibc_channel_connect'
    | 'ibc_channel_close'
    | 'ibc_packet_receive'
    | 'ibc_packet_ack'
    | 'ibc_packet_timeout';
  data: any;
};

const emitter = new EventEmitter();
const callbacks = new Map<string, [Function, Function]>();

function getEventKey(chainId: string, channel: string, port): string {
  return chainId + ':' + channel + ':' + port;
}

export class IbcModule {
  private readonly chainMap: Map<string, CWSimulateApp>;

  constructor(public readonly chain: CWSimulateApp) {
    this.chainMap = new Map();
  }

  // can be override later
  protected getContractFromIbcMsg({ type, data }: IbcMessage): Contract {
    let endpoint: IbcEndpoint;
    switch (type) {
      case 'ibc_channel_open':
        const channelOpenMsg = data as IbcChannelOpenMsg;
        endpoint = ('open_init' in channelOpenMsg ? channelOpenMsg.open_init.channel : channelOpenMsg.open_try.channel)
          .counterparty_endpoint;
        break;
      case 'ibc_channel_connect':
        const channelConnectMsg = data as IbcChannelConnectMsg;
        endpoint = (
          'open_ack' in channelConnectMsg ? channelConnectMsg.open_ack.channel : channelConnectMsg.open_confirm.channel
        ).counterparty_endpoint;
        break;
      case 'ibc_channel_close':
        const channelCloseMsg = data as IbcChannelCloseMsg;
        endpoint = (
          'close_init' in channelCloseMsg ? channelCloseMsg.close_init.channel : channelCloseMsg.close_confirm.channel
        ).counterparty_endpoint;
        break;
      case 'ibc_packet_receive':
        endpoint = (data as IbcPacketReceiveMsg).packet.dest;
        break;
      case 'ibc_packet_ack':
        endpoint = (data as IbcPacketAckMsg).original_packet.dest;
        break;
      case 'ibc_packet_timeout':
        endpoint = (data as IbcPacketTimeoutMsg).packet.dest;
        break;
    }

    const destChain = this.chainMap.get(endpoint.channel_id + ':' + endpoint.port_id);
    const destContractAddress = endpoint.port_id.substring(5); // remove wasm. prefix
    const contract = destChain.wasm.getContract(destContractAddress);

    return contract;
  }

  public relay(channel: string, port: string, destChain: CWSimulateApp) {
    const eventKey = getEventKey(destChain.chainId, channel, port);
    this.chainMap.set(channel + ':' + port, destChain);
    emitter.removeAllListeners(eventKey);
    emitter.addListener(eventKey, async (msg: IbcMessage) => {
      const [resolve, reject] = callbacks.get(msg.id);

      try {
        let logs: DebugLog[] = [];
        const contract = this.getContractFromIbcMsg(msg);
        const ret = contract[msg.type](msg.data, logs) as any;

        if (ret.err) {
          throw new Error(ret.val);
        }

        // process Ibc response
        if (resolve) resolve(await destChain.wasm.handleIbcResponse(contract.address, ret.val));
      } catch (ex) {
        if (reject) reject(ex);
      } finally {
        callbacks.delete(msg.id);
      }
    });
  }

  public async send_channel_open(data: IbcChannelOpenMsg): Promise<IbcChannelOpenResponse> {
    const { counterparty_endpoint } = 'open_init' in data ? data.open_init.channel : data.open_try.channel;

    const destChain = this.chainMap.get(counterparty_endpoint.channel_id + ':' + counterparty_endpoint.port_id);
    const eventKey = getEventKey(destChain.chainId, counterparty_endpoint.channel_id, counterparty_endpoint.port_id);

    const id = Date.now().toString();
    return new Promise((resolve, reject) => {
      callbacks.set(id, [resolve, reject]);
      emitter.emit(eventKey, { type: 'ibc_channel_open', data, id });
    });
  }

  public async send_channel_connect(data: IbcChannelConnectMsg): Promise<IbcBasicResponse> {
    const { counterparty_endpoint } = 'open_ack' in data ? data.open_ack.channel : data.open_confirm.channel;

    const destChain = this.chainMap.get(counterparty_endpoint.channel_id + ':' + counterparty_endpoint.port_id);
    const eventKey = getEventKey(destChain.chainId, counterparty_endpoint.channel_id, counterparty_endpoint.port_id);

    const id = Date.now().toString();
    return new Promise((resolve, reject) => {
      callbacks.set(id, [resolve, reject]);
      emitter.emit(eventKey, { type: 'ibc_channel_connect', data, id });
    });
  }

  public async send_channel_close(data: IbcChannelCloseMsg): Promise<IbcBasicResponse> {
    const { counterparty_endpoint } = 'close_init' in data ? data.close_init.channel : data.close_confirm.channel;

    const destChain = this.chainMap.get(counterparty_endpoint.channel_id + ':' + counterparty_endpoint.port_id);
    const eventKey = getEventKey(destChain.chainId, counterparty_endpoint.channel_id, counterparty_endpoint.port_id);

    const id = Date.now().toString();
    return new Promise((resolve, reject) => {
      callbacks.set(id, [resolve, reject]);
      emitter.emit(eventKey, { type: 'ibc_channel_close', data, id });
    });
  }

  public async send_packet_receive(data: IbcPacketReceiveMsg): Promise<IbcReceiveResponse> {
    const counterparty_endpoint = data.packet.dest;
    const destChain = this.chainMap.get(counterparty_endpoint.channel_id + ':' + counterparty_endpoint.port_id);
    const eventKey = getEventKey(destChain.chainId, counterparty_endpoint.channel_id, counterparty_endpoint.port_id);

    const id = Date.now().toString();
    return new Promise((resolve, reject) => {
      callbacks.set(id, [resolve, reject]);
      emitter.emit(eventKey, { type: 'ibc_packet_receive', data, id });
    });
  }

  public async send_packet_ack(data: IbcPacketAckMsg): Promise<IbcBasicResponse> {
    const counterparty_endpoint = data.original_packet.dest;

    const destChain = this.chainMap.get(counterparty_endpoint.channel_id + ':' + counterparty_endpoint.port_id);
    const eventKey = getEventKey(destChain.chainId, counterparty_endpoint.channel_id, counterparty_endpoint.port_id);

    const id = Date.now().toString();
    return new Promise((resolve, reject) => {
      callbacks.set(id, [resolve, reject]);
      emitter.emit(eventKey, { type: 'ibc_packet_ack', data, id });
    });
  }

  public async send_packet_timeout(data: IbcPacketTimeoutMsg): Promise<IbcBasicResponse> {
    const counterparty_endpoint = data.packet.dest;

    const destChain = this.chainMap.get(counterparty_endpoint.channel_id + ':' + counterparty_endpoint.port_id);
    const eventKey = getEventKey(destChain.chainId, counterparty_endpoint.channel_id, counterparty_endpoint.port_id);

    const id = Date.now().toString();
    return new Promise((resolve, reject) => {
      callbacks.set(id, [resolve, reject]);
      emitter.emit(eventKey, { type: 'ibc_packet_timeout', data, id });
    });
  }
}
