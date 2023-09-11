import path from 'path';
import fs from 'fs';
import { compare } from '@oraichain/cosmwasm-vm-js';
import { SimulateCosmWasmClient } from './SimulateCosmWasmClient';
import { SortedMap } from '@oraichain/immutable';

export class BufferStream {
  private readonly fd: number;
  private sizeBuf: Buffer;

  constructor(private readonly filePath: string, append: boolean) {
    if (!append || !fs.existsSync(filePath)) {
      this.sizeBuf = Buffer.alloc(4);
      fs.writeFileSync(filePath, this.sizeBuf);
      this.fd = fs.openSync(filePath, 'r+');
    } else {
      this.fd = fs.openSync(filePath, 'r+');
      this.sizeBuf = Buffer.allocUnsafe(4);
      fs.readSync(this.fd, this.sizeBuf, 0, 4, 0);
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
      n += k.length + v.length + 3;
    }
    const outputBuffer = Buffer.allocUnsafe(n);
    let ind = 0;
    for (const [k, v] of entries) {
      outputBuffer[ind++] = k.length;
      outputBuffer.set(k, ind);
      ind += k.length;
      outputBuffer[ind++] = (v.length >> 8) & 0b11111111;
      outputBuffer[ind++] = v.length & 0b11111111;
      outputBuffer.set(v, ind);
      ind += v.length;
      this.increaseSize();
    }

    // update size
    fs.writeSync(this.fd, this.sizeBuf, 0, 4, 0);
    // append item
    fs.appendFileSync(this.filePath, outputBuffer);
  }
}

export class BufferIter {
  private ind: number = 0;
  private bufInd: number = 0;
  constructor(private readonly buf: Buffer, public readonly size: number) {}

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
    const valueLength = (this.buf[this.bufInd++] << 8) | this.buf[this.bufInd++];
    const v = this.buf.subarray(this.bufInd, (this.bufInd += valueLength));
    this.ind++;

    return {
      value: [k, v],
    };
  }
}

export class BufferCollection {
  public readonly size: number;
  private readonly buf: Buffer;
  constructor(buf: Buffer) {
    this.size = buf.readUInt32BE();
    this.buf = buf.subarray(4);
  }

  entries() {
    return new BufferIter(this.buf, this.size);
  }
}

BufferCollection.prototype['@@__IMMUTABLE_KEYED__@@'] = true;

// helper function
const downloadState = async (
  lcd: string,
  contractAddress: string,
  writeCallback: Function,
  endCallback: Function,
  startAfter?: string,
  limit = 5000
) => {
  let nextKey = startAfter;

  while (true) {
    const url = new URL(`${lcd}/cosmwasm/wasm/v1/contract/${contractAddress}/state`);
    url.searchParams.append('pagination.limit', limit.toString());
    if (nextKey) {
      url.searchParams.append('pagination.key', nextKey);
      console.log('nextKey', nextKey);
    }
    try {
      const { models, pagination } = await fetch(url.toString(), { signal: AbortSignal.timeout(30000) }).then(res =>
        res.json()
      );
      writeCallback(models);
      if (!(nextKey = pagination.next_key)) {
        return endCallback();
      }
    } catch (ex) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
};

export class DownloadState {
  constructor(public readonly lcd: string, public readonly downloadPath: string) {}

  // if there is nextKey then append, otherwise insert
  async saveState(contractAddress: string, nextKey?: string) {
    const bufStream = new BufferStream(path.join(this.downloadPath, `${contractAddress}.state`), !!nextKey);
    await new Promise(resolve => {
      downloadState(
        this.lcd,
        contractAddress,
        (chunks: any) => {
          const entries = chunks.map(({ key, value }) => [Buffer.from(key, 'hex'), Buffer.from(value, 'base64')]);
          bufStream.write(entries);
        },
        resolve,
        nextKey
      );
    });
    bufStream.close();

    // check contract code
    const contractFile = path.join(this.downloadPath, contractAddress);
    if (!fs.existsSync(contractFile)) {
      const {
        contract_info: { code_id },
      } = await fetch(`${this.lcd}/cosmwasm/wasm/v1/contract/${contractAddress}`).then(res => res.json());
      const { data } = await fetch(`${this.lcd}/cosmwasm/wasm/v1/code/${code_id}`).then(res => res.json());
      fs.writeFileSync(contractFile, Buffer.from(data, 'base64'));
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
    data: any
  ) {
    const { codeId } = await client.upload(
      senderAddress,
      fs.readFileSync(path.join(this.downloadPath, contractAddress)),
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
      data
    );
  }
}
