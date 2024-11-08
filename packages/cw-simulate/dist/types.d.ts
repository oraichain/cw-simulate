import Immutable from '@oraichain/immutable';
import { Result } from 'ts-results';
import type { NEVER_IMMUTIFY } from './store/transactional';
import { Attribute, Binary, ContractResponse, Env, IbcTimeout, MessageInfo, SubMsg, Event } from '@oraichain/cosmwasm-vm-js';
export interface AppResponse {
    events: Event[];
    data: string | null;
}
export type RustResult<T> = {
    ok: T;
} | {
    error: string;
};
export type ReplyMsg = {
    id: number;
    result: RustResult<{
        events: Event[];
        data: string | null;
    }>;
};
export interface CodeInfo {
    creator: string;
    wasmCode: Uint8Array;
}
export interface ContractInfo {
    codeId: number;
    creator: string;
    admin: string | null;
    label: string;
    created: number;
}
export interface ContractInfoResponse {
    code_id: number;
    creator: string;
    admin: string | null;
    pinned: boolean;
    ibc_port: string | null;
}
export interface CodeInfoResponse {
    code_id: number;
    creator: string;
    checksum: string;
}
export type DebugLog = PrintDebugLog | CallDebugLog;
export interface PrintDebugLog {
    type: 'print';
    message: string;
}
type Bytes = string;
type NamedArg<T extends any = any> = {
    [name: string]: T;
};
type APIFn<CallArgs extends NamedArg, ReturnType = undefined> = ReturnType extends undefined ? {
    args: CallArgs;
} : {
    args: CallArgs;
    result: ReturnType;
};
interface CosmWasmAPI {
    db_read: APIFn<{
        key: Bytes;
    }, Bytes>;
    db_write: APIFn<{
        key: Bytes;
        value: Bytes;
    }>;
    db_remove: APIFn<{
        key: Bytes;
    }>;
    db_scan: APIFn<{
        start: Bytes;
        end: Bytes;
        order: number;
    }, Bytes>;
    db_next: APIFn<{
        iterator_id: Bytes;
    }, Bytes>;
    addr_humanize: APIFn<{
        source: Bytes;
    }, Bytes>;
    addr_canonicalize: APIFn<{
        source: Bytes;
        destination: Bytes;
    }, Bytes>;
    addr_validate: APIFn<{
        source: Bytes;
    }, Bytes>;
    secp256k1_verify: APIFn<{
        hash: Bytes;
        signature: Bytes;
        pubkey: Bytes;
    }, number>;
    secp256k1_recover_pubkey: APIFn<{
        msgHash: Bytes;
        signature: Bytes;
        recover_param: number;
    }, Bytes>;
    abort: APIFn<{
        message: string;
    }>;
    debug: APIFn<{
        message: string;
    }>;
    ed25519_verify: APIFn<{
        message: Bytes;
        signature: Bytes;
        pubkey: Bytes;
    }, number>;
    ed25519_batch_verify: APIFn<{
        messages_ptr: Bytes;
        signatures_ptr: Bytes;
        pubkeys_ptr: Bytes;
    }, number>;
    query_chain: APIFn<{
        request: Bytes;
    }, Bytes>;
}
type Unionize<T> = T extends {
    [key in keyof T]: infer ValueType;
} ? ValueType : never;
type CallDebugLog<T extends keyof CosmWasmAPI = keyof CosmWasmAPI> = {
    type: 'call';
} & Unionize<{
    [K in T]: {
        fn: K;
    } & CosmWasmAPI[K];
}>;
export type Snapshot = Immutable.Map<unknown, unknown>;
interface TraceLogCommon {
    [NEVER_IMMUTIFY]: true;
    type: string;
    contractAddress: string;
    env: Env;
    msg: any;
    response: Result<ContractResponse, string>;
    logs: DebugLog[];
    traces?: TraceLog[];
    storeSnapshot: Snapshot;
    result: Result<AppResponse, string>;
}
export type ExecuteTraceLog = TraceLogCommon & {
    type: 'execute' | 'instantiate' | 'migrate';
    info: MessageInfo;
};
export type ReplyTraceLog = TraceLogCommon & {
    type: 'reply';
    msg: ReplyMsg;
};
export type TraceLog = ExecuteTraceLog | ReplyTraceLog;
export interface IbcEndpoint {
    port_id: string;
    channel_id: string;
}
export interface IbcChannel {
    endpoint: IbcEndpoint;
    counterparty_endpoint: IbcEndpoint;
    order: IbcOrder;
    version: string;
    connection_id: string;
}
export declare enum IbcOrder {
    Unordered = "ORDER_UNORDERED",
    Ordered = "ORDER_ORDERED"
}
export interface IbcAcknowledgement {
    data: Binary;
}
export interface IbcPacket {
    data: Binary;
    src: IbcEndpoint;
    dest: IbcEndpoint;
    sequence: number;
    timeout: IbcTimeout;
}
export interface IbcPacketAckMsg {
    acknowledgement: IbcAcknowledgement;
    original_packet: IbcPacket;
    relayer?: string;
}
export interface IbcPacketReceiveMsg {
    packet: IbcPacket;
    relayer?: string;
}
export interface IbcPacketTimeoutMsg {
    packet: IbcPacket;
    relayer?: string;
}
export type IbcChannelOpenMsg = {
    open_init: {
        channel: IbcChannel;
    };
} | {
    open_try: {
        channel: IbcChannel;
        counterparty_version: string;
    };
};
export type IbcChannelCloseMsg = {
    close_init: {
        channel: IbcChannel;
    };
} | {
    close_confirm: {
        channel: IbcChannel;
    };
};
export type IbcChannelConnectMsg = {
    open_ack: {
        channel: IbcChannel;
        counterparty_version: string;
    };
} | {
    open_confirm: {
        channel: IbcChannel;
    };
};
export interface IbcChannelOpenResponse {
    version: string;
}
export interface IbcBasicResponse {
    messages: SubMsg[];
    attributes: Attribute[];
    events: Event[];
}
export interface IbcReceiveResponse {
    acknowledgement: Binary;
    messages: SubMsg[];
    attributes: Attribute[];
    events: Event[];
}
export type StakingQuery = {
    bonded_denom: {};
} | {
    all_delegations: {
        delegator: string;
    };
} | {
    delegation: {
        delegator: string;
        validator: string;
    };
} | {
    all_validators: {};
} | {
    validator: {
        address: string;
    };
};
export type DistributionQuery = {
    delegator_withdraw_address: {
        delegator_address: string;
    };
} | {
    delegation_rewards: {
        delegator_address: string;
        validator_address: string;
    };
} | {
    delegation_total_rewards: {
        delegator_address: string;
    };
} | {
    delegator_validators: {
        delegator_address: string;
    };
};
export type IbcQuery = {
    port_id: {};
} | {
    list_channels: {
        port_id?: string;
    };
} | {
    channel: {
        channel_id: string;
        port_id?: string;
    };
};
export type Uint128 = string;
export interface DenomUnit {
    denom: string;
    exponent: number;
    aliases: string[];
}
export interface Metadata {
    description?: string;
    denom_units: DenomUnit[];
    base?: string;
    display?: string;
    name?: string;
    symbol?: string;
}
export type TokenFactoryMsgOptions = {
    create_denom: {
        subdenom: string;
        metadata?: Metadata;
    };
} | {
    change_admin: {
        denom: string;
        new_admin_address: string;
    };
} | {
    mint_tokens: {
        denom: string;
        amount: Uint128;
        mint_to_address: string;
    };
} | {
    burn_tokens: {
        denom: string;
        amount: Uint128;
        burn_from_address: string;
    };
} | {
    force_transfer: {
        denom: string;
        amount: Uint128;
        from_address: string;
        to_address: string;
    };
} | {
    set_metadata: {
        denom: string;
        metadata: Metadata;
    };
};
export type TokenFactoryMsg = {
    token: TokenFactoryMsgOptions;
};
export type TokenFactoryQueryEnum = {
    full_denom: {
        creator_addr: string;
        subdenom: string;
    };
} | {
    metadata: {
        denom: string;
    };
} | {
    admin: {
        denom: string;
    };
} | {
    denoms_by_creator: {
        creator: string;
    };
} | {
    params: {};
};
export type TokenFactoryQuery = {
    token: TokenFactoryQueryEnum;
};
export {};
//# sourceMappingURL=types.d.ts.map