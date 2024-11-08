import { ContractResponse, Event } from '@oraichain/cosmwasm-vm-js';
import { AppResponse } from '../../types';
export declare function wrapReplyResponse(res: AppResponse): AppResponse;
export declare function buildContractAddress(codeId: number, instanceId: number): Uint8Array;
export declare function buildAppResponse(contract: string, customEvent: Event, response: ContractResponse): AppResponse;
//# sourceMappingURL=wasm-util.d.ts.map