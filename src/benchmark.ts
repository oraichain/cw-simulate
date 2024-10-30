import { DownloadState } from './fork';
import { DownloadState as DownloadStateOld } from './fork-old';
import path from 'path';
import benchmark from 'benny';

export async function downloadState(contract: string, downloadPath: string) {
  const downloadState = new DownloadState('https://rpc.orai.io', downloadPath);
  await downloadState.saveState(contract);
}

export async function downloadStateOld(contract: string, downloadPath: string) {
  const downloadState = new DownloadStateOld('https://lcd.orai.io', downloadPath);
  await downloadState.saveState(contract);
}

const firstSuite = benchmark.suite(
  'benchmark downloading states via RPC versus LCD',
  benchmark.add(
    'download state RPC',
    async () => {
      await downloadState('orai1hur7m6wu7v79t6m3qal6qe0ufklw8uckrxk5lt', path.join(__dirname, './benchmark/new-data'));
    },
    { maxTime: 1 }
  ),
  benchmark.add(
    'download state LCD',
    async () => {
      await downloadStateOld('orai1hur7m6wu7v79t6m3qal6qe0ufklw8uckrxk5lt', path.join(__dirname, './benchmark/old-data'));
    },
    { maxTime: 1 }
  ),
  benchmark.cycle(),
  benchmark.complete(),
  benchmark.save({ file: 'reduce', version: '1.0.0' }),
  benchmark.save({ file: 'reduce', format: 'chart.html' })
);

(async () => {
  await firstSuite;
})();
