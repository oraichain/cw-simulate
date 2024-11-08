"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CWSimulateVMInstance = void 0;
const cosmwasm_vm_js_1 = require("@oraichain/cosmwasm-vm-js");
class CWSimulateVMInstance extends cosmwasm_vm_js_1.VMInstance {
    logs;
    debugFn;
    constructor(logs, debugFn, backend, env) {
        super(backend, env);
        this.logs = logs;
        this.debugFn = debugFn;
    }
    processLog(log) {
        this.logs.push(log);
        this.debugFn(log);
    }
    do_db_read(key) {
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
    do_db_write(key, value) {
        super.do_db_write(key, value);
        this.processLog({ type: 'call', fn: 'db_write', args: { key: key.str, value: value.str } });
    }
    do_db_remove(key) {
        super.do_db_remove(key);
        this.processLog({
            type: 'call',
            fn: 'db_remove',
            args: { key: key.str },
        });
    }
    do_db_scan(start, end, order) {
        let result = super.do_db_scan(start, end, order);
        this.processLog({
            type: 'call',
            fn: 'db_scan',
            args: { start: start.str, end: end.str, order },
            result: result.str,
        });
        return result;
    }
    do_db_next(iterator_id) {
        let result = super.do_db_next(iterator_id);
        this.processLog({
            type: 'call',
            fn: 'db_next',
            args: { iterator_id: iterator_id.str },
            result: result.str,
        });
        return result;
    }
    do_addr_humanize(source, destination) {
        let result = super.do_addr_humanize(source, destination);
        this.processLog({
            type: 'call',
            fn: 'addr_humanize',
            args: { source: source.str },
            result: result.str,
        });
        return result;
    }
    do_addr_canonicalize(source, destination) {
        let result = super.do_addr_canonicalize(source, destination);
        this.processLog({
            type: 'call',
            fn: 'addr_canonicalize',
            args: { source: source.str, destination: destination.str },
            result: result.str,
        });
        return result;
    }
    do_addr_validate(source) {
        let result = super.do_addr_validate(source);
        this.processLog({
            type: 'call',
            fn: 'addr_validate',
            args: { source: source.str },
            result: result.str,
        });
        return result;
    }
    do_secp256k1_verify(hash, signature, pubkey) {
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
    do_secp256k1_recover_pubkey(msgHash, signature, recover_param) {
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
    do_abort(message) {
        super.do_abort(message);
        this.processLog({
            type: 'call',
            fn: 'abort',
            args: { message: message.read_str() },
        });
    }
    do_debug(message) {
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
    do_ed25519_batch_verify(messages_ptr, signatures_ptr, public_keys_ptr) {
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
    do_ed25519_verify(message, signature, pubkey) {
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
    do_query_chain(request) {
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
exports.CWSimulateVMInstance = CWSimulateVMInstance;
//# sourceMappingURL=CWSimulateVMInstance.js.map