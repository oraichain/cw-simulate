import { resolve } from 'path';
import { SyncState } from './sync';
import dotenv from 'dotenv';
dotenv.config();

const SENDER = 'orai1hvr9d72r5um9lvt0rpkd4r75vrsqtw6yujhqs2';

(async () => {
  const startHeight = 36975366;
  const endHeight = 36975369;
  const syncState = new SyncState(
    SENDER,
    process.env.RPC ?? 'https://rpc.orai.io',
    resolve(__dirname, '../', 'data', startHeight.toString())
  );
  const relatedContracts = [
    'orai12sxqkgsystjgd9faa48ghv3zmkfqc6qu05uy20mvv730vlzkpvls5zqxuz',
    'orai1wuvhex9xqs3r539mvc6mtm7n20fcj3qr2m0y9khx6n5vtlngfzes3k0rq9',
    'orai1rdykz2uuepxhkarar8ql5ajj5j37pq8h8d4zarvgx2s8pg0af37qucldna',
    'orai1yglsm0u2x3xmct9kq3lxa654cshaxj9j5d9rw5enemkkkdjgzj7sr3gwt0',
  ];
  const { results, simulateClient } = await syncState.sync(startHeight, endHeight, relatedContracts, {
    orai12sxqkgsystjgd9faa48ghv3zmkfqc6qu05uy20mvv730vlzkpvls5zqxuz: resolve(
      __dirname,
      '../',
      'data',
      startHeight.toString(),
      'cw-app-bitcoin.wasm'
    ),
  });
  console.dir(results, { depth: null });
})();
