import { SimulateCosmWasmClient } from './SimulateCosmWasmClient';
import { SortedMap } from '@oraichain/immutable';
export declare class BufferStream {
    private readonly filePath;
    private readonly fd;
    private sizeBuf;
    constructor(filePath: string, append: boolean);
    private increaseSize;
    get size(): number;
    close(): void;
    write(entries: Array<[Uint8Array, Uint8Array]>): void;
}
export declare class BufferIter {
    private readonly buf;
    readonly size: number;
    private ind;
    private bufInd;
    constructor(buf: Uint8Array, size: number);
    reset(): this;
    next(): {
        done: boolean;
        value?: undefined;
    } | {
        value: Uint8Array[];
        done?: undefined;
    };
}
export declare class BufferCollection {
    readonly size: number;
    private readonly buf;
    constructor(buf: Uint8Array);
    entries(): BufferIter;
}
export declare class DownloadState {
    readonly rpc: string;
    readonly downloadPath: string;
    readonly height?: number;
    constructor(rpc: string, downloadPath: string, height?: number);
    saveState(contractAddress: string, nextKey?: string): Promise<void>;
    loadStateData(contractAddress: string): SortedMap<Uint8Array, Uint8Array>;
    loadState(client: SimulateCosmWasmClient, senderAddress: string, contractAddress: string, label: string, data?: any, wasmCodePath?: string): Promise<void>;
}
//# sourceMappingURL=fork.d.ts.map