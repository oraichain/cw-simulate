export interface IQuerier {
    query_raw(request: Uint8Array, gas_limit: number): Uint8Array;
}
/** Basic implementation of `IQuerier` with standardized `query_raw`
 * which delegates to a new, abstract `handleQuery` method.
 */
export declare abstract class QuerierBase implements IQuerier {
    query_raw(request: Uint8Array, gas_limit: number): Uint8Array;
    /** Handle a specific JSON query message. */
    abstract handleQuery(queryRequest: any): any;
}
/** Basic implementation which does not actually implement `handleQuery`. Intended for testing. */
export declare class BasicQuerier extends QuerierBase {
    handleQuery(queryRequest: any): any;
}
//# sourceMappingURL=querier.d.ts.map