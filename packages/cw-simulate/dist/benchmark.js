"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadState = downloadState;
exports.downloadStateOld = downloadStateOld;
const fork_1 = require("./fork");
const fork_old_1 = require("./fork-old");
const path_1 = __importDefault(require("path"));
const benny_1 = __importDefault(require("benny"));
async function downloadState(contract, downloadPath) {
    const downloadState = new fork_1.DownloadState('https://rpc.orai.io', downloadPath);
    await downloadState.saveState(contract);
}
async function downloadStateOld(contract, downloadPath) {
    const downloadState = new fork_old_1.DownloadState('https://lcd.orai.io', downloadPath);
    await downloadState.saveState(contract);
}
const firstSuite = benny_1.default.suite('benchmark downloading states via RPC versus LCD', benny_1.default.add('download state RPC', async () => {
    await downloadState('orai1hur7m6wu7v79t6m3qal6qe0ufklw8uckrxk5lt', path_1.default.join(__dirname, './benchmark/new-data'));
}, { maxTime: 1 }), benny_1.default.add('download state LCD', async () => {
    await downloadStateOld('orai1hur7m6wu7v79t6m3qal6qe0ufklw8uckrxk5lt', path_1.default.join(__dirname, './benchmark/old-data'));
}, { maxTime: 1 }), benny_1.default.cycle(), benny_1.default.complete(), benny_1.default.save({ file: 'reduce', version: '1.0.0' }), benny_1.default.save({ file: 'reduce', format: 'chart.html' }));
(async () => {
    await firstSuite;
})();
//# sourceMappingURL=benchmark.js.map