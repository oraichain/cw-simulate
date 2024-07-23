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

export type StakingQuery =
  | {
      /// Returns the denomination that can be bonded (if there are multiple native tokens on the chain)
      bonded_denom: {};
    }
  | {
      /// AllDelegations will return all delegations by the delegator
      all_delegations: { delegator: string };
      /// Delegation will return more detailed info on a particular
      /// delegation, defined by delegator/validator pair
    }
  | {
      delegation: {
        delegator: string;
        validator: string;
      };
    }
  | {
      /// Returns all validators in the currently active validator set.
      ///
      /// The query response type is `AllValidatorsResponse`.
      all_validators: {};
    }
  | {
      /// Returns the validator at the given address. Returns None if the validator is
      /// not part of the currently active validator set.
      ///
      /// The query response type is `ValidatorResponse`.
      validator: {
        /// The validator's address (e.g. (e.g. cosmosvaloper1...))
        address: string;
      };
    };

export type DistributionQuery =
  | {
      /// See <https://github.com/cosmos/cosmos-sdk/blob/c74e2887b0b73e81d48c2f33e6b1020090089ee0/proto/cosmos/distribution/v1beta1/query.proto#L222-L230>
      delegator_withdraw_address: { delegator_address: string };
    }
  | {
      /// See <https://github.com/cosmos/cosmos-sdk/blob/c74e2887b0b73e81d48c2f33e6b1020090089ee0/proto/cosmos/distribution/v1beta1/query.proto#L157-L167>
      delegation_rewards: {
        delegator_address: string;
        validator_address: string;
      };
    }
  | {
      /// See <https://github.com/cosmos/cosmos-sdk/blob/c74e2887b0b73e81d48c2f33e6b1020090089ee0/proto/cosmos/distribution/v1beta1/query.proto#L180-L187>
      delegation_total_rewards: { delegator_address: string };
    }
  | {
      /// See <https://github.com/cosmos/cosmos-sdk/blob/b0acf60e6c39f7ab023841841fc0b751a12c13ff/proto/cosmos/distribution/v1beta1/query.proto#L202-L210>
      delegator_validators: { delegator_address: string };
    };

export type IbcQuery =
  | {
      /// Gets the Port ID the current contract is bound to.
      ///
      /// Returns a `PortIdResponse`.
      port_id: {};
    }
  | {
      /// Lists all channels that are bound to a given port.
      /// If `port_id` is omitted, this list all channels bound to the contract's port.
      ///
      /// Returns a `ListChannelsResponse`.
      list_channels: { port_id?: string };
    }
  | {
      /// Lists all information for a (portID, channelID) pair.
      /// If port_id is omitted, it will default to the contract's own channel.
      /// (To save a PortId{} call)
      ///
      /// Returns a `ChannelResponse`.
      channel: {
        channel_id: string;
        port_id?: string;
      };
      // TODO: Add more
    };

export type Uint128 = string;

export interface DenomUnit {
  /// denom represents the string name of the given denom unit (e.g uatom).
  denom: string;
  /// exponent represents power of 10 exponent that one must
  /// raise the base_denom to in order to equal the given DenomUnit's denom
  /// 1 denom = 1^exponent base_denom
  /// (e.g. with a base_denom of uatom, one can create a DenomUnit of 'atom' with
  /// exponent = 6, thus: 1 atom = 10^6 uatom).
  exponent: number;
  /// aliases is a list of string aliases for the given denom
  aliases: string[];
}

export interface Metadata {
  description?: string;
  /// denom_units represents the list of DenomUnit's for a given coin
  denom_units: DenomUnit[];
  /// base represents the base denom (should be the DenomUnit with exponent = 0).
  base?: string;
  /// display indicates the suggested denom that should be displayed in clients.
  display?: string;
  /// name defines the name of the token (eg: Cosmos Atom)
  name?: string;
  /// symbol is the token symbol usually shown on exchanges (eg: ATOM). This can
  /// be the same as the display.
  symbol?: string;
}

export type TokenFactoryMsgOptions =
  | {
      /// CreateDenom creates a new factory denom, of denomination:
      /// factory/{creating contract bech32 address}/{Subdenom}
      /// Subdenom can be of length at most 44 characters, in [0-9a-zA-Z./]
      /// Empty subdenoms are valid.
      /// The (creating contract address, subdenom) pair must be unique.
      /// The created denom's admin is the creating contract address,
      /// but this admin can be changed using the UpdateAdmin binding.
      ///
      /// If you set an initial metadata here, this is equivalent
      /// to calling SetMetadata directly on the returned denom.
      create_denom: {
        subdenom: string;
        // TODO investigate if this is interoperable with Osmosis
        metadata?: Metadata;
      };
    }
  | {
      /// ChangeAdmin changes the admin for a factory denom.
      /// Can only be called by the current contract admin.
      /// If the NewAdminAddress is empty, the denom will have no admin.
      change_admin: {
        denom: string;
        new_admin_address: string;
      };
    }
  | {
      /// Contracts can mint native tokens for an existing factory denom
      /// that they are the admin of.
      mint_tokens: {
        denom: string;
        amount: Uint128;
        mint_to_address: string;
      };
    }
  | {
      /// Contracts can burn native tokens for an existing factory denom
      /// tshat they are the admin of.
      burn_tokens: {
        denom: string;
        amount: Uint128;
        burn_from_address: string;
      };
    }
  | {
      /// Contracts can force transfer tokens for an existing factory denom
      /// that they are the admin of.
      force_transfer: {
        denom: string;
        amount: Uint128;
        from_address: string;
        to_address: string;
      };
    }
  | {
      set_metadata: {
        denom: string;
        metadata: Metadata;
      };
    };

export type TokenFactoryMsg = {
  token: TokenFactoryMsgOptions;
};

export type TokenFactoryQueryEnum =
  | {
      /// Given a subdenom created by the address `creator_addr` via `OsmosisMsg::CreateDenom`,
      /// returns the full denom as used by `BankMsg::Send`.
      /// You may call `FullDenom { creator_addr: env.contract.address, subdenom }` to find the denom issued
      /// by the current contract.
      full_denom: {
        creator_addr: string;
        subdenom: string;
      };
    }
  | {
      /// Returns the metadata set for this denom, if present. May return None.
      /// This will also return metadata for native tokens created outside
      /// of the token factory (like staking tokens)
      metadata: { denom: string };
    }
  | {
      /// Returns info on admin of the denom, only if created/managed via token factory.
      /// Errors if denom doesn't exist or was created by another module.
      admin: { denom: string };
    }
  | {
      /// List all denoms that were created by the given creator.
      /// This does not imply all tokens currently managed by the creator.
      /// (Admin may have changed)
      denoms_by_creator: { creator: string };
    }
  | {
      /// Returns configuration params for TokenFactory modules
      params: {};
    };

export type TokenFactoryQuery = {
  token: TokenFactoryQueryEnum;
};
