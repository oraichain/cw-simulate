import Serde, { StandardProtocolMap } from '@kiruse/serde';
import { List, Map } from '@oraichain/immutable';
import { CWSimulateApp } from './CWSimulateApp';
type Protocols = StandardProtocolMap & {
    'immutable-list': List<any>;
    'immutable-map': Map<any, any>;
    'cw-simulate-app': CWSimulateApp;
};
export declare const serde: Serde<Protocols, {}>;
export declare const save: (app: CWSimulateApp) => Uint8Array;
export declare const load: (bytes: Uint8Array) => Promise<CWSimulateApp>;
export {};
//# sourceMappingURL=persist.d.ts.map