"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.increaseBytes = exports.decreaseBytes = exports.mergeUint8Array = exports.writeUInt32BE = exports.toByteArray = exports.toNumber = exports.compare = void 0;
/**
 * Compares two byte arrays using the same logic as strcmp()
 *
 * @returns {number} bytes1 < bytes2 --> -1; bytes1 == bytes2 --> 0; bytes1 > bytes2 --> 1
 */
function compare(bytes1, bytes2) {
    const length = Math.max(bytes1.length, bytes2.length);
    for (let i = 0; i < length; i++) {
        if (bytes1.length < i)
            return -1;
        if (bytes2.length < i)
            return 1;
        if (bytes1[i] < bytes2[i])
            return -1;
        if (bytes1[i] > bytes2[i])
            return 1;
    }
    return 0;
}
exports.compare = compare;
function toNumber(bigEndianByteArray) {
    let value = 0;
    for (const num of bigEndianByteArray) {
        value = (value << 8) | num;
    }
    return value;
}
exports.toNumber = toNumber;
function toByteArray(num, fixedLength = 4, offset = 0) {
    if (num === 0)
        return new Uint8Array(fixedLength ?? 1);
    // log2(1) == 0, ceil(0) = 0
    const byteLength = fixedLength ?? (Math.ceil(Math.log2(num) / 8) || 1);
    const bytes = new Uint8Array(byteLength);
    writeUInt32BE(bytes, num, byteLength - offset);
    return bytes;
}
exports.toByteArray = toByteArray;
function writeUInt32BE(bytes, num, start) {
    while (num > 0) {
        bytes[--start] = num & 0b11111111;
        num >>= 8;
    }
}
exports.writeUInt32BE = writeUInt32BE;
function mergeUint8Array(...array) {
    let n = 0;
    for (const item of array)
        n += item.length;
    const bytes = new Uint8Array(n);
    n = 0;
    for (const item of array) {
        bytes.set(item, n);
        n += item.length;
    }
    return bytes;
}
exports.mergeUint8Array = mergeUint8Array;
function decreaseBytes(bytes) {
    for (let i = bytes.length - 1; i >= 0; --i) {
        if (bytes[i] === 0) {
            bytes[i] = 255;
        }
        else {
            bytes[i]--;
            break;
        }
    }
}
exports.decreaseBytes = decreaseBytes;
function increaseBytes(bytes) {
    for (let i = bytes.length - 1; i >= 0; --i) {
        if (bytes[i] === 255) {
            bytes[i] = 0;
        }
        else {
            bytes[i]++;
            break;
        }
    }
}
exports.increaseBytes = increaseBytes;
//# sourceMappingURL=byte-array.js.map