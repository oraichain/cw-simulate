import { VMInstance, Region, IBackend, Environment } from '@oraichain/cosmwasm-vm-js';
import { DebugLog } from '../types';
export type DebugFunction = (log: DebugLog) => void;
export declare class CWSimulateVMInstance extends VMInstance {
    logs: Array<DebugLog>;
    private readonly debugFn;
    constructor(logs: Array<DebugLog>, debugFn: DebugFunction, backend: IBackend, env?: Environment);
    private processLog;
    do_db_read(key: Region): Region;
    do_db_write(key: Region, value: Region): void;
    do_db_remove(key: Region): void;
    do_db_scan(start: Region, end: Region, order: number): Region;
    do_db_next(iterator_id: Region): Region;
    do_addr_humanize(source: Region, destination: Region): Region;
    do_addr_canonicalize(source: Region, destination: Region): Region;
    do_addr_validate(source: Region): Region;
    do_secp256k1_verify(hash: Region, signature: Region, pubkey: Region): number;
    do_secp256k1_recover_pubkey(msgHash: Region, signature: Region, recover_param: number): Region;
    do_abort(message: Region): void;
    do_debug(message: Region): void;
    do_ed25519_batch_verify(messages_ptr: Region, signatures_ptr: Region, public_keys_ptr: Region): number;
    do_ed25519_verify(message: Region, signature: Region, pubkey: Region): number;
    do_query_chain(request: Region): Region;
    /** Reset debug information such as debug messages & call history.
     *
     * These should be valid only for individual contract executions.
     */
    resetDebugInfo(): this;
}
//# sourceMappingURL=CWSimulateVMInstance.d.ts.map