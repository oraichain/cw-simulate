import { Sha256 } from '@cosmjs/crypto';
import protobuf from 'protobufjs';
import { ContractResponse, Event, writeUInt32BE } from '@oraichain/cosmwasm-vm-js';
import { toBase64 } from '@cosmjs/encoding';
import { AppResponse } from '../../types';

const protobufRoot = protobuf.Root.fromJSON({
  nested: {
    MsgInstantiateContractResponse: {
      fields: {
        address: {
          type: 'string',
          id: 1,
        },
        data: {
          type: 'bytes',
          id: 2,
        },
      },
    },
  },
});

export function wrapReplyResponse(res: AppResponse): AppResponse {
  const MsgInstantiateContractResponse = protobufRoot.lookupType('MsgInstantiateContractResponse');

  const payload = {
    data: res.data,
    address: null,
  };

  for (const event of res.events) {
    const address = event.attributes.find(attr => attr.key === '_contract_address')?.value;
    if (address) {
      payload.address = address;
      break;
    }
  }

  const message = MsgInstantiateContractResponse.create(payload); //;
  return {
    events: res.events,
    data: toBase64(MsgInstantiateContractResponse.encode(message).finish()),
  };
}

export function buildContractAddress(codeId: number, instanceId: number): Uint8Array {
  const payload = Buffer.alloc(21); // wasm0 + contractId = 5 + 16, and initialized to 0 by default
  payload.write('wasm');
  // append code id
  writeUInt32BE(payload, codeId, 9);
  writeUInt32BE(payload, instanceId, 17);

  let hasher = new Sha256();
  hasher.update(Buffer.from('module', 'utf-8'));
  let th = hasher.digest();
  hasher = new Sha256(th);
  hasher.update(payload);
  let hash = hasher.digest();
  return hash.slice(0, 20);
}

export function buildAppResponse(contract: string, customEvent: Event, response: ContractResponse): AppResponse {
  const appEvents: Event[] = [];
  // add custom event
  appEvents.push(customEvent);

  // add contract attributes under `wasm` event type
  if (response.attributes.length > 0) {
    appEvents.push({
      type: 'wasm',
      attributes: [
        {
          key: '_contract_address',
          value: contract,
        },
        ...response.attributes,
      ],
    });
  }

  // add events and prefix with `wasm-`
  for (const event of response.events) {
    appEvents.push({
      type: `wasm-${event.type}`,
      attributes: [{ key: '_contract_address', value: contract }, ...event.attributes],
    });
  }

  return {
    events: appEvents,
    data: response.data,
  };
}
