import { Coin } from '@cosmjs/amino';
import { ContractResponse } from '@oraichain/cosmwasm-vm-js';
import { Map } from '@oraichain/immutable';
import { Result } from 'ts-results';
import { CWSimulateVMInstance } from '../../instrumentation/CWSimulateVMInstance';
import { DebugLog, IbcBasicResponse, IbcChannelCloseMsg, IbcChannelConnectMsg, IbcChannelOpenMsg, IbcChannelOpenResponse, IbcPacketAckMsg, IbcPacketReceiveMsg, IbcPacketTimeoutMsg, IbcReceiveResponse, ReplyMsg, Snapshot } from '../../types';
import { WasmModule } from './module';
/** An interface to interact with CW SCs */
export default class Contract {
    private _wasm;
    readonly address: string;
    private _vm;
    constructor(_wasm: WasmModule, address: string);
    init(): Promise<this>;
    instantiate(sender: string, funds: Coin[], instantiateMsg: any, logs: DebugLog[]): Result<ContractResponse, string>;
    execute(sender: string, funds: Coin[], executeMsg: any, logs: DebugLog[]): Result<ContractResponse, string>;
    migrate(migrateMsg: any, logs: DebugLog[]): Result<ContractResponse, string>;
    sudo(sudoMsg: any, logs: DebugLog[]): Result<ContractResponse, string>;
    reply(replyMsg: ReplyMsg, logs: DebugLog[]): Result<ContractResponse, string>;
    ibc_channel_open(ibcChannelOpenMsg: IbcChannelOpenMsg, logs: DebugLog[]): Result<IbcChannelOpenResponse, string>;
    ibc_channel_connect(ibcChannelConnectMsg: IbcChannelConnectMsg, logs: DebugLog[]): Result<IbcBasicResponse, string>;
    ibc_channel_close(ibcChannelCloseMsg: IbcChannelCloseMsg, logs: DebugLog[]): Result<IbcBasicResponse, string>;
    ibc_packet_receive(ibcPacketReceiveMsg: IbcPacketReceiveMsg, logs: DebugLog[]): Result<IbcReceiveResponse, string>;
    ibc_packet_ack(ibcPacketAckMsg: IbcPacketAckMsg, logs: DebugLog[]): Result<IbcBasicResponse, string>;
    ibc_packet_timeout(ibcPacketTimeoutMsg: IbcPacketTimeoutMsg, logs: DebugLog[]): Result<IbcBasicResponse, string>;
    query(queryMsg: any, store?: Map<string, string>): Result<any, string>;
    setStorage(value: Map<unknown, unknown>): void;
    getStorage(storage?: Snapshot): Map<unknown, unknown>;
    getExecutionEnv(): import("@oraichain/cosmwasm-vm-js").Env;
    get vm(): CWSimulateVMInstance;
    get valid(): boolean;
}
//# sourceMappingURL=contract.d.ts.map