import { Coin } from '@cosmjs/amino';
import { Env, MessageInfo, SubMsg, Attribute, Binary, Address, BankMsg } from '../types';
export interface OlEnv {
    block: OlBlockInfo;
    contract: {
        address: Address;
    };
}
export type OldWasmMsg = {
    execute: {
        contract_addr: Address;
        msg: Binary;
        send: Coin[];
    };
} | {
    instantiate: {
        code_id: number;
        msg: Binary;
        send: Coin[];
        label?: string;
    };
};
export type OldCosmosMsg = {
    bank: BankMsg;
} | {
    wasm: OldWasmMsg;
};
export interface OldContractResponse {
    messages: OldCosmosMsg[];
    submessages?: SubMsg[];
    events: Event[];
    attributes: Attribute[];
    data: Binary | null;
}
export interface OlBlockInfo {
    height: number | string;
    time: number;
    time_nanos: number | string;
    chain_id: string;
}
export interface OldMessageInfo {
    sender: Address;
    sent_funds: Coin[];
}
export declare function getOldEnv({ contract, block: { time, height, chain_id }, }: Env): OlEnv;
export declare function getOldInfo({ sender, funds }: MessageInfo): OldMessageInfo;
export declare function getNewResponse(json: object): object;
