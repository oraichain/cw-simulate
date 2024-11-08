import { Coin } from '@cosmjs/amino';
export type Address = string;
export type Decimal = string;
export type Binary = string;

/** Port of [Env (Rust)](https://docs.rs/cosmwasm-std/1.1.4/cosmwasm_std/struct.Env.html) */
export type Env =
  | {
      block: BlockInfo;
      contract: {
        address: Address;
      };
    }
  | {
      block: BlockInfo;
      transaction: {
        index: number | string;
      } | null;
      contract: {
        address: Address;
      };
    };

export interface Attribute {
  key: string;
  value: string;
}

export interface Event {
  type: string;
  attributes: Attribute[];
}

export interface SubMsg {
  id: number;
  msg: CosmosMsg;
  gas_limit: number | null;
  reply_on: ReplyOn;
}

export enum ReplyOn {
  Always = 'always',
  Never = 'never',
  Success = 'success',
  Error = 'error',
}

export interface BlockInfo {
  height: number | string;
  time: number | string;
  chain_id: string;
}

/** Port of [MessageInfo (Rust)](https://docs.rs/cosmwasm-std/1.1.4/cosmwasm_std/struct.MessageInfo.html) */
export interface MessageInfo {
  sender: Address;
  funds: Coin[];
}

export type BankMsg =
  | {
      send: {
        to_address: Address;
        amount: Coin[];
      };
    }
  | {
      burn: {
        amount: Coin[];
      };
    };

export interface Execute {
  contract_addr: Address;
  msg: Binary;
  funds: Coin[];
}

export interface Instantiate {
  admin: Address | null;
  code_id: number;
  msg: Binary;
  funds: Coin[];
  label: string;
}

export interface Instantiate2 extends Instantiate {
  salt: Binary;
}

export interface Migrate {
  contract_addr: Address;
  new_code_id: number;
  msg: Binary;
}

export type WasmMsg =
  | { execute: Execute }
  | { instantiate: Instantiate }
  | { instantiate2: Instantiate2 }
  | { migrate: Migrate };

/// IBC types
export interface IbcTimeoutBlock {
  revision: number;
  height: number;
}

export interface IbcTimeout {
  block?: IbcTimeoutBlock;
  timestamp?: string;
}

export type IbcMsgTransfer = {
  transfer: {
    channel_id: string;
    to_address: Address;
    amount: Coin;
    /// when packet times out, measured on remote chain
    timeout: IbcTimeout;
  };
};

export type IbcMsgSendPacket = {
  send_packet: {
    channel_id: string;
    data: Binary;
    /// when packet times out, measured on remote chain
    timeout: IbcTimeout;
  };
};

export type IbcMsgCloseChannel = {
  close_channel: { channel_id: string };
};

export type IbcMsg = IbcMsgTransfer | IbcMsgSendPacket | IbcMsgCloseChannel;

export type StakingMsg =
  | { delegate: { validator: string; amount: Coin } }
  /// This is translated to a [MsgUndelegate](https://github.com/cosmos/cosmos-sdk/blob/v0.40.0/proto/cosmos/staking/v1beta1/tx.proto#L112-L121).
  /// `delegator_address` is automatically filled with the current contract's address.
  | { undelegate: { validator: string; amount: Coin } }
  /// This is translated to a [MsgBeginRedelegate](https://github.com/cosmos/cosmos-sdk/blob/v0.40.0/proto/cosmos/staking/v1beta1/tx.proto#L95-L105).
  /// `delegator_address` is automatically filled with the current contract's address.
  | {
      redelegate: {
        src_validator: string;
        dst_validator: string;
        amount: Coin;
      };
    };

export type DistributionMsg =
  | {
      /// This is translated to a [MsgSetWithdrawAddress](https://github.com/cosmos/cosmos-sdk/blob/v0.42.4/proto/cosmos/distribution/v1beta1/tx.proto#L29-L37).
      /// `delegator_address` is automatically filled with the current contract's address.
      set_withdraw_address: {
        /// The `withdraw_address`
        address: string;
      };
    }
  /// This is translated to a [[MsgWithdrawDelegatorReward](https://github.com/cosmos/cosmos-sdk/blob/v0.42.4/proto/cosmos/distribution/v1beta1/tx.proto#L42-L50).
  /// `delegator_address` is automatically filled with the current contract's address.
  | {
      withdraw_delegator_reward: {
        /// The `validator_address`
        validator: string;
      };
    };

export enum VoteOption {
  Yes,
  No,
  Abstain,
  NoWithVeto,
}

export interface WeightedVoteOption {
  option: VoteOption;
  weight: Decimal;
}

export type GovMsg =
  | {
      /// This maps directly to [MsgVote](https://github.com/cosmos/cosmos-sdk/blob/v0.42.5/proto/cosmos/gov/v1beta1/tx.proto#L46-L56) in the Cosmos SDK with voter set to the contract address.
      vote: {
        proposal_id: number;
        /// The vote option.
        ///
        /// This should be called "option" for consistency with Cosmos SDK. Sorry for that.
        /// See <https://github.com/CosmWasm/cosmwasm/issues/1571>.
        vote: VoteOption;
      };
    }
  /// This maps directly to [MsgVoteWeighted](https://github.com/cosmos/cosmos-sdk/blob/v0.45.8/proto/cosmos/gov/v1beta1/tx.proto#L66-L78) in the Cosmos SDK with voter set to the contract address.
  | {
      vote_weighted: {
        proposal_id: number;
        options: WeightedVoteOption[];
      };
    };

export type CosmosMsg<T = any> =
  | {
      bank: BankMsg;
    }
  | {
      custom: T;
    }
  | {
      staking: StakingMsg;
    }
  | {
      distribution: DistributionMsg;
    }
  | {
      stargate: {
        type_url: string;
        value: Binary;
      };
    }
  | { ibc: IbcMsg }
  | { wasm: WasmMsg }
  | {
      gov: GovMsg;
    };

/// response

export interface ContractResponse {
  messages: SubMsg[];
  events: Event[];
  attributes: Attribute[];
  data: Binary | null;
}

// general error like javascript error
export class GenericError extends Error {
  constructor(msg: string) {
    super(`Generic error: ${msg}`);
  }
}
