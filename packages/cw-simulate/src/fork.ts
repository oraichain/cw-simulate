import path from 'path';
import fs from 'fs';
import { compare, toNumber } from '@oraichain/cosmwasm-vm-js';
import { SimulateCosmWasmClient } from './SimulateCosmWasmClient';
import { SortedMap } from '@oraichain/immutable';
import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate';

export class BufferStream {
  private readonly fd: number;
  private sizeBuf: Buffer;

  constructor(private readonly filePath: string, append: boolean) {
    if (!append || !fs.existsSync(filePath)) {
      this.sizeBuf = Buffer.alloc(4);
      fs.writeFileSync(filePath, Uint8Array.from(this.sizeBuf));
      this.fd = fs.openSync(filePath, 'r+');
    } else {
      this.fd = fs.openSync(filePath, 'r+');
      this.sizeBuf = Buffer.allocUnsafe(4);
      fs.readSync(this.fd, Uint8Array.from(this.sizeBuf), 0, 4, 0);
    }
  }

  private increaseSize() {
    for (let i = this.sizeBuf.length - 1; i >= 0; --i) {
      if (this.sizeBuf[i] === 255) {
        this.sizeBuf[i] = 0;
      } else {
        this.sizeBuf[i]++;
        break;
      }
    }
  }

  get size() {
    return this.sizeBuf.readUInt32BE();
  }

  close() {
    fs.closeSync(this.fd);
  }

  write(entries: Array<[Uint8Array, Uint8Array]>) {
    let n = 0;
    for (const [k, v] of entries) {
      n += k.length + v.length + 4;
    }
    const outputBuffer = Buffer.allocUnsafe(n);
    let ind = 0;
    for (const [k, v] of entries) {
      outputBuffer[ind++] = k.length;
      outputBuffer.set(k, ind);
      ind += k.length;
      outputBuffer[ind++] = (v.length >> 16) & 0b11111111;
      outputBuffer[ind++] = (v.length >> 8) & 0b11111111;
      outputBuffer[ind++] = v.length & 0b11111111;
      outputBuffer.set(v, ind);
      ind += v.length;
      this.increaseSize();
    }

    // update size
    fs.writeSync(this.fd, Uint8Array.from(this.sizeBuf), 0, 4, 0);
    // append item
    fs.appendFileSync(this.filePath, Uint8Array.from(outputBuffer));
  }
}

export class BufferIter {
  private ind: number = 0;
  private bufInd: number = 0;
  constructor(private readonly buf: Uint8Array, public readonly size: number) {}

  reset() {
    this.ind = 0;
    this.bufInd = 0;
    return this;
  }

  next() {
    if (this.ind === this.size) {
      return {
        done: true,
      };
    }

    const keyLength = this.buf[this.bufInd++];
    const k = this.buf.subarray(this.bufInd, (this.bufInd += keyLength));
    const valueLength = (this.buf[this.bufInd++] << 16) | (this.buf[this.bufInd++] << 8) | this.buf[this.bufInd++];
    const v = this.buf.subarray(this.bufInd, (this.bufInd += valueLength));
    this.ind++;

    return {
      value: [k, v],
    };
  }
}

export class BufferCollection {
  public readonly size: number;
  private readonly buf: Uint8Array;
  constructor(buf: Uint8Array) {
    // first 4 bytes is for uint32 be
    this.size = toNumber(buf.subarray(0, 4));
    this.buf = buf.subarray(4);
  }

  entries() {
    return new BufferIter(this.buf, this.size);
  }
}

BufferCollection.prototype['@@__IMMUTABLE_KEYED__@@'] = true;

// helper function
const downloadState = async (
  rpc: string,
  contractAddress: string,
  writeCallback: Function,
  endCallback: Function,
  startAfter?: string,
  limit = 5000,
  height?: number
) => {
  let nextKey = startAfter ? Uint8Array.from(Buffer.from(startAfter, 'base64')) : undefined;
  const cosmwasmClient = await CosmWasmClient.connect(rpc, height);

  while (true) {
    try {
      const { models, pagination } = await cosmwasmClient.getAllContractState(contractAddress, nextKey, limit);
      writeCallback(models);
      console.log('next key: ', Buffer.from(pagination.nextKey).toString('base64'));
      if (!pagination.nextKey || pagination.nextKey.length === 0) {
        return endCallback();
      }
      nextKey = pagination.nextKey;
    } catch (ex) {
      console.log('ex downloading state: ', ex);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
};

export class DownloadState {
  constructor(public readonly rpc: string, public readonly downloadPath: string, public readonly height?: number) {}

  // if there is nextKey then append, otherwise insert
  async saveState(contractAddress: string, nextKey?: string) {
    const bufStream = new BufferStream(path.join(this.downloadPath, `${contractAddress}.state`), !!nextKey);
    await new Promise(resolve => {
      downloadState(
        this.rpc,
        contractAddress,
        (chunks: any) => {
          const entries = chunks.map(({ key, value }) => [key, value]);
          bufStream.write(entries);
        },
        resolve,
        nextKey,
        undefined,
        this.height
      );
    });
    bufStream.close();

    // check contract code
    const contractFile = path.join(this.downloadPath, contractAddress);
    if (!fs.existsSync(contractFile)) {
      const client = await CosmWasmClient.connect(this.rpc, this.height);
      const { codeId } = await client.getContract(contractAddress);
      const { data } = await client.getCodeDetails(codeId);
      fs.writeFileSync(contractFile, Uint8Array.from(data));
    }

    console.log('done');
  }

  loadStateData(contractAddress: string): SortedMap<Uint8Array, Uint8Array> {
    const buffer = fs.readFileSync(path.join(this.downloadPath, `${contractAddress}.state`));

    // @ts-ignore
    return SortedMap.rawPack<Uint8Array, Uint8Array>(new BufferCollection(buffer), compare);
  }

  async loadState(
    client: SimulateCosmWasmClient,
    senderAddress: string,
    contractAddress: string,
    label: string,
    data?: any,
    wasmCodePath?: string
  ) {
    const { codeId } = await client.upload(
      senderAddress,
      Uint8Array.from(fs.readFileSync(wasmCodePath ?? path.join(this.downloadPath, contractAddress))),
      'auto'
    );

    await client.loadContract(
      contractAddress,
      {
        codeId,
        admin: senderAddress,
        label,
        creator: senderAddress,
        created: 1,
      },
      data ?? this.loadStateData(contractAddress)
    );
  }
}
