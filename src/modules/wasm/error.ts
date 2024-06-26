import { ErrImpl } from 'ts-results';

export class VmError extends ErrImpl<string> {
  constructor(msg: string) {
    super(`VmError: ${msg}`);
  }
}

export class ContractNotFoundError extends VmError {
  constructor(contractAddress: string) {
    super(`contract ${contractAddress} not found`);
  }
}
