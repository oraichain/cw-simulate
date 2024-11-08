import { Coin } from '@cosmjs/amino';
export type Address = string;
export type Decimal = string;
export type Binary = string;
/** Port of [Env (Rust)](https://docs.rs/cosmwasm-std/1.1.4/cosmwasm_std/struct.Env.html) */
export type Env = {
    block: BlockInfo;
    contract: {
        address: Address;
    };
} | {
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
export declare enum ReplyOn {
    Always = "always",
    Never = "never",
    Success = "success",
    Error = "error"
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
export type BankMsg = {
    send: {
        to_address: Address;
        amount: Coin[];
    };
} | {
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
export type WasmMsg = {
    execute: Execute;
} | {
    instantiate: Instantiate;
} | {
    instantiate2: Instantiate2;
} | {
    migrate: Migrate;
};
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
        timeout: IbcTimeout;
    };
};
export type IbcMsgSendPacket = {
    send_packet: {
        channel_id: string;
        data: Binary;
        timeout: IbcTimeout;
    };
};
export type IbcMsgCloseChannel = {
    close_channel: {
        channel_id: string;
    };
};
export type IbcMsg = IbcMsgTransfer | IbcMsgSendPacket | IbcMsgCloseChannel;
export type StakingMsg = {
    delegate: {
        validator: string;
        amount: Coin;
    };
} | {
    undelegate: {
        validator: string;
        amount: Coin;
    };
} | {
    redelegate: {
        src_validator: string;
        dst_validator: string;
        amount: Coin;
    };
};
export type DistributionMsg = {
    set_withdraw_address: {
        address: string;
    };
} | {
    withdraw_delegator_reward: {
        validator: string;
    };
};
export declare enum VoteOption {
    Yes = 0,
    No = 1,
    Abstain = 2,
    NoWithVeto = 3
}
export interface WeightedVoteOption {
    option: VoteOption;
    weight: Decimal;
}
export type GovMsg = {
    vote: {
        proposal_id: number;
        vote: VoteOption;
    };
} | {
    vote_weighted: {
        proposal_id: number;
        options: WeightedVoteOption[];
    };
};
export type CosmosMsg<T = any> = {
    bank: BankMsg;
} | {
    custom: T;
} | {
    staking: StakingMsg;
} | {
    distribution: DistributionMsg;
} | {
    stargate: {
        type_url: string;
        value: Binary;
    };
} | {
    ibc: IbcMsg;
} | {
    wasm: WasmMsg;
} | {
    gov: GovMsg;
};
export interface ContractResponse {
    messages: SubMsg[];
    events: Event[];
    attributes: Attribute[];
    data: Binary | null;
}
export declare class GenericError extends Error {
    constructor(msg: string);
}
//# sourceMappingURL=types.d.ts.map