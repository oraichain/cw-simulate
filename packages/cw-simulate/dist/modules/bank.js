"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParsedCoin = exports.BankModule = void 0;
exports.lensFromSnapshot = lensFromSnapshot;
const ts_results_1 = require("ts-results");
const transactional_1 = require("../store/transactional");
class BankModule {
    chain;
    store;
    constructor(chain) {
        this.chain = chain;
        this.store = this.chain.store.db.lens('bank').initialize({
            balances: {},
        });
    }
    send(sender, recipient, amount) {
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
                }
                else {
                    return (0, ts_results_1.Err)(`Sender ${sender} has ${hasCoin?.amount ?? 0} ${coin.denom}, needs ${coin.amount}`);
                }
            }
            senderBalance = senderBalance.filter(c => c.amount > 0);
            // Add amount to recipient
            const recipientBalance = this.getBalance(recipient).map(ParsedCoin.fromCoin);
            for (const coin of parsedCoins) {
                const hasCoin = recipientBalance.find(c => c.denom === coin.denom);
                if (hasCoin) {
                    hasCoin.amount += coin.amount;
                }
                else {
                    recipientBalance.push(coin);
                }
            }
            this.setBalance(sender, senderBalance.map(c => c.toCoin()));
            this.setBalance(recipient, recipientBalance.map(c => c.toCoin()));
            return (0, ts_results_1.Ok)(undefined);
        });
    }
    burn(sender, amount) {
        return this.store.tx(() => {
            let balance = this.getBalance(sender).map(ParsedCoin.fromCoin);
            let parsedCoins = amount.map(ParsedCoin.fromCoin).filter(c => c.amount > 0);
            for (const coin of parsedCoins) {
                const hasCoin = balance.find(c => c.denom === coin.denom);
                if (hasCoin && hasCoin.amount >= coin.amount) {
                    hasCoin.amount -= coin.amount;
                }
                else {
                    return (0, ts_results_1.Err)(`Sender ${sender} has ${hasCoin?.amount ?? 0} ${coin.denom}, needs ${coin.amount}`);
                }
            }
            balance = balance.filter(c => c.amount > 0);
            this.setBalance(sender, balance.map(c => c.toCoin()));
            return (0, ts_results_1.Ok)(undefined);
        });
    }
    mint(sender, amount) {
        return this.store.tx(() => {
            let balance = this.getBalance(sender).map(ParsedCoin.fromCoin);
            let parsedCoins = amount.map(ParsedCoin.fromCoin).filter(c => c.amount > 0);
            for (const coin of parsedCoins) {
                const hasCoin = balance.find(c => c.denom === coin.denom);
                if (hasCoin) {
                    hasCoin.amount += coin.amount;
                }
                else {
                    balance.push(coin);
                }
            }
            balance = balance.filter(c => c.amount > 0);
            this.setBalance(sender, balance.map(c => c.toCoin()));
            return (0, ts_results_1.Ok)(undefined);
        });
    }
    setBalance(address, amount) {
        this.store.tx((setter, deleter) => {
            setter('balances', address)(amount);
            return (0, ts_results_1.Ok)(undefined);
        });
    }
    getBalance(address, storage) {
        return this.lens(storage).getObject('balances', address) ?? [];
    }
    getBalances() {
        return this.store.getObject('balances');
    }
    deleteBalance(address) {
        this.store.tx((_, deleter) => {
            deleter('balances', address);
            return (0, ts_results_1.Ok)(undefined);
        });
    }
    getSupply(denom) {
        return Object.values(this.getBalances())
            .flat()
            .filter(c => c.denom === denom)
            .reduce((total, c) => total + BigInt(c.amount), 0n)
            .toString();
    }
    async handleMsg(sender, msg) {
        if ('send' in msg) {
            const result = this.send(sender, msg.send.to_address, msg.send.amount);
            return result.andThen(() => (0, ts_results_1.Ok)({
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
            }));
        }
        if ('burn' in msg) {
            const result = this.burn(sender, msg.burn.amount);
            return result.andThen(() => (0, ts_results_1.Ok)({
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
            }));
        }
        return (0, ts_results_1.Err)('Unknown bank message');
    }
    handleQuery(query) {
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
    lens(storage) {
        return storage ? lensFromSnapshot(storage) : this.store;
    }
}
exports.BankModule = BankModule;
/** Essentially a `Coin`, but the `amount` is a `bigint` for more convenient use. */
class ParsedCoin {
    denom;
    amount;
    constructor(denom, amount) {
        this.denom = denom;
        this.amount = amount;
    }
    toCoin() {
        return {
            denom: this.denom,
            amount: this.amount.toString(),
        };
    }
    static fromCoin(coin) {
        return new ParsedCoin(coin.denom, BigInt(coin.amount));
    }
}
exports.ParsedCoin = ParsedCoin;
function lensFromSnapshot(snapshot) {
    return new transactional_1.Transactional(snapshot).lens('bank');
}
//# sourceMappingURL=bank.js.map