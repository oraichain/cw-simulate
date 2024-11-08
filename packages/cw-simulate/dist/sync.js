"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncState = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const SimulateCosmWasmClient_1 = require("./SimulateCosmWasmClient");
const fork_1 = require("./fork");
const common_1 = require("@oraichain/common");
const stargate_1 = require("@cosmjs/stargate");
/**
 * SyncState starts at a custom height
 * Then load all cosmwasm txs from that custom height to end height
 * Allow loading contracts using custom .wasm for debugging and testing
 * If any contract not found -> load state
 * If found -> apply tx -> much faster
 */
class SyncState {
    senderAddress;
    chainConfig;
    downloadPath;
    simulateClient;
    stargateClient;
    /**
     *
     * @param senderAddress admin of the contracts when loading contract states
     * @param chainConfig basic chain info - rpc, chainId, bech32Prefix
     * @param downloadPath path to store contract states. A new dir will be created matching the startHeight
     */
    constructor(senderAddress, chainConfig, downloadPath) {
        this.senderAddress = senderAddress;
        this.chainConfig = chainConfig;
        this.downloadPath = downloadPath;
        this.simulateClient = new SimulateCosmWasmClient_1.SimulateCosmWasmClient({
            chainId: chainConfig.chainId,
            bech32Prefix: chainConfig.bech32Prefix,
            metering: true,
        });
    }
    /**
     * Download contract states from start height, and apply cosmwasm txs from start height to end height
     * @param startHeight start height to load contract states
     * @param endHeight end height to load txs from start to end
     * @param customContractsToDownload relevant contracts to download states
     * @param customWasmCodePaths wasm code paths that will be applied when executing txs for testing
     * @returns
     */
    async sync(startHeight, endHeight, customContractsToDownload = [], customWasmCodePaths = {}) {
        // update download path to be a directory with name as 'startHeight'
        // this would help us re-run our tests based on different start heights -> fork states at different heights
        this.downloadPath = path_1.default.join(this.downloadPath, startHeight.toString());
        if (!fs_1.default.existsSync(this.downloadPath)) {
            fs_1.default.mkdirSync(this.downloadPath);
        }
        console.info('Start forking at block ' + startHeight);
        const [_, txs] = await Promise.all([
            this.downloadContractStates(startHeight, customContractsToDownload, customWasmCodePaths),
            this.searchTxs(startHeight, endHeight),
        ]);
        const results = await this.applyTxs(txs, startHeight, customWasmCodePaths);
        return { results, simulateClient: this.simulateClient, txs };
    }
    async downloadContractStates(height, contractsToDownload, customWasmCodePaths) {
        const downloadState = new fork_1.DownloadState(this.chainConfig.rpc, this.downloadPath, height);
        for (const contract of contractsToDownload) {
            // if there's no already stored state path -> download state from height
            const statePath = path_1.default.join(this.downloadPath, `${contract}.state`);
            if (!fs_1.default.existsSync(statePath)) {
                await downloadState.saveState(contract);
            }
            const info = this.simulateClient.app.wasm.getContractInfo(contract);
            if (!info) {
                const customWasmCodeFound = fs_1.default.existsSync(customWasmCodePaths[contract]);
                // then try saving and loading state
                await downloadState.loadState(this.simulateClient, this.senderAddress, contract, contract, undefined, customWasmCodeFound ? customWasmCodePaths[contract] : undefined);
            }
        }
    }
    async searchTxs(startHeight, endHeight, totalThreads = 4) {
        if (!this.stargateClient) {
            this.stargateClient = await stargate_1.StargateClient.connect(this.chainConfig.rpc, { desiredHeight: startHeight });
        }
        const txSearchInstance = new common_1.TxSearch(this.stargateClient, {
            startHeight,
            endHeight,
            maxThreadLevel: totalThreads,
        });
        const txs = await txSearchInstance.txSearch();
        return txs;
    }
    async applyTxs(txs, startheight, customWasmCodePaths = {}) {
        const msgExecuteContracts = txs.map(tx => this.parseTxToMsgExecuteContractMsgsWithTxData(tx)).flat();
        // first, download states for all involved contracts at startHeight
        await this.downloadContractStates(startheight, 
        // remove duplicates
        Array.from(new Set(msgExecuteContracts.map(msg => msg.contract))), customWasmCodePaths);
        let simulateResults = [];
        for (const msgExecute of msgExecuteContracts) {
            // ignore txs that have the same startHeight since we already have their states stored
            if (msgExecute.height === startheight)
                continue;
            console.log(`Executing tx ${msgExecute.hash} at height ${msgExecute.height}...`);
            // only execute if the contract has some info already
            const res = await this.simulateClient.execute(msgExecute.sender, msgExecute.contract, JSON.parse(Buffer.from(msgExecute.msg).toString()), 'auto');
            simulateResults.push(res);
        }
        return simulateResults;
    }
    parseTxToMsgExecuteContractMsgsWithTxData(tx) {
        const msgs = (0, common_1.parseTxToMsgExecuteContractMsgs)(tx);
        return msgs.map(msg => ({ ...msg, height: tx.height, hash: tx.hash }));
    }
}
exports.SyncState = SyncState;
//# sourceMappingURL=sync.js.map