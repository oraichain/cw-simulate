# `cw-simulate`

This package combines `cosmwasm-vm-js` with additional abstractions and state management to
more accurately simulate the effects of CosmWasm contracts on the blockchain environments on which
they are hosted.

## Features

- configure multiple host chain environments with chain-specific settings / state
- multiple simultaneous contract instances can exist per chain
- chain modules can be simulated through custom user code
- extensible for further instrumentation via custom middlewares

## Getting Started

Import the `cw-simulate` library from NPM in your `package.json`.

```bash
$ npm install -S "https://github.com/oraichain/cosmwasm-vm-js.git"
```

If you're using Yarn:

```bash
$ yarn add "https://github.com/oraichain/cosmwasm-vm-js.git"
```

## Usage

1. Create a `SimulateCosmWasmClient` object - this is a simulation environment describing a single chain that extends SigningCosmWasmClient.
2. As needed, per chain:
   - Upload the WASM bytecode using `client.update`. This will register a new `codeId` to reference the uploaded contract code.
   - Create a new contract instance using `client.instantiate`, passing in the `codeId` generated in the previous step.
   - From the response, retrieve the `contractAddress` to refer to the contract instance.

- You can now run `execute` and `query` messages against the instance, and they should work as expected.

### Example

The following example creates a chain, instantiates a contract on it, and performs an `execute` and `query`.

```javascript
import { SimulateCosmWasmClient } from '@oraichain/cw-simulate';
import { readFileSync } from 'fs';

const sender = 'orai12zyu8w93h0q2lcnt50g3fn0w3yqnhy4fvawaqz';
const funds = [];

const client = new SimulateCosmWasmClient({
  chainId: 'Oraichain',
  bech32Prefix: 'orai',
});

// import the wasm bytecode
const { codeId, contractAddress } = client.deploy(sender, 'cw-template.wasm', {
  count: 0,
});

// execute the contract
result = await client.app.wasm.executeContract(sender, funds, contractAddress, {
  increment: {},
});
console.log('executeContract:', result.constructor.name, JSON.stringify(result, null, 2));

// query the contract
result = await client.app.wasm.query(contractAddress, { get_count: {} });
console.log('query:', result.constructor.name, JSON.stringify(result, null, 2));

// use with codegen
const contractClient = new ContractClient(client, sender, contractAddress);
const res = await contractClient.executeMethod({});
```

## Using with Vue.js and vite

Vite doesn't include shims for Node variables like Webpack 4 does, and cw-simulate currently relies on these. The following workaround exists:

1. Add the `buffer` package (`npm add buffer`)
2. Add the following to your `index.html` (inside the `body` tag, before your other js imports):

```html
<script>
  window.global = window;
</script>
<script type="module">
  import { Buffer } from 'buffer';
  window.Buffer = Buffer;
</script>
```

See [this github issue](https://github.com/vitejs/vite/issues/2618) for more details.
