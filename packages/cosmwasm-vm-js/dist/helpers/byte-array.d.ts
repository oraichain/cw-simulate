/**
 * Compares two byte arrays using the same logic as strcmp()
 *
 * @returns {number} bytes1 < bytes2 --> -1; bytes1 == bytes2 --> 0; bytes1 > bytes2 --> 1
 */
export declare function compare(bytes1: Uint8Array, bytes2: Uint8Array): number;
export declare function toNumber(bigEndianByteArray: Uint8Array | number[]): number;
export declare function toByteArray(num: number, fixedLength?: number, offset?: number): Uint8Array;
export declare function writeUInt32BE(bytes: Uint8Array, num: number, start: number): void;
export declare function mergeUint8Array(...array: Uint8Array[]): Uint8Array;
export declare function decreaseBytes(bytes: Uint8Array): void;
export declare function increaseBytes(bytes: Uint8Array): void;
//# sourceMappingURL=byte-array.d.ts.map