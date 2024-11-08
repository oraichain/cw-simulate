"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DownloadState = exports.BufferCollection = exports.BufferIter = exports.BufferStream = void 0;
// @ts-nocheck
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const cosmwasm_vm_js_1 = require("@oraichain/cosmwasm-vm-js");
const immutable_1 = require("@oraichain/immutable");
class BufferStream {
    filePath;
    fd;
    sizeBuf;
    constructor(filePath, append) {
        this.filePath = filePath;
        if (!append || !fs_1.default.existsSync(filePath)) {
            this.sizeBuf = Buffer.alloc(4);
            fs_1.default.writeFileSync(filePath, this.sizeBuf);
            this.fd = fs_1.default.openSync(filePath, 'r+');
        }
        else {
            this.fd = fs_1.default.openSync(filePath, 'r+');
            this.sizeBuf = Buffer.allocUnsafe(4);
            fs_1.default.readSync(this.fd, this.sizeBuf, 0, 4, 0);
        }
    }
    increaseSize() {
        for (let i = this.sizeBuf.length - 1; i >= 0; --i) {
            if (this.sizeBuf[i] === 255) {
                this.sizeBuf[i] = 0;
            }
            else {
                this.sizeBuf[i]++;
                break;
            }
        }
    }
    get size() {
        return this.sizeBuf.readUInt32BE();
    }
    close() {
        fs_1.default.closeSync(this.fd);
    }
    write(entries) {
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
        fs_1.default.writeSync(this.fd, this.sizeBuf, 0, 4, 0);
        // append item
        fs_1.default.appendFileSync(this.filePath, outputBuffer);
    }
}
exports.BufferStream = BufferStream;
class BufferIter {
    buf;
    size;
    ind = 0;
    bufInd = 0;
    constructor(buf, size) {
        this.buf = buf;
        this.size = size;
    }
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
exports.BufferIter = BufferIter;
class BufferCollection {
    size;
    buf;
    constructor(buf) {
        // first 4 bytes is for uint32 be
        this.size = (0, cosmwasm_vm_js_1.toNumber)(buf.subarray(0, 4));
        this.buf = buf.subarray(4);
    }
    entries() {
        return new BufferIter(this.buf, this.size);
    }
}
exports.BufferCollection = BufferCollection;
BufferCollection.prototype['@@__IMMUTABLE_KEYED__@@'] = true;
// helper function
const downloadState = async (lcd, contractAddress, writeCallback, endCallback, startAfter, limit = 5000, height) => {
    let nextKey = startAfter;
    let headers = new Headers();
    if (height)
        headers.append('x-cosmos-block-height', height.toFixed());
    while (true) {
        const url = new URL(`${lcd}/cosmwasm/wasm/v1/contract/${contractAddress}/state`);
        url.searchParams.append('pagination.limit', limit.toString());
        if (nextKey) {
            url.searchParams.append('pagination.key', nextKey);
            console.log('nextKey', nextKey);
        }
        try {
            const { models, pagination } = await fetch(url.toString(), {
                signal: AbortSignal.timeout(30000),
                headers,
            }).then(res => res.json());
            writeCallback(models);
            if (!(nextKey = pagination.next_key)) {
                return endCallback();
            }
        }
        catch (ex) {
            await new Promise(r => setTimeout(r, 1000));
        }
    }
};
class DownloadState {
    lcd;
    downloadPath;
    height;
    constructor(lcd, downloadPath, height) {
        this.lcd = lcd;
        this.downloadPath = downloadPath;
        this.height = height;
    }
    // if there is nextKey then append, otherwise insert
    async saveState(contractAddress, nextKey) {
        const bufStream = new BufferStream(path_1.default.join(this.downloadPath, `${contractAddress}.state`), !!nextKey);
        await new Promise(resolve => {
            downloadState(this.lcd, contractAddress, (chunks) => {
                const entries = chunks.map(({ key, value }) => [Buffer.from(key, 'hex'), Buffer.from(value, 'base64')]);
                bufStream.write(entries);
            }, resolve, nextKey, undefined, this.height);
        });
        bufStream.close();
        // check contract code
        const contractFile = path_1.default.join(this.downloadPath, contractAddress);
        if (!fs_1.default.existsSync(contractFile)) {
            const { contract_info: { code_id }, } = await fetch(`${this.lcd}/cosmwasm/wasm/v1/contract/${contractAddress}`).then(res => res.json());
            const { data } = await fetch(`${this.lcd}/cosmwasm/wasm/v1/code/${code_id}`).then(res => res.json());
            fs_1.default.writeFileSync(contractFile, Buffer.from(data, 'base64'));
        }
        console.log('done');
    }
    loadStateData(contractAddress) {
        const buffer = fs_1.default.readFileSync(path_1.default.join(this.downloadPath, `${contractAddress}.state`));
        // @ts-ignore
        return immutable_1.SortedMap.rawPack(new BufferCollection(buffer), cosmwasm_vm_js_1.compare);
    }
    async loadState(client, senderAddress, contractAddress, label, data) {
        const { codeId } = await client.upload(senderAddress, fs_1.default.readFileSync(path_1.default.join(this.downloadPath, contractAddress)), 'auto');
        await client.loadContract(contractAddress, {
            codeId,
            admin: senderAddress,
            label,
            creator: senderAddress,
            created: 1,
        }, data ?? this.loadStateData(contractAddress));
    }
}
exports.DownloadState = DownloadState;
//# sourceMappingURL=fork-old.js.map