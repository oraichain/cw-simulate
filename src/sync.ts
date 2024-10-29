import path from 'path';
import fs from 'fs';
import { SimulateCosmWasmClient } from './SimulateCosmWasmClient';
import { DownloadState } from './fork';
import { parseTxToMsgExecuteContractMsgs, Tx, TxSearch } from '@oraichain/common';
import { StargateClient } from '@cosmjs/stargate';
import { ExecuteResult } from '@cosmjs/cosmwasm-stargate';
import { MsgExecuteContract } from 'cosmjs-types/cosmwasm/wasm/v1/tx';

export type CustomWasmCodePaths = { [contractAddress: string]: string };
export type MsgExecuteContractWithHeight = MsgExecuteContract & { height: number; hash: string };

/**
 * SyncState starts at a custom height
 * Then load all cosmwasm txs from that custom height to end height
 * Allow loading contracts using custom .wasm for debugging and testing
 * If any contract not found -> load state
 * If found -> apply tx -> much faster
 */
export class SyncState {
  private simulateClient: SimulateCosmWasmClient;
  private stargateClient: StargateClient;
  constructor(private senderAddress: string, private readonly rpc: string, private downloadPath: string) {
    this.simulateClient = new SimulateCosmWasmClient({
      chainId: 'oraichain',
      bech32Prefix: 'orai',
      metering: true,
    });
  }

  public async sync(
    startHeight: number,
    endHeight: number,
    customContractsToDownload: string[] = [],
    customWasmCodePaths: CustomWasmCodePaths = {}
  ) {
    // update download path to be a directory with name as 'startHeight'
    // this would help us re-run our tests based on different start heights -> fork states at different heights
    this.downloadPath = path.join(this.downloadPath, startHeight.toString());
    if (!fs.existsSync(this.downloadPath)) {
      fs.mkdirSync(this.downloadPath);
    }

    console.info('Start forking at block ' + startHeight);

    const [_, txs] = await Promise.all([
      this.downloadContractStates(startHeight, customContractsToDownload, customWasmCodePaths),
      this.searchTxs(startHeight, endHeight),
    ]);
    const results = await this.applyTxs(txs, startHeight, customWasmCodePaths);
    return { results, simulateClient: this.simulateClient, txs };
  }

  private async downloadContractStates(
    height: number,
    contractsToDownload: string[],
    customWasmCodePaths: CustomWasmCodePaths
  ) {
    const downloadState = new DownloadState(this.rpc, this.downloadPath, height);
    for (const contract of contractsToDownload) {
      // if there's no already stored state path -> download state from height
      const statePath = path.join(this.downloadPath, `${contract}.state`);
      if (!fs.existsSync(statePath)) {
        await downloadState.saveState(contract);
      }
      const info = this.simulateClient.app.wasm.getContractInfo(contract);
      if (!info) {
        const customWasmCodeFound = fs.existsSync(customWasmCodePaths[contract]);
        // then try saving and loading state
        await downloadState.loadState(
          this.simulateClient,
          this.senderAddress,
          contract,
          contract,
          undefined,
          customWasmCodeFound ? customWasmCodePaths[contract] : undefined
        );
      }
    }
  }

  private async searchTxs(startHeight: number, endHeight: number, totalThreads: number = 4) {
    if (!this.stargateClient) {
      this.stargateClient = await StargateClient.connect(this.rpc, { desiredHeight: startHeight });
    }
    const txSearchInstance = new TxSearch(this.stargateClient, {
      startHeight,
      endHeight,
      maxThreadLevel: totalThreads,
    });

    const txs = await txSearchInstance.txSearch();
    return txs;
  }

  private async applyTxs(txs: Tx[], startheight: number, customWasmCodePaths: CustomWasmCodePaths = {}) {
    const msgExecuteContracts = txs.map(tx => this.parseTxToMsgExecuteContractMsgsWithTxData(tx)).flat();

    // first, download states for all involved contracts at startHeight
    await this.downloadContractStates(
      startheight,
      // remove duplicates
      Array.from(new Set(msgExecuteContracts.map(msg => msg.contract))),
      customWasmCodePaths
    );

    let simulateResults: ExecuteResult[] = [];

    for (const msgExecute of msgExecuteContracts) {
      // ignore txs that have the same startHeight since we already have their states stored
      if (msgExecute.height === startheight) continue;
      console.log(`Executing tx ${msgExecute.hash} at height ${msgExecute.height}...`);
      // only execute if the contract has some info already
      const res = await this.simulateClient.execute(
        msgExecute.sender,
        msgExecute.contract,
        JSON.parse(Buffer.from(msgExecute.msg).toString()),
        'auto'
      );
      simulateResults.push(res);
    }
    return simulateResults;
  }

  private parseTxToMsgExecuteContractMsgsWithTxData(tx: Tx): MsgExecuteContractWithHeight[] {
    const msgs = parseTxToMsgExecuteContractMsgs(tx);
    return msgs.map(msg => ({ ...msg, height: tx.height, hash: tx.hash }));
  }
}
