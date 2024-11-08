import { Coin } from '@cosmjs/amino';
import { IbcMsg, IbcTimeout } from '@oraichain/cosmwasm-vm-js';
import { Result } from 'ts-results';
import { CWSimulateApp } from '../CWSimulateApp';
import { AppResponse, IbcBasicResponse, IbcChannelCloseMsg, IbcChannelConnectMsg, IbcChannelOpenMsg, IbcChannelOpenResponse, IbcEndpoint, IbcPacketAckMsg, IbcPacketReceiveMsg, IbcPacketTimeoutMsg, IbcReceiveResponse } from '../types';
type IbcMessageType = 'ibc_channel_open' | 'ibc_channel_connect' | 'ibc_channel_close' | 'ibc_packet_receive' | 'ibc_packet_ack' | 'ibc_packet_timeout' | 'transfer';
type IbcMessage = {
    id: string;
    endpoint: IbcEndpoint;
    counterparty_endpoint: IbcEndpoint;
    type: IbcMessageType;
    data: any;
};
type MiddleWareCallback = (msg: IbcMessage, appRes: AppResponse) => Promise<void> | void;
export type IbcTransferData = {
    channelId: string;
    token: Coin;
    sender: string;
    receiver: string;
    timeout: IbcTimeout;
    memo?: string;
};
export declare const ibcDenom: (port: string, channel: string, denom: string) => string;
export declare class IbcModule {
    readonly chain: CWSimulateApp;
    sequence: number;
    constructor(chain: CWSimulateApp);
    addMiddleWare(callback: MiddleWareCallback): void;
    removeMiddelWare(callback: MiddleWareCallback): void;
    relay(sourceChannel: string, sourcePort: string, destChannel: string, destPort: string, destChain: CWSimulateApp): void;
    getContractIbcPort(address: string): string | null;
    private handleRelayMsg;
    handleMsg(sender: string, msg: IbcMsg): Promise<Result<AppResponse, string>>;
    protected sendMsg<T>(type: IbcMessageType, endpoint: IbcEndpoint, counterparty_endpoint: IbcEndpoint, data: any): Promise<T>;
    protected innerRelay(sourceChannel: string, sourcePort: string, destChannel: string, destPort: string, destChain: CWSimulateApp): void;
    sendChannelOpen(data: IbcChannelOpenMsg): Promise<IbcChannelOpenResponse>;
    sendChannelConnect(data: IbcChannelConnectMsg): Promise<IbcBasicResponse>;
    sendChannelClose(data: IbcChannelCloseMsg): Promise<IbcBasicResponse>;
    sendPacketReceive(data: IbcPacketReceiveMsg): Promise<IbcReceiveResponse>;
    sendPacketAck(data: IbcPacketAckMsg): Promise<IbcBasicResponse>;
    sendPacketTimeout(data: IbcPacketTimeoutMsg): Promise<IbcBasicResponse>;
    sendTransfer(data: IbcTransferData): Promise<IbcBasicResponse>;
}
export {};
//# sourceMappingURL=ibc.d.ts.map