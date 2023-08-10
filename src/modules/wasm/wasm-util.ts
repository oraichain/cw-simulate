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
  const contractId = new Uint8Array(16);
  writeUInt32BE(contractId, codeId, 4);
  writeUInt32BE(contractId, instanceId, 12);

  // append module name
  let mKey = new Uint8Array([...Uint8Array.from(Buffer.from('wasm', 'utf-8')), 0]);
  let payload = new Uint8Array([...mKey, ...contractId]);

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
