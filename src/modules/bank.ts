import { Coin } from '@cosmjs/amino';
import { Err, Ok, Result } from 'ts-results';
import { BankMsg } from '@oraichain/cosmwasm-vm-js';
import { CWSimulateApp } from '../CWSimulateApp';
import { Transactional, TransactionalLens } from '../store/transactional';
import { AppResponse, Snapshot } from '../types';

type BankData = {
  balances: Record<string, Coin[]>;
};

export type BankQuery =
  | {
      balance: {
        address: string;
        denom: string;
      };
    }
  | {
      all_balances: {
        address: string;
      };
    }
  | {
      supply: {
        denom: string;
      };
    };

export type BalanceResponse = { amount: Coin };
export type AllBalancesResponse = { amount: Coin[] };
export type SupplyResponse = {
  amount: Coin;
};

export class BankModule {
  public readonly store: TransactionalLens<BankData>;

  constructor(public readonly chain: CWSimulateApp) {
    this.store = this.chain.store.db.lens<BankData>('bank').initialize({
      balances: {},
    });
  }

  public send(sender: string, recipient: string, amount: Coin[]): Result<void, string> {
    return this.store.tx(() => {
      let senderBalance = this.getBalance(sender)
        .map(ParsedCoin.fromCoin)
        .filter(c => c.amount > 0);
      const parsedCoins = amount.map(ParsedCoin.fromCoin).filter(c => c.amount > 0);

      // Deduct coins from sender
      for (const coin of parsedCoins) {
        const hasCoin = senderBalance.find(c => c.denom === coin.denom);

        if (hasCoin && hasCoin.amount >= coin.amount) {
          hasCoin.amount -= coin.amount;
        } else {
          return Err(`Sender ${sender} has ${hasCoin?.amount ?? 0} ${coin.denom}, needs ${coin.amount}`);
        }
      }
      senderBalance = senderBalance.filter(c => c.amount > 0);

      // Add amount to recipient
      const recipientBalance = this.getBalance(recipient).map(ParsedCoin.fromCoin);
      for (const coin of parsedCoins) {
        const hasCoin = recipientBalance.find(c => c.denom === coin.denom);

        if (hasCoin) {
          hasCoin.amount += coin.amount;
        } else {
          recipientBalance.push(coin);
        }
      }

      this.setBalance(
        sender,
        senderBalance.map(c => c.toCoin())
      );
      this.setBalance(
        recipient,
        recipientBalance.map(c => c.toCoin())
      );
      return Ok(undefined);
    });
  }

  public burn(sender: string, amount: Coin[]): Result<void, string> {
    return this.store.tx(() => {
      let balance = this.getBalance(sender).map(ParsedCoin.fromCoin);
      let parsedCoins = amount.map(ParsedCoin.fromCoin).filter(c => c.amount > 0);

      for (const coin of parsedCoins) {
        const hasCoin = balance.find(c => c.denom === coin.denom);

        if (hasCoin && hasCoin.amount >= coin.amount) {
          hasCoin.amount -= coin.amount;
        } else {
          return Err(`Sender ${sender} has ${hasCoin?.amount ?? 0} ${coin.denom}, needs ${coin.amount}`);
        }
      }
      balance = balance.filter(c => c.amount > 0);

      this.setBalance(
        sender,
        balance.map(c => c.toCoin())
      );
      return Ok(undefined);
    });
  }

  public mint(sender: string, amount: Coin[]): Result<void, string> {
    return this.store.tx(() => {
      let balance = this.getBalance(sender).map(ParsedCoin.fromCoin);
      let parsedCoins = amount.map(ParsedCoin.fromCoin).filter(c => c.amount > 0);

      for (const coin of parsedCoins) {
        const hasCoin = balance.find(c => c.denom === coin.denom);
        if (hasCoin) {
          hasCoin.amount += coin.amount;
        } else {
          balance.push(coin);
        }
      }
      balance = balance.filter(c => c.amount > 0);

      this.setBalance(
        sender,
        balance.map(c => c.toCoin())
      );
      return Ok(undefined);
    });
  }

  public setBalance(address: string, amount: Coin[]) {
    this.store.tx((setter, deleter) => {
      setter('balances', address)(amount);
      return Ok(undefined);
    });
  }

  public getBalance(address: string, storage?: Snapshot): Coin[] {
    return this.lens(storage).getObject('balances', address) ?? [];
  }

  public getBalances() {
    return this.store.getObject('balances');
  }

  public deleteBalance(address: string) {
    this.store.tx((_, deleter) => {
      deleter('balances', address);
      return Ok(undefined);
    });
  }

  public getSupply(denom: string): string {
    return Object.values(this.getBalances())
      .flat()
      .filter(c => c.denom === denom)
      .reduce((total, c) => total + BigInt(c.amount), 0n)
      .toString();
  }

  public async handleMsg(sender: string, msg: BankMsg): Promise<Result<AppResponse, string>> {
    if ('send' in msg) {
      const result = this.send(sender, msg.send.to_address, msg.send.amount);
      return result.andThen(() =>
        Ok<AppResponse>({
          events: [
            {
              type: 'transfer',
              attributes: [
                { key: 'recipient', value: msg.send.to_address },
                { key: 'sender', value: sender },
                { key: 'amount', value: JSON.stringify(msg.send.amount) },
              ],
            },
          ],
          data: null,
        })
      );
    }

    if ('burn' in msg) {
      const result = this.burn(sender, msg.burn.amount);
      return result.andThen(() =>
        Ok<AppResponse>({
          events: [
            {
              type: 'burn',
              attributes: [
                { key: 'sender', value: sender },
                { key: 'amount', value: JSON.stringify(msg.burn.amount) },
              ],
            },
          ],
          data: null,
        })
      );
    }

    return Err('Unknown bank message');
  }

  public handleQuery(query: BankQuery): BalanceResponse | AllBalancesResponse | SupplyResponse {
    let bankQuery = query;
    if ('balance' in bankQuery) {
      let { address, denom } = bankQuery.balance;
      const hasCoin = this.getBalance(address).find(c => c.denom === denom);
      return {
        amount: hasCoin ?? { denom, amount: '0' },
      };
    }

    if ('all_balances' in bankQuery) {
      let { address } = bankQuery.all_balances;
      return {
        amount: this.getBalance(address),
      };
    }

    if ('supply' in bankQuery) {
      let { denom } = bankQuery.supply;
      return {
        amount: { denom, amount: this.getSupply(denom) },
      };
    }

    throw new Error('Unknown bank query');
  }

  private lens(storage?: Snapshot) {
    return storage ? lensFromSnapshot(storage) : this.store;
  }
}

/** Essentially a `Coin`, but the `amount` is a `bigint` for more convenient use. */
export class ParsedCoin {
  constructor(public readonly denom: string, public amount: bigint) {}

  toCoin(): Coin {
    return {
      denom: this.denom,
      amount: this.amount.toString(),
    };
  }

  static fromCoin(coin: Coin) {
    return new ParsedCoin(coin.denom, BigInt(coin.amount));
  }
}

export function lensFromSnapshot(snapshot: Snapshot) {
  return new Transactional(snapshot).lens<BankData>('bank');
}
