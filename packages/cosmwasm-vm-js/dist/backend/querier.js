"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BasicQuerier = exports.QuerierBase = void 0;
/** Basic implementation of `IQuerier` with standardized `query_raw`
 * which delegates to a new, abstract `handleQuery` method.
 */
class QuerierBase {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    query_raw(request, gas_limit) {
        const queryRequest = parseQuery(request);
        // The Ok(Ok(x)) represents SystemResult<ContractResult<Binary>>
        const result = this.handleQuery(queryRequest);
        const contractResult = result instanceof Error
            ? { err: result.message }
            : // result may already in base64 format that starts with {"
                {
                    ok: 
                    // if result is not primative type (number like) then just return
                    typeof result === 'string' && Number.isNaN(parseFloat(result))
                        ? result
                        : objectToBase64(result),
                };
        return objectToUint8Array({ ok: contractResult });
    }
}
exports.QuerierBase = QuerierBase;
/** Basic implementation which does not actually implement `handleQuery`. Intended for testing. */
class BasicQuerier extends QuerierBase {
    handleQuery(queryRequest) {
        throw new Error(`Unimplemented - subclass BasicQuerier and provide handleQuery() implementation.`);
    }
}
exports.BasicQuerier = BasicQuerier;
function parseQuery(bytes) {
    const query = JSON.parse(new TextDecoder().decode(bytes));
    return query;
}
function objectToBase64(obj) {
    return Buffer.from(JSON.stringify(obj)).toString('base64');
}
function objectToUint8Array(obj) {
    return new TextEncoder().encode(JSON.stringify(obj));
}
//# sourceMappingURL=querier.js.map