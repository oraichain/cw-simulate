import { Coin } from '@cosmjs/amino';
import { Result } from 'ts-results';
import { BankMsg } from '@oraichain/cosmwasm-vm-js';
import { CWSimulateApp } from '../CWSimulateApp';
import { TransactionalLens } from '../store/transactional';
import { AppResponse, Snapshot } from '../types';
type BankData = {
    balances: Record<string, Coin[]>;
};
export type BankQuery = {
    balance: {
        address: string;
        denom: string;
    };
} | {
    all_balances: {
        address: string;
    };
} | {
    supply: {
        denom: string;
    };
};
export type BalanceResponse = {
    amount: Coin;
};
export type AllBalancesResponse = {
    amount: Coin[];
};
export type SupplyResponse = {
    amount: Coin;
};
export declare class BankModule {
    readonly chain: CWSimulateApp;
    readonly store: TransactionalLens<BankData>;
    constructor(chain: CWSimulateApp);
    send(sender: string, recipient: string, amount: Coin[]): Result<void, string>;
    burn(sender: string, amount: Coin[]): Result<void, string>;
    mint(sender: string, amount: Coin[]): Result<void, string>;
    setBalance(address: string, amount: Coin[]): void;
    getBalance(address: string, storage?: Snapshot): Coin[];
    getBalances(): Record<string, Coin[]>;
    deleteBalance(address: string): void;
    getSupply(denom: string): string;
    handleMsg(sender: string, msg: BankMsg): Promise<Result<AppResponse, string>>;
    handleQuery(query: BankQuery): BalanceResponse | AllBalancesResponse | SupplyResponse;
    private lens;
}
/** Essentially a `Coin`, but the `amount` is a `bigint` for more convenient use. */
export declare class ParsedCoin {
    readonly denom: string;
    amount: bigint;
    constructor(denom: string, amount: bigint);
    toCoin(): Coin;
    static fromCoin(coin: Coin): ParsedCoin;
}
export declare function lensFromSnapshot(snapshot: Snapshot): TransactionalLens<BankData>;
export {};
//# sourceMappingURL=bank.d.ts.map