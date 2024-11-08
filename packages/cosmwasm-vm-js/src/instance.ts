import bech32 from 'bech32';
import { eddsa } from 'elliptic';
import { toHex } from '@cosmjs/encoding';
import { sha256 } from '@cosmjs/crypto';
import { ecdsaRecover, ecdsaVerify } from 'secp256k1';
import { metering } from '@oraichain/wasm-json-toolkit';
import { Region } from './memory';
import { GasInfo, IBackend, Record } from './backend';
import { Env, GenericError, MessageInfo } from './types';
import { toByteArray, toNumber, mergeUint8Array } from './helpers/byte-array';
import { Environment, GAS_PER_OP } from './environment';

export const GAS_COST_HUMANIZE = 44;
export const GAS_COST_CANONICALIZE = 55;
export const GAS_COST_LAST_ITERATION = 37;
export const GAS_COST_RANGE = 11;

export const MAX_LENGTH_DB_KEY: number = 64 * 1024;
export const MAX_LENGTH_DB_VALUE: number = 128 * 1024;
export const MAX_LENGTH_CANONICAL_ADDRESS: number = 90;
export const MAX_LENGTH_HUMAN_ADDRESS: number = 256;

export const MAX_LENGTH_ED25519_SIGNATURE: number = 64;
export const MAX_LENGTH_ED25519_MESSAGE: number = 128 * 1024;
export const EDDSA_PUBKEY_LEN: number = 32;

export class VMInstance {
  // default version
  private _version: number = 8;
  public instance?: WebAssembly.Instance;
  public debugMsgs: string[] = [];

  // override this
  public static eddsa = new eddsa('ed25519');
  private static wasmMeteringCache = new Map<string, WebAssembly.Module>();
  private static wasmCache = new Map<string, WebAssembly.Module>();
  constructor(public backend: IBackend, public readonly env?: Environment) {}

  // checksum can be used to validate wasmByteCode
  public async build(wasmByteCode: Uint8Array, checksum?: string) {
    const imports = {
      env: {
        db_read: this.db_read.bind(this),
        db_write: this.db_write.bind(this),
        db_remove: this.db_remove.bind(this),
        db_scan: this.db_scan.bind(this),
        db_next: this.db_next.bind(this),
        addr_humanize: this.addr_humanize.bind(this),
        addr_canonicalize: this.addr_canonicalize.bind(this),
        addr_validate: this.addr_validate.bind(this),
        secp256k1_verify: this.secp256k1_verify.bind(this),
        secp256k1_recover_pubkey: this.secp256k1_recover_pubkey.bind(this),
        ed25519_verify: this.ed25519_verify.bind(this),
        ed25519_batch_verify: this.ed25519_batch_verify.bind(this),
        curve_hash: this.curve_hash.bind(this),
        poseidon_hash: this.poseidon_hash.bind(this),
        groth16_verify: this.groth16_verify.bind(this),
        keccak_256: this.keccak_256.bind(this),
        sha256: this.sha256.bind(this),
        debug: this.debug.bind(this),
        query_chain: this.query_chain.bind(this),
        abort: this.abort.bind(this),
        // old support
        canonicalize_address: this.addr_canonicalize.bind(this),
        humanize_address: this.addr_humanize.bind(this),
      },
    };
    let mod: WebAssembly.Module;
    if (checksum === undefined) {
      checksum = toHex(sha256(wasmByteCode));
    }
    if (this.env) {
      Object.assign(imports, {
        metering: {
          usegas: (gas: number) => {
            const gasInfo = GasInfo.with_cost(gas * GAS_PER_OP);
            this.env!.processGasInfo(gasInfo);

            if (this.gasUsed > this.gasLimit) {
              throw new Error('out of gas!');
            }
          },
        },
      });

      // check cached first
      if (!VMInstance.wasmMeteringCache.has(checksum)) {
        VMInstance.wasmMeteringCache.set(
          checksum,
          await WebAssembly.compile(metering.meterWASM(wasmByteCode))
        );
      }
      mod = VMInstance.wasmMeteringCache.get(checksum)!;
    } else {
      // check cached first
      if (!VMInstance.wasmCache.has(checksum)) {
        VMInstance.wasmCache.set(
          checksum,
          await WebAssembly.compile(wasmByteCode)
        );
      }
      mod = VMInstance.wasmCache.get(checksum)!;
    }

    // init wasm instance
    this.instance = await WebAssembly.instantiate(mod, imports);

    // support cosmwasm_vm_version_4 (v0.11.0 - v0.13.2)
    if ('cosmwasm_vm_version_4' in this.instance.exports) {
      this._version = 4;
    } else {
      for (const methodName in this.instance.exports) {
        if (methodName.startsWith('interface_version_')) {
          this._version = Number(methodName.substring(18));
          break;
        }
      }
    }
  }

  public set storageReadonly(value: boolean) {
    if (this.env) this.env.storageReadonly = value;
  }

  public get exports(): any {
    if (!this.instance)
      throw new Error('Please init instance before using methods');
    return this.instance.exports;
  }

  public get gasUsed() {
    return this.env?.gasUsed ?? 0;
  }

  public get gasLimit() {
    return this.env?.gasLimit ?? 0;
  }

  public get remainingGas() {
    return this.gasLimit - this.gasUsed;
  }

  public allocate(size: number): Region {
    const { allocate, memory } = this.exports;
    const regPtr = allocate(size);
    return new Region(memory, regPtr);
  }

  public deallocate(region: Region): void {
    const { deallocate } = this.exports;
    deallocate(region.ptr);
  }

  public json(ptr: number): object {
    const region = this.region(ptr);
    const data = region.json;
    this.deallocate(region);
    return data;
  }

  public allocate_bytes(bytes: Uint8Array): Region {
    const region = this.allocate(bytes.length);
    region.write(bytes);
    return region;
  }

  public allocate_b64(b64: string): Region {
    const bytes = Buffer.from(b64, 'base64');
    return this.allocate_bytes(bytes);
  }

  public allocate_str(str: string): Region {
    const region = this.allocate(str.length);
    region.write_str(str);
    return region;
  }

  public allocate_json(obj: object): Region {
    const str = JSON.stringify(obj);
    return this.allocate_str(str);
  }

  public get version(): number {
    return this._version;
  }

  /// storage export will panic if error occurs
  db_read(key_ptr: number): number {
    const key = this.region(key_ptr);
    return this.do_db_read(key).ptr;
  }

  db_write(key_ptr: number, value_ptr: number) {
    const key = this.region(key_ptr);
    const value = this.region(value_ptr);
    this.do_db_write(key, value);
  }

  db_remove(key_ptr: number) {
    const key = this.region(key_ptr);
    this.do_db_remove(key);
  }

  db_scan(start_ptr: number, end_ptr: number, order: number): number {
    const start = this.region(start_ptr);
    const end = this.region(end_ptr);
    return this.do_db_scan(start, end, order).ptr;
  }

  db_next(iterator_id_ptr: number): number {
    const iterator_id = this.region(iterator_id_ptr);
    return this.do_db_next(iterator_id).ptr;
  }
  /// end storage export

  /// api exports return Result, so error need to write to contract
  addr_canonicalize(source_ptr: number, destination_ptr: number): number {
    const source = this.region(source_ptr);
    const destination = this.region(destination_ptr);
    try {
      return this.do_addr_canonicalize(source, destination).ptr;
    } catch (ex) {
      return this.allocate_str((ex as Error).message).ptr;
    }
  }

  addr_humanize(source_ptr: number, destination_ptr: number): number {
    const source = this.region(source_ptr);
    const destination = this.region(destination_ptr);
    try {
      return this.do_addr_humanize(source, destination).ptr;
    } catch (ex) {
      return this.allocate_str((ex as Error).message).ptr;
    }
  }

  addr_validate(source_ptr: number): number {
    const source = this.region(source_ptr);
    try {
      return this.do_addr_validate(source).ptr;
    } catch (ex) {
      return this.allocate_str((ex as Error).message).ptr;
    }
  }

  secp256k1_verify(
    hash_ptr: number,
    signature_ptr: number,
    pubkey_ptr: number
  ): number {
    const hash = this.region(hash_ptr);
    const signature = this.region(signature_ptr);
    const pubkey = this.region(pubkey_ptr);
    try {
      return this.do_secp256k1_verify(hash, signature, pubkey);
    } catch (ex) {
      return this.allocate_str((ex as Error).message).ptr;
    }
  }

  secp256k1_recover_pubkey(
    hash_ptr: number,
    signature_ptr: number,
    recover_param: number
  ): bigint {
    const hash = this.region(hash_ptr);
    const signature = this.region(signature_ptr);

    try {
      return BigInt(
        this.do_secp256k1_recover_pubkey(hash, signature, recover_param).ptr
      );
    } catch (ex) {
      return BigInt(this.allocate_str((ex as Error).message).ptr);
    }
  }

  ed25519_verify(
    message_ptr: number,
    signature_ptr: number,
    pubkey_ptr: number
  ): number {
    const message = this.region(message_ptr);
    const signature = this.region(signature_ptr);
    const pubkey = this.region(pubkey_ptr);
    try {
      return this.do_ed25519_verify(message, signature, pubkey);
    } catch (ex) {
      return this.allocate_str((ex as Error).message).ptr;
    }
  }

  ed25519_batch_verify(
    messages_ptr: number,
    signatures_ptr: number,
    public_keys_ptr: number
  ): number {
    const messages = this.region(messages_ptr);
    const signatures = this.region(signatures_ptr);
    const public_keys = this.region(public_keys_ptr);
    try {
      return this.do_ed25519_batch_verify(messages, signatures, public_keys);
    } catch (ex) {
      return this.allocate_str((ex as Error).message).ptr;
    }
  }

  curve_hash(
    input_ptr: number,
    curve: number,
    destination_ptr: number
  ): number {
    const input = this.region(input_ptr);
    const destination = this.region(destination_ptr);
    try {
      return this.do_curve_hash(input, curve, destination).ptr;
    } catch (ex) {
      return this.allocate_str((ex as Error).message).ptr;
    }
  }

  poseidon_hash(
    left_input_ptr: number,
    right_input_ptr: number,
    curve: number,
    destination_ptr: number
  ): number {
    const left_input = this.region(left_input_ptr);
    const right_input = this.region(right_input_ptr);
    const destination = this.region(destination_ptr);
    try {
      return this.do_poseidon_hash(left_input, right_input, curve, destination)
        .ptr;
    } catch (ex) {
      return this.allocate_str((ex as Error).message).ptr;
    }
  }

  groth16_verify(
    input_ptr: number,
    public_ptr: number,
    vk_ptr: number,
    curve: number
  ): number {
    const input = this.region(input_ptr);
    const proof = this.region(public_ptr);
    const vk = this.region(vk_ptr);
    try {
      return this.do_groth16_verify(input, proof, vk, curve);
    } catch (ex) {
      return this.allocate_str((ex as Error).message).ptr;
    }
  }

  keccak_256(input_ptr: number, destination_ptr: number): number {
    const input = this.region(input_ptr);
    const destination = this.region(destination_ptr);
    try {
      return this.do_keccak_256(input, destination).ptr;
    } catch (ex) {
      return this.allocate_str((ex as Error).message).ptr;
    }
  }

  sha256(input_ptr: number, destination_ptr: number): number {
    const input = this.region(input_ptr);
    const destination = this.region(destination_ptr);
    try {
      return this.do_sha256(input, destination).ptr;
    } catch (ex) {
      return this.allocate_str((ex as Error).message).ptr;
    }
  }
  /// end api exports

  debug(message_ptr: number) {
    const message = this.region(message_ptr);
    this.do_debug(message);
  }

  query_chain(request_ptr: number): number {
    const request = this.region(request_ptr);
    return this.do_query_chain(request).ptr;
  }

  abort(message_ptr: number) {
    const message = this.region(message_ptr);
    this.do_abort(message);
  }

  public region(ptr: number): Region {
    return new Region(this.exports.memory, ptr);
  }

  do_db_read(key: Region): Region {
    const value: Uint8Array | null = this.backend.storage.get(key.data);

    if (key.str.length > MAX_LENGTH_DB_KEY) {
      throw new Error(
        `Key length ${key.str.length} exceeds maximum length ${MAX_LENGTH_DB_KEY}`
      );
    }

    if (this.env) {
      const gasInfo = GasInfo.with_externally_used(key.length);
      this.env.processGasInfo(gasInfo);
    }

    if (value === null) {
      return this.region(0);
    }

    return this.allocate_bytes(value);
  }

  do_db_write(key: Region, value: Region) {
    if (value.str.length > MAX_LENGTH_DB_VALUE) {
      throw new Error(`db_write: value too large: ${value.str}`);
    }

    // throw error for large keys
    if (key.str.length > MAX_LENGTH_DB_KEY) {
      throw new Error(`db_write: key too large: ${key.str}`);
    }

    if (this.env) {
      const gasInfo = GasInfo.with_externally_used(key.length + value.length);
      this.env.processGasInfo(gasInfo);
    }

    this.backend.storage.set(key.data, value.data);
  }

  do_db_remove(key: Region) {
    if (key.length > MAX_LENGTH_DB_KEY) {
      throw new Error(
        `Key length ${key.length} exceeds maximum length ${MAX_LENGTH_DB_KEY}`
      );
    }

    if (this.env) {
      const gasInfo = GasInfo.with_externally_used(key.length);
      this.env.processGasInfo(gasInfo);
    }
    this.backend.storage.remove(key.data);
  }

  do_db_scan(start: Region, end: Region, order: number): Region {
    const iteratorId: Uint8Array = this.backend.storage.scan(
      start.data,
      end.data,
      order
    );

    if (this.env) {
      const gasInfo = GasInfo.with_externally_used(GAS_COST_RANGE);
      this.env.processGasInfo(gasInfo);
    }

    const region = this.allocate(iteratorId.length);
    region.write(iteratorId);

    return region;
  }

  do_db_next(iterator_id: Region): Region {
    const record: Record | null = this.backend.storage.next(iterator_id.data);

    if (record === null) {
      if (this.env) {
        const gasInfo = GasInfo.with_externally_used(GAS_COST_LAST_ITERATION);
        this.env.processGasInfo(gasInfo);
      }
      return this.allocate_bytes(Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 0]));
    }

    // gas cost = key.length + value.length of the item
    if (this.env) {
      const gasInfo = GasInfo.with_externally_used(
        record.key.length + record.value.length
      );
      this.env.processGasInfo(gasInfo);
    }

    // old version following standard: [value,key,key.length]
    const keyBytes = toByteArray(record.key.length, 4);
    if (this.version === 4) {
      return this.allocate_bytes(
        mergeUint8Array(record.value, record.key, keyBytes)
      );
    }

    // separate by 4 bytes [key,key.length,value,value.length]
    const valueBytes = toByteArray(record.value.length, 4);
    return this.allocate_bytes(
      mergeUint8Array(record.key, keyBytes, record.value, valueBytes)
    );
  }

  do_addr_humanize(source: Region, destination: Region): Region {
    if (source.str.length === 0) {
      throw new Error('Empty address.');
    }

    const result = this.backend.backend_api.human_address(source.data);

    destination.write_str(result);

    if (this.env) {
      const gasInfo = GasInfo.with_cost(GAS_COST_HUMANIZE);
      this.env.processGasInfo(gasInfo);
    }

    return new Region(this.exports.memory, 0);
  }

  do_addr_canonicalize(source: Region, destination: Region): Region {
    const source_data = source.str;

    if (source_data.length === 0) {
      throw new Error('Empty address.');
    }

    const result = this.backend.backend_api.canonical_address(source_data);

    destination.write(result);

    if (this.env) {
      const gasInfo = GasInfo.with_cost(GAS_COST_CANONICALIZE);
      this.env.processGasInfo(gasInfo);
    }

    return new Region(this.exports.memory, 0);
  }

  do_addr_validate(source: Region): Region {
    if (source.str.length === 0) {
      throw new Error('Empty address.');
    }

    if (source.str.length > MAX_LENGTH_HUMAN_ADDRESS) {
      throw new GenericError('input too long for addr_validate');
    }

    const canonical = bech32.fromWords(bech32.decode(source.str).words);

    if (canonical.length === 0) {
      throw new Error('Invalid address.');
    }

    const human = bech32.encode(
      this.backend.backend_api.bech32_prefix,
      bech32.toWords(canonical)
    );

    if (this.env) {
      const gasInfo = GasInfo.with_cost(GAS_COST_CANONICALIZE);
      this.env.processGasInfo(gasInfo);
    }

    if (human !== source.str) {
      throw new Error('Invalid address.');
    }
    return new Region(this.exports.memory, 0);
  }

  // Verifies message hashes against a signature with a public key, using the secp256k1 ECDSA parametrization.
  // Returns 0 on verification success, 1 on verification failure
  do_secp256k1_verify(hash: Region, signature: Region, pubkey: Region): number {
    const isValidSignature = ecdsaVerify(
      signature.data,
      hash.data,
      pubkey.data
    );

    if (this.env) {
      const gasInfo = GasInfo.with_cost(
        Environment.gasConfig.secp256k1_verify_cost
      );
      this.env.processGasInfo(gasInfo);
    }

    if (isValidSignature) {
      return 0;
    } else {
      return 1;
    }
  }

  do_secp256k1_recover_pubkey(
    msgHash: Region,
    signature: Region,
    recover_param: number
  ): Region {
    const pub = ecdsaRecover(
      signature.data,
      recover_param,
      msgHash.data,
      false
    );

    if (this.env) {
      const gasInfo = GasInfo.with_cost(
        Environment.gasConfig.secp256k1_recover_pubkey_cost
      );
      this.env.processGasInfo(gasInfo);
    }

    return this.allocate_bytes(pub);
  }

  // Verifies a message against a signature with a public key, using the ed25519 EdDSA scheme.
  // Returns 0 on verification success, 1 on verification failure
  do_ed25519_verify(
    message: Region,
    signature: Region,
    pubkey: Region
  ): number {
    if (message.length > MAX_LENGTH_ED25519_MESSAGE) return 1;
    if (signature.length > MAX_LENGTH_ED25519_SIGNATURE) return 1;
    if (pubkey.length > EDDSA_PUBKEY_LEN) return 1;
    const sig = Buffer.from(signature.data).toString('hex');
    const pub = Buffer.from(pubkey.data).toString('hex');
    const msg = Buffer.from(message.data);
    const _signature = VMInstance.eddsa.makeSignature(sig);
    const _pubkey = VMInstance.eddsa.keyFromPublic(pub);

    const isValidSignature = VMInstance.eddsa.verify(msg, _signature, _pubkey);

    if (this.env) {
      const gasInfo = GasInfo.with_cost(
        Environment.gasConfig.ed25519_verify_cost
      );
      this.env.processGasInfo(gasInfo);
    }

    return isValidSignature === true ? 0 : 1;
  }

  // Verifies a batch of messages against a batch of signatures with a batch of public keys,
  // using the ed25519 EdDSA scheme.
  // Returns 0 on verification success (all batches verify correctly), 1 on verification failure
  // Throw Error is corresponding to panic
  do_ed25519_batch_verify(
    messages_ptr: Region,
    signatures_ptr: Region,
    public_keys_ptr: Region
  ): number {
    let messages = decodeSections(messages_ptr.data);
    const signatures = decodeSections(signatures_ptr.data);
    let publicKeys = decodeSections(public_keys_ptr.data);

    if (
      messages.length === signatures.length &&
      messages.length === publicKeys.length
    ) {
      // Do nothing, we're good to go
    } else if (
      messages.length === 1 &&
      signatures.length == publicKeys.length
    ) {
      const repeated = [];
      for (let i = 0; i < signatures.length; i++) {
        repeated.push(...messages);
      }
      messages = repeated;
    } else if (
      publicKeys.length === 1 &&
      messages.length == signatures.length
    ) {
      const repeated = [];
      for (let i = 0; i < messages.length; i++) {
        repeated.push(...publicKeys);
      }
      publicKeys = repeated;
    } else {
      throw new Error(
        'Lengths of messages, signatures and public keys do not match.'
      );
    }

    if (
      messages.length !== signatures.length ||
      messages.length !== publicKeys.length
    ) {
      throw new Error(
        'Lengths of messages, signatures and public keys do not match.'
      );
    }

    if (this.env) {
      const gasInfo = GasInfo.with_cost(
        Environment.gasConfig.ed25519_batch_verify_cost
      );
      this.env.processGasInfo(gasInfo);
    }

    for (let i = 0; i < messages.length; i++) {
      const message = Buffer.from(messages[i]);
      const signature = Buffer.from(signatures[i]).toString('hex');
      const publicKey = Buffer.from(publicKeys[i]).toString('hex');

      const _signature = VMInstance.eddsa.makeSignature(signature);
      const _publicKey = VMInstance.eddsa.keyFromPublic(publicKey);

      if (VMInstance.eddsa.verify(message, _signature, _publicKey) === false)
        return 1;
    }

    return 0;
  }

  do_curve_hash(input: Region, curve: number, destination: Region): Region {
    const result = this.backend.backend_api.curve_hash(input.data, curve);
    destination.write(result);

    if (this.env) {
      const gasInfo = GasInfo.with_cost(Environment.gasConfig.curve_hash_cost);
      this.env.processGasInfo(gasInfo);
    }

    return new Region(this.exports.memory, 0);
  }

  do_keccak_256(input: Region, destination: Region): Region {
    const result = this.backend.backend_api.keccak_256(input.data);
    destination.write(result);

    if (this.env) {
      const gasInfo = GasInfo.with_cost(Environment.gasConfig.keccak_256_cost);
      this.env.processGasInfo(gasInfo);
    }

    return new Region(this.exports.memory, 0);
  }

  do_sha256(input: Region, destination: Region): Region {
    const result = this.backend.backend_api.sha256(input.data);
    destination.write(result);

    if (this.env) {
      const gasInfo = GasInfo.with_cost(Environment.gasConfig.sha256_cost);
      this.env.processGasInfo(gasInfo);
    }

    return new Region(this.exports.memory, 0);
  }

  do_poseidon_hash(
    left_input: Region,
    right_input: Region,
    curve: number,
    destination: Region
  ): Region {
    const result = this.backend.backend_api.poseidon_hash(
      left_input.data,
      right_input.data,
      curve
    );
    destination.write(result);

    if (this.env) {
      const gasInfo = GasInfo.with_cost(
        Environment.gasConfig.poseidon_hash_cost
      );
      this.env.processGasInfo(gasInfo);
    }

    return new Region(this.exports.memory, 0);
  }

  do_groth16_verify(
    input: Region,
    proof: Region,
    vk: Region,
    curve: number
  ): number {
    const isValidProof = this.backend.backend_api.groth16_verify(
      input.data,
      proof.data,
      vk.data,
      curve
    );

    if (this.env) {
      const gasInfo = GasInfo.with_cost(
        Environment.gasConfig.groth16_verify_cost
      );
      this.env.processGasInfo(gasInfo);
    }

    if (isValidProof) {
      return 0;
    } else {
      return 1;
    }
  }

  do_debug(message: Region) {
    this.debugMsgs.push(message.read_str());
  }

  do_query_chain(request: Region): Region {
    const resultPtr = this.backend.querier.query_raw(
      request.data,
      this.remainingGas
    );
    // auto update gas on this vm if use contract sharing
    const region = this.allocate(resultPtr.length);
    region.write(resultPtr);
    return region;
  }

  do_abort(message: Region) {
    throw new Error(`abort: ${message.read_str()}`);
  }

  // entrypoints
  public instantiate(env: Env, info: MessageInfo, msg: object): object {
    const instantiate =
      this.exports[this.version === 4 ? 'init' : 'instantiate'];
    const args = [env, info, msg].map((x) => this.allocate_json(x).ptr);
    this.storageReadonly = false;
    const result = instantiate(...args);
    return this.json(result);
  }

  public execute(env: Env, info: MessageInfo, msg: object): object {
    const execute = this.exports[this.version === 4 ? 'handle' : 'execute'];
    const args = [env, info, msg].map((x) => this.allocate_json(x).ptr);
    this.storageReadonly = false;
    const result = execute(...args);
    return this.json(result);
  }

  public query(env: Env, msg: object): object {
    const { query } = this.exports;
    const args = [env, msg].map((x) => this.allocate_json(x).ptr);
    this.storageReadonly = true;
    const result = query(...args);
    return this.json(result);
  }

  public migrate(env: Env, msg: object): object {
    const { migrate } = this.exports;
    const args = [env, msg].map((x) => this.allocate_json(x).ptr);
    this.storageReadonly = false;
    const result = migrate(...args);
    return this.json(result);
  }

  public sudo(env: Env, msg: object): object {
    const { sudo } = this.exports;
    const args = [env, msg].map((x) => this.allocate_json(x).ptr);
    this.storageReadonly = false;
    const result = sudo(...args);
    return this.json(result);
  }

  public reply(env: Env, msg: object): object {
    const { reply } = this.exports;
    const args = [env, msg].map((x) => this.allocate_json(x).ptr);
    this.storageReadonly = false;
    const result = reply(...args);
    return this.json(result);
  }

  // IBC implementation
  public ibc_channel_open(env: Env, msg: object): object {
    const { ibc_channel_open } = this.exports;
    const args = [env, msg].map((x) => this.allocate_json(x).ptr);
    this.storageReadonly = false;
    const result = ibc_channel_open(...args);
    return this.json(result);
  }

  public ibc_channel_connect(env: Env, msg: object): object {
    const { ibc_channel_connect } = this.exports;
    const args = [env, msg].map((x) => this.allocate_json(x).ptr);
    this.storageReadonly = false;
    const result = ibc_channel_connect(...args);
    return this.json(result);
  }

  public ibc_channel_close(env: Env, msg: object): object {
    const { ibc_channel_close } = this.exports;
    const args = [env, msg].map((x) => this.allocate_json(x).ptr);
    this.storageReadonly = false;
    const result = ibc_channel_close(...args);
    return this.json(result);
  }

  public ibc_packet_receive(env: Env, msg: object): object {
    const { ibc_packet_receive } = this.exports;
    const args = [env, msg].map((x) => this.allocate_json(x).ptr);
    this.storageReadonly = false;
    const result = ibc_packet_receive(...args);
    return this.json(result);
  }

  public ibc_packet_ack(env: Env, msg: object): object {
    const { ibc_packet_ack } = this.exports;
    const args = [env, msg].map((x) => this.allocate_json(x).ptr);
    this.storageReadonly = false;
    const result = ibc_packet_ack(...args);
    return this.json(result);
  }

  public ibc_packet_timeout(env: Env, msg: object): object {
    const { ibc_packet_timeout } = this.exports;
    const args = [env, msg].map((x) => this.allocate_json(x).ptr);
    this.storageReadonly = false;
    const result = ibc_packet_timeout(...args);
    return this.json(result);
  }
}

function decodeSections(data: Uint8Array): Uint8Array[] {
  const result = [];
  let remainingLen = data.length;
  while (remainingLen >= 4) {
    const tailLen = toNumber(data.subarray(remainingLen - 4, remainingLen));
    remainingLen -= 4;
    const section = data.subarray(remainingLen - tailLen, remainingLen);
    result.push(section);
    remainingLen -= tailLen;
  }

  result.reverse();
  return result;
}
