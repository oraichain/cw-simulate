/**
 * Wrapper class for the Region data structure, which describes a region of
 * WebAssembly's linear memory that has been allocated by the VM.
 *
 * Note that this class is passed a pointer to the data structure, and the
 * Region's members (offset: u32, capacity: u32, length: u32) are read from
 * that pointer as they are laid out in the data structure.
 */
export declare class Region {
    memory: WebAssembly.Memory;
    ptr: number;
    /**
     * The region's data structure laid out in memory.
     */
    region_info: Uint32Array;
    /**
     * @param memory The WebAssembly.Memory object that this region is associated
     * @param ptr The offset of the region's data structure in memory
     */
    constructor(memory: WebAssembly.Memory, ptr: number);
    get offset(): number;
    set offset(val: number);
    set capacity(val: number);
    get capacity(): number;
    set length(val: number);
    get length(): number;
    /**
     * Get a byte-slice of the region's data.
     */
    get data(): Uint8Array;
    /**
     * Get a byte-slice of the entire writable region.
     */
    get slice(): Uint8Array;
    /**
     * Get a base64-encoded string of the region's data.
     */
    get b64(): string;
    /**
     * Get a string view of the region's data.
     */
    get str(): string;
    /**
     * Parse the object of the region's data as JSON.
     */
    get json(): object;
    /**
     * Write a byte-slice to the region.
     * @param bytes The bytes to write to the region
     */
    write(bytes: Uint8Array): void;
    /**
     * Write bytes encoded as base64 to the region.
     * @param b64 bytes encoded as base64
     */
    write_b64(b64: string): void;
    /**
     * Write a string to the region.
     * @param str The string to write to the region
     */
    write_str(str: string): void;
    /**
     * Write a JSON object to the region as a string.
     * @param obj The object to write to the region
     */
    write_json(obj: object): void;
    /**
     * Reads the region's data as a Uint8Array.
     * @returns The byte-slice of the region's data.
     */
    read(): Uint8Array;
    read_b64(): string;
    /**
     * Reads the region's data as a String.
     * @returns The region's data as a string.
     */
    read_str(): string;
    /**
     * Parse the region's data as JSON.
     * @returns The region's data as a JSON object.
     */
    read_json(): object;
}
//# sourceMappingURL=memory.d.ts.map