"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Region = void 0;
/**
 * Wrapper class for the Region data structure, which describes a region of
 * WebAssembly's linear memory that has been allocated by the VM.
 *
 * Note that this class is passed a pointer to the data structure, and the
 * Region's members (offset: u32, capacity: u32, length: u32) are read from
 * that pointer as they are laid out in the data structure.
 */
class Region {
    memory;
    ptr;
    /**
     * The region's data structure laid out in memory.
     */
    region_info;
    /**
     * @param memory The WebAssembly.Memory object that this region is associated
     * @param ptr The offset of the region's data structure in memory
     */
    constructor(memory, ptr) {
        this.memory = memory;
        this.ptr = ptr;
        this.region_info = new Uint32Array(memory.buffer, ptr, 3);
    }
    get offset() {
        return this.region_info[0];
    }
    set offset(val) {
        this.region_info[0] = val;
    }
    set capacity(val) {
        this.region_info[1] = val;
    }
    get capacity() {
        return this.region_info[1];
    }
    set length(val) {
        this.region_info[2] = val;
    }
    get length() {
        return this.region_info[2];
    }
    /**
     * Get a byte-slice of the region's data.
     */
    get data() {
        return this.read();
    }
    /**
     * Get a byte-slice of the entire writable region.
     */
    get slice() {
        return new Uint8Array(this.memory.buffer, this.offset, this.capacity);
    }
    /**
     * Get a base64-encoded string of the region's data.
     */
    get b64() {
        return this.read_b64();
    }
    /**
     * Get a string view of the region's data.
     */
    get str() {
        return this.read_str();
    }
    /**
     * Parse the object of the region's data as JSON.
     */
    get json() {
        return this.read_json();
    }
    /**
     * Write a byte-slice to the region.
     * @param bytes The bytes to write to the region
     */
    write(bytes) {
        this.slice.set(bytes);
        this.length = bytes.length;
    }
    /**
     * Write bytes encoded as base64 to the region.
     * @param b64 bytes encoded as base64
     */
    write_b64(b64) {
        this.write(Buffer.from(b64, 'base64'));
    }
    /**
     * Write a string to the region.
     * @param str The string to write to the region
     */
    write_str(str) {
        this.write(new TextEncoder().encode(str));
    }
    /**
     * Write a JSON object to the region as a string.
     * @param obj The object to write to the region
     */
    write_json(obj) {
        this.write_str(JSON.stringify(obj));
    }
    /**
     * Reads the region's data as a Uint8Array.
     * @returns The byte-slice of the region's data.
     */
    read() {
        return new Uint8Array(this.memory.buffer, this.offset, this.length);
    }
    read_b64() {
        return Buffer.from(this.read()).toString('base64');
    }
    /**
     * Reads the region's data as a String.
     * @returns The region's data as a string.
     */
    read_str() {
        return new TextDecoder().decode(this.read());
    }
    /**
     * Parse the region's data as JSON.
     * @returns The region's data as a JSON object.
     */
    read_json() {
        return JSON.parse(this.read_str());
    }
}
exports.Region = Region;
//# sourceMappingURL=memory.js.map