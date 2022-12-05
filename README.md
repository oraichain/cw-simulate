# `cw-simulate`

This package combines `cosmwasm-vm-js` with additional abstractions and state management to
more accurately simulate the effects of CosmWasm contracts on the blockchain environments on which
they are hosted.

To build cosmwasm-vm-js, you need to go to `node_modules/@terran-one/cosmwasm-vm-js` then manually build it

```bash
yarn && yarn build
```

## Features

- configure multiple host chain environments with chain-specific settings / state
- multiple simultaneous contract instances can exist per chain
- chain modules can be simulated through custom user code
- extensible for further instrumentation via custom middlewares

## Getting Started

Import the `cw-simulate` library from NPM in your `package.json`.

```bash
$ npm install -S @terran-one/cw-simulate
```

If you're using Yarn:

```bash
$ yarn add @terran-one/cw-simulate
```

## Usage

1. Create a `CWSimulateApp` object - this is a simulation environment describing a single chain.
2. As needed, per chain:
   - Upload the WASM bytecode using `App.wasm.create`. This will register a new `codeId` to reference the uploaded contract code.
   - Create a new contract instance using `App.wasm.instantiateContract`, passing in the `codeId` generated in the previous step.
   - From the response, retrieve the `contractAddress` to refer to the contract instance.

- You can now run `execute` and `query` messages against the instance, and they should work as expected.

### Example

The following example creates a chain, instantiates a contract on it, and performs an `execute` and `query`.

```javascript
import { CWSimulateApp } from '@terran-one/cw-simulate';
import { readFileSync } from 'fs';

const sender = 'terra1hgm0p7khfk85zpz5v0j8wnej3a90w709vhkdfu';
const funds = [];
const wasmBytecode = readFileSync('cw-template.wasm');

const app = new CWSimulateApp({
  chainId: 'phoenix-1',
  bech32Prefix: 'terra',
});

// import the wasm bytecode
const codeId = app.wasm.create(sender, wasmBytecode);

// instantiate the contract
let result = await app.wasm.instantiateContract(sender, funds, codeId, {
  count: 0,
});
console.log(
  'instantiateContract:',
  result.constructor.name,
  JSON.stringify(result, null, 2)
);

// pull out the contract address
const contractAddress = result.val.events[0].attributes[0].value;

// execute the contract
result = await app.wasm.executeContract(sender, funds, contractAddress, {
  increment: {},
});
console.log(
  'executeContract:',
  result.constructor.name,
  JSON.stringify(result, null, 2)
);

// query the contract
result = await app.wasm.query(contractAddress, { get_count: {} });
console.log('query:', result.constructor.name, JSON.stringify(result, null, 2));
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
