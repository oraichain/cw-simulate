import { VMInstance, Region, IBackend, Environment } from '@oraichain/cosmwasm-vm-js';
import { DebugLog } from '../types';

export type DebugFunction = (log: DebugLog) => void;

export class CWSimulateVMInstance extends VMInstance {
  constructor(
    public logs: Array<DebugLog>,
    private readonly debugFn: DebugFunction,
    backend: IBackend,
    env?: Environment
  ) {
    super(backend, env);
  }

  private processLog(log: DebugLog) {
    this.logs.push(log);
    this.debugFn(log);
  }

  do_db_read(key: Region): Region {
    const result = super.do_db_read(key);
    this.processLog({
      type: 'call',
      fn: 'db_read',
      args: {
        key: key.str,
      },
      result: result.str,
    });

    return result;
  }

  do_db_write(key: Region, value: Region) {
    super.do_db_write(key, value);
    this.processLog({ type: 'call', fn: 'db_write', args: { key: key.str, value: value.str } });
  }

  do_db_remove(key: Region) {
    super.do_db_remove(key);
    this.processLog({
      type: 'call',
      fn: 'db_remove',
      args: { key: key.str },
    });
  }

  do_db_scan(start: Region, end: Region, order: number): Region {
    let result = super.do_db_scan(start, end, order);
    this.processLog({
      type: 'call',
      fn: 'db_scan',
      args: { start: start.str, end: end.str, order },
      result: result.str,
    });

    return result;
  }

  do_db_next(iterator_id: Region): Region {
    let result = super.do_db_next(iterator_id);
    this.processLog({
      type: 'call',
      fn: 'db_next',
      args: { iterator_id: iterator_id.str },
      result: result.str,
    });

    return result;
  }

  do_addr_humanize(source: Region, destination: Region): Region {
    let result = super.do_addr_humanize(source, destination);
    this.processLog({
      type: 'call',
      fn: 'addr_humanize',
      args: { source: source.str },
      result: result.str,
    });

    return result;
  }

  do_addr_canonicalize(source: Region, destination: Region): Region {
    let result = super.do_addr_canonicalize(source, destination);
    this.processLog({
      type: 'call',
      fn: 'addr_canonicalize',
      args: { source: source.str, destination: destination.str },
      result: result.str,
    });

    return result;
  }

  do_addr_validate(source: Region): Region {
    let result = super.do_addr_validate(source);
    this.processLog({
      type: 'call',
      fn: 'addr_validate',
      args: { source: source.str },
      result: result.str,
    });

    return result;
  }

  do_secp256k1_verify(hash: Region, signature: Region, pubkey: Region): number {
    let result = super.do_secp256k1_verify(hash, signature, pubkey);
    this.processLog({
      type: 'call',
      fn: 'secp256k1_verify',
      args: {
        hash: hash.str,
        signature: signature.str,
        pubkey: pubkey.str,
      },
      result,
    });

    return result;
  }

  do_secp256k1_recover_pubkey(msgHash: Region, signature: Region, recover_param: number): Region {
    let result = super.do_secp256k1_recover_pubkey(msgHash, signature, recover_param);
    this.processLog({
      type: 'call',
      fn: 'secp256k1_recover_pubkey',
      args: {
        msgHash: msgHash.str,
        signature: signature.str,
        recover_param,
      },
      result: result.str,
    });

    return result;
  }

  do_abort(message: Region) {
    super.do_abort(message);
    this.processLog({
      type: 'call',
      fn: 'abort',
      args: { message: message.read_str() },
    });
  }

  do_debug(message: Region) {
    const messageStr = message.read_str();
    this.processLog({
      type: 'call',
      fn: 'debug',
      args: { message: messageStr },
    });
    super.do_debug(message);
    // this help for implementing contract debug
    this.processLog({
      type: 'print',
      message: messageStr,
    });
  }

  do_ed25519_batch_verify(messages_ptr: Region, signatures_ptr: Region, public_keys_ptr: Region): number {
    let result = super.do_ed25519_batch_verify(messages_ptr, signatures_ptr, public_keys_ptr);
    this.processLog({
      type: 'call',
      fn: 'ed25519_batch_verify',
      args: {
        messages_ptr: messages_ptr.str,
        signatures_ptr: signatures_ptr.str,
        pubkeys_ptr: public_keys_ptr.str,
      },
      result,
    });

    return result;
  }

  do_ed25519_verify(message: Region, signature: Region, pubkey: Region): number {
    let result = super.do_ed25519_verify(message, signature, pubkey);
    this.processLog({
      type: 'call',
      fn: 'ed25519_verify',
      args: {
        message: message.str,
        signature: signature.str,
        pubkey: pubkey.str,
      },
      result,
    });

    return result;
  }

  do_query_chain(request: Region): Region {
    let result = super.do_query_chain(request);
    this.processLog({
      type: 'call',
      fn: 'query_chain',
      args: { request: request.str },
      result: result.str,
    });
    return result;
  }

  /** Reset debug information such as debug messages & call history.
   *
   * These should be valid only for individual contract executions.
   */
  resetDebugInfo() {
    this.debugMsgs = [];
    this.logs = [];
    return this;
  }
}
