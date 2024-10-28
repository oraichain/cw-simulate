import path from 'path';
import fs from 'fs';
import { compare, toNumber } from '@oraichain/cosmwasm-vm-js';
import { SimulateCosmWasmClient } from './SimulateCosmWasmClient';
import { SortedMap } from '@oraichain/immutable';

export class SyncState {
  constructor(public readonly rpc: string, public readonly height?: number) {}
}
