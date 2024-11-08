/**
 * Compares two byte arrays using the same logic as strcmp()
 *
 * @returns {number} bytes1 < bytes2 --> -1; bytes1 == bytes2 --> 0; bytes1 > bytes2 --> 1
 */
export function compare(bytes1: Uint8Array, bytes2: Uint8Array): number {
  const length = Math.max(bytes1.length, bytes2.length);
  for (let i = 0; i < length; i++) {
    if (bytes1.length < i) return -1;
    if (bytes2.length < i) return 1;

    if (bytes1[i] < bytes2[i]) return -1;
    if (bytes1[i] > bytes2[i]) return 1;
  }

  return 0;
}

export function toNumber(bigEndianByteArray: Uint8Array | number[]) {
  let value = 0;
  for (const num of bigEndianByteArray) {
    value = (value << 8) | num;
  }
  return value;
}

export function toByteArray(
  num: number,
  fixedLength: number = 4,
  offset: number = 0
) {
  if (num === 0) return new Uint8Array(fixedLength ?? 1);
  // log2(1) == 0, ceil(0) = 0
  const byteLength = fixedLength ?? (Math.ceil(Math.log2(num) / 8) || 1);
  const bytes = new Uint8Array(byteLength);
  writeUInt32BE(bytes, num, byteLength - offset);
  return bytes;
}

export function writeUInt32BE(bytes: Uint8Array, num: number, start: number) {
  while (num > 0) {
    bytes[--start] = num & 0b11111111;
    num >>= 8;
  }
}

export function mergeUint8Array(...array: Uint8Array[]) {
  let n = 0;
  for (const item of array) n += item.length;
  const bytes = new Uint8Array(n);
  n = 0;
  for (const item of array) {
    bytes.set(item, n);
    n += item.length;
  }
  return bytes;
}

export function decreaseBytes(bytes: Uint8Array) {
  for (let i = bytes.length - 1; i >= 0; --i) {
    if (bytes[i] === 0) {
      bytes[i] = 255;
    } else {
      bytes[i]--;
      break;
    }
  }
}

export function increaseBytes(bytes: Uint8Array) {
  for (let i = bytes.length - 1; i >= 0; --i) {
    if (bytes[i] === 255) {
      bytes[i] = 0;
    } else {
      bytes[i]++;
      break;
    }
  }
}
