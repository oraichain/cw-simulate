"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionalLens = exports.Transactional = exports.NEVER_IMMUTIFY = void 0;
exports.toImmutable = toImmutable;
exports.fromImmutable = fromImmutable;
const immutable_1 = require("@oraichain/immutable");
const ts_results_1 = require("ts-results");
const util_1 = require("../util");
exports.NEVER_IMMUTIFY = '__NEVER_IMMUTIFY__';
/** Transactional database underlying multi-module chain storage. */
class Transactional {
    _data;
    constructor(_data = (0, immutable_1.Map)()) {
        this._data = _data;
    }
    lens(...path) {
        return new TransactionalLens(this, path.map(stringify));
    }
    tx(cb) {
        let valid = true;
        const snapshot = this._data;
        const updater = setter => {
            if (!valid)
                throw new Error('Attempted to set data outside tx');
            this._data = setter(this._data);
        };
        try {
            const result = cb(updater);
            if ('then' in result) {
                return result
                    .then(r => {
                    if (r.err) {
                        this._data = snapshot;
                    }
                    return r;
                })
                    .catch(reason => {
                    this._data = snapshot;
                    throw reason;
                });
            }
            else {
                if (result.err) {
                    this._data = snapshot;
                }
                return result;
            }
        }
        catch (ex) {
            this._data = snapshot;
            throw ex;
        }
        finally {
            valid = false;
        }
    }
    get data() {
        return this._data;
    }
}
exports.Transactional = Transactional;
class TransactionalLens {
    db;
    prefix;
    constructor(db, prefix) {
        this.db = db;
        this.prefix = prefix;
    }
    initialize(data) {
        this.db
            .tx(update => {
            const coll = toImmutable(data);
            if (!(0, immutable_1.isCollection)(coll))
                throw new Error('Not an Immutable.Map');
            update(curr => curr.setIn([...this.prefix], coll));
            return (0, ts_results_1.Ok)(undefined);
        })
            .unwrap();
        return this;
    }
    get(...path) {
        return this.db.data.getIn([...this.prefix, ...path.map(stringify)]);
    }
    getObject(...path) {
        return fromImmutable(this.get(...path));
    }
    tx(cb) {
        //@ts-ignore
        return this.db.tx(update => {
            const setter = (...path) => (value) => {
                update(curr => curr.setIn([...this.prefix, ...path.map(stringify)], toImmutable(value)));
            };
            const deleter = (...path) => {
                update(curr => curr.deleteIn([...this.prefix, ...path.map(stringify)]));
            };
            return cb(setter, deleter);
        });
    }
    lens(...path) {
        return new TransactionalLens(this.db, [...this.prefix, ...path.map(stringify)]);
    }
    get data() {
        return this.db.data.getIn([...this.prefix]);
    }
}
exports.TransactionalLens = TransactionalLens;
function toImmutable(value) {
    // passthru Immutable collections
    if ((0, immutable_1.isCollection)(value))
        return value;
    // don't touch ArrayBuffers & ArrayBufferViews - freeze them
    if (ArrayBuffer.isView(value)) {
        Object.freeze(value.buffer);
        return value;
    }
    if (value instanceof ArrayBuffer) {
        Object.freeze(value);
        return value;
    }
    // recurse into arrays & objects, converting them to lists & maps
    // skip primitives & objects that don't want to be touched
    if (value && typeof value === 'object' && !(exports.NEVER_IMMUTIFY in value)) {
        if ((0, util_1.isArrayLike)(value)) {
            return (0, immutable_1.List)(value.map(item => toImmutable(item)));
        }
        else {
            return (0, immutable_1.Map)(Object.entries(value).map(([key, value]) => [key, toImmutable(value)]));
        }
    }
    return value;
}
function fromImmutable(value) {
    // reverse Immutable maps & lists
    if ((0, immutable_1.isMap)(value)) {
        return fromImmutable(value.toObject());
    }
    if ((0, immutable_1.isList)(value)) {
        return fromImmutable(value.toArray());
    }
    // passthru ArrayBuffers & ArrayBufferViews
    if (value instanceof ArrayBuffer || ArrayBuffer.isView(value))
        return value;
    // revert objects & arrays
    // but: passthru objects w/ NEVER_IMMUTIFY
    if (value && typeof value === 'object' && !(exports.NEVER_IMMUTIFY in value)) {
        if (typeof value.length === 'number' && 0 in value && value.length - 1 in value) {
            for (let i = 0; i < value.length; ++i) {
                value[i] = fromImmutable(value[i]);
            }
        }
        else {
            for (const prop in value) {
                value[prop] = fromImmutable(value[prop]);
            }
        }
        return value;
    }
    return value;
}
const stringify = (v) => v + '';
//# sourceMappingURL=transactional.js.map