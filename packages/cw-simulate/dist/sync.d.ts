import { SimulateCosmWasmClient } from './SimulateCosmWasmClient';
import { ExecuteResult } from '@cosmjs/cosmwasm-stargate';
import { MsgExecuteContract } from 'cosmjs-types/cosmwasm/wasm/v1/tx';
export type CustomWasmCodePaths = {
    [contractAddress: string]: string;
};
export type MsgExecuteContractWithHeight = MsgExecuteContract & {
    height: number;
    hash: string;
};
export type ChainConfig = {
    rpc: string;
    chainId: string;
    bech32Prefix: string;
};
/**
 * SyncState starts at a custom height
 * Then load all cosmwasm txs from that custom height to end height
 * Allow loading contracts using custom .wasm for debugging and testing
 * If any contract not found -> load state
 * If found -> apply tx -> much faster
 */
export declare class SyncState {
    private senderAddress;
    private readonly chainConfig;
    private downloadPath;
    private simulateClient;
    private stargateClient;
    /**
     *
     * @param senderAddress admin of the contracts when loading contract states
     * @param chainConfig basic chain info - rpc, chainId, bech32Prefix
     * @param downloadPath path to store contract states. A new dir will be created matching the startHeight
     */
    constructor(senderAddress: string, chainConfig: ChainConfig, downloadPath: string);
    /**
     * Download contract states from start height, and apply cosmwasm txs from start height to end height
     * @param startHeight start height to load contract states
     * @param endHeight end height to load txs from start to end
     * @param customContractsToDownload relevant contracts to download states
     * @param customWasmCodePaths wasm code paths that will be applied when executing txs for testing
     * @returns
     */
    sync(startHeight: number, endHeight: number, customContractsToDownload?: string[], customWasmCodePaths?: CustomWasmCodePaths): Promise<{
        results: ExecuteResult[];
        simulateClient: SimulateCosmWasmClient;
        txs: Tx[];
    }>;
    private downloadContractStates;
    private searchTxs;
    private applyTxs;
    private parseTxToMsgExecuteContractMsgsWithTxData;
}
//# sourceMappingURL=sync.d.ts.map