'use strict';
/* Storage report diagnostic — loads the real returnStorageReport +
   _storageClassifyKey from index.html and verifies categorization and the
   root-cause flags (inline-base64, duplicate-media, oversized-bookkeeping)
   against a synthetic localStorage. The report is read-only — it must never
   mutate storage — so we also assert the store is untouched. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'function _storageClassifyKey(', '\nwindow.returnStorageReport=returnStorageReport;');

/* localStorage shim with length/key(i), which the report iterates over. */
function makeLS(seed) {
  const store = Object.assign({}, seed);
  return {
    store,
    ls: {
      get length() { return Object.keys(store).length; },
      key(i) { return Object.keys(store)[i]; },
      getItem(k) { return (k in store) ? store[k] : null; },
      setItem(k, v) { store[k] = String(v); },
      removeItem(k) { delete store[k]; },
    },
  };
}

const bigB64 = 'data:image/png;base64,' + 'A'.repeat(60000); // ~120KB UTF-16
const dupB64 = 'data:image/png;base64,' + 'B'.repeat(40000);

const { store, ls } = makeLS({
  task_items_v1: JSON.stringify(Array(50).fill({ t: 'task' })),
  home_banner_v1: JSON.stringify({ url: bigB64 }),     // inline base64 → flag
  hobby_banner_v1: dupB64,                               // identical bytes to below
  hobby_banner_sync_v1: dupB64,                          // duplicate of above
  return_media_sync_v1: bigB64,                          // media-sync: must NOT flag as inline
  __sync_conflicts_v1: 'x'.repeat(60000),                // oversized bookkeeping → flag
  gcal_cfg_v1: JSON.stringify({ clientId: 'c' }),
  return_theme_color: '#fff',
});
const before = JSON.stringify(store);

const sandbox = { window: {}, console: { warn() {}, error() {}, log() {}, group() {}, groupEnd() {} } };
sandbox.localStorage = ls;
sandbox._idbCache = { someOverflowKey: 'z'.repeat(1000) };
vm.createContext(sandbox);
vm.runInContext(block, sandbox);
const { returnStorageReport, _storageClassifyKey } = sandbox;

const t = runner('Storage report diagnostic');

// classification
t.ok('synced-data classified', _storageClassifyKey('task_items_v1') === 'synced-data');
t.ok('banner → media-inline', _storageClassifyKey('home_banner_v1') === 'media-inline');
t.ok('media-sync classified', _storageClassifyKey('return_media_sync_v1') === 'media-sync');
t.ok('conflict log → sync-meta', _storageClassifyKey('__sync_conflicts_v1') === 'sync-meta');
t.ok('wshadow → sync-shadow', _storageClassifyKey('__entity_wshadow_tasks') === 'sync-shadow');
t.ok('gcal → config', _storageClassifyKey('gcal_cfg_v1') === 'config');
t.ok('theme classified', _storageClassifyKey('return_theme_color') === 'theme');

const r = returnStorageReport(false);

// shape + read-only guarantee
t.ok('report shape', r && typeof r.totalKB === 'number' && Array.isArray(r.topKeys) && Array.isArray(r.categories) && Array.isArray(r.flags));
t.ok('read-only (store untouched)', JSON.stringify(store) === before);
t.ok('idb overflow summarized', r.idb && r.idb.keyCount === 1 && r.idb.kb > 0, r.idb);

// flags
const issues = r.flags.map((f) => f.issue);
t.ok('inline-base64 flagged for banner', r.flags.some((f) => f.key === 'home_banner_v1' && f.issue === 'inline-base64'), issues);
t.ok('media-sync NOT flagged as inline', !r.flags.some((f) => f.key === 'return_media_sync_v1' && f.issue === 'inline-base64'), issues);
t.ok('duplicate-media flagged once', r.flags.filter((f) => f.issue === 'duplicate-media').length === 1, issues);
t.ok('oversized-bookkeeping flagged', r.flags.some((f) => f.key === '__sync_conflicts_v1' && f.issue === 'oversized-bookkeeping'), issues);

// categories rolled up and sorted desc
t.ok('categories sorted desc', r.categories.length >= 4 && r.categories.every((c, i) => i === 0 || r.categories[i - 1].kb >= c.kb), r.categories);

t.done();
