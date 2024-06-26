import Immutable from '@oraichain/immutable';
import { Result } from 'ts-results';
import type { NEVER_IMMUTIFY } from './store/transactional';
import {
  Attribute,
  Binary,
  ContractResponse,
  Env,
  IbcTimeout,
  MessageInfo,
  SubMsg,
  Event,
} from '@oraichain/cosmwasm-vm-js';

export interface AppResponse {
  events: Event[];
  data: string | null;
}

export type RustResult<T> = { ok: T } | { error: string };

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
  created: number; // chain height
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
  /// The address that initially stored the code
  creator: string;
  /// The hash of the Wasm blob
  checksum: string;
}

export type DebugLog = PrintDebugLog | CallDebugLog;

export interface PrintDebugLog {
  type: 'print';
  message: string;
}

type Bytes = string;

type NamedArg<T extends any = any> = { [name: string]: T };

type APIFn<CallArgs extends NamedArg, ReturnType = undefined> = ReturnType extends undefined
  ? {
      args: CallArgs;
    }
  : {
      args: CallArgs;
      result: ReturnType;
    };

interface CosmWasmAPI {
  db_read: APIFn<{ key: Bytes }, Bytes>;
  db_write: APIFn<{ key: Bytes; value: Bytes }>;
  db_remove: APIFn<{ key: Bytes }>;
  db_scan: APIFn<{ start: Bytes; end: Bytes; order: number }, Bytes>;
  db_next: APIFn<{ iterator_id: Bytes }, Bytes>;
  addr_humanize: APIFn<{ source: Bytes }, Bytes>;
  addr_canonicalize: APIFn<{ source: Bytes; destination: Bytes }, Bytes>;
  addr_validate: APIFn<{ source: Bytes }, Bytes>;
  secp256k1_verify: APIFn<{ hash: Bytes; signature: Bytes; pubkey: Bytes }, number>;
  secp256k1_recover_pubkey: APIFn<{ msgHash: Bytes; signature: Bytes; recover_param: number }, Bytes>;
  abort: APIFn<{ message: string }>;
  debug: APIFn<{ message: string }>;
  ed25519_verify: APIFn<{ message: Bytes; signature: Bytes; pubkey: Bytes }, number>;
  ed25519_batch_verify: APIFn<{ messages_ptr: Bytes; signatures_ptr: Bytes; pubkeys_ptr: Bytes }, number>;
  query_chain: APIFn<{ request: Bytes }, Bytes>;
}

type Unionize<T> = T extends { [key in keyof T]: infer ValueType } ? ValueType : never;

type CallDebugLog<T extends keyof CosmWasmAPI = keyof CosmWasmAPI> = {
  type: 'call';
} & Unionize<{
  [K in T]: { fn: K } & CosmWasmAPI[K];
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

export enum IbcOrder {
  Unordered = 'ORDER_UNORDERED',
  Ordered = 'ORDER_ORDERED',
}

export interface IbcAcknowledgement {
  data: Binary;
}

export interface IbcPacket {
  /// The raw data sent from the other side in the packet
  data: Binary;
  /// identifies the channel and port on the sending chain.
  src: IbcEndpoint;
  /// identifies the channel and port on the receiving chain.
  dest: IbcEndpoint;
  /// The sequence number of the packet on the given channel
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

export type IbcChannelOpenMsg =
  | { open_init: { channel: IbcChannel } }
  | {
      open_try: {
        channel: IbcChannel;
        counterparty_version: string;
      };
    };

export type IbcChannelCloseMsg =
  | { close_init: { channel: IbcChannel } }
  | {
      close_confirm: {
        channel: IbcChannel;
      };
    };

export type IbcChannelConnectMsg =
  | {
      open_ack: {
        channel: IbcChannel;
        counterparty_version: string;
      };
    }
  | {
      open_confirm: { channel: IbcChannel };
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
