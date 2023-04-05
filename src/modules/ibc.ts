import EventEmitter from 'eventemitter3';
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
} from '../types';

type IbcMessageType =
  | 'ibc_channel_open'
  | 'ibc_channel_connect'
  | 'ibc_channel_close'
  | 'ibc_packet_receive'
  | 'ibc_packet_ack'
  | 'ibc_packet_timeout';

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

  constructor(public readonly chain: CWSimulateApp) {
    this.chainMap = new Map();
    this.handleRelayMsg = this.handleRelayMsg.bind(this);
  }

  private async handleRelayMsg(msg: IbcMessage) {
    const [resolve, reject] = callbacks.get(msg.id);

    try {
      let logs: DebugLog[] = [];
      const destChain = this.chainMap.get(getKey(msg.endpoint.channel_id, msg.endpoint.port_id));
      const destContractAddress = msg.endpoint.port_id.substring(5); // remove wasm. prefix
      const contract = destChain.wasm.getContract(destContractAddress);
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
}
