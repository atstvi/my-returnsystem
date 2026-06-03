'use strict';
/* Storage report diagnostic — loads the real returnStorageReport +
   _storageClassifyKey from index.html and verifies categorization and the
   root-cause flags (inline-base64, duplicate-media, oversized-bookkeeping)
   against a synthetic localStorage. The report is read-only — it must never
   mutate storage — so we also assert the store is untouched. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'function _storageClassifyKey(', '\nwindow.returnStoragePrune=returnStoragePrune;');

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
  _bk_1778502000719_inbox_v1: 'y'.repeat(40000),         // orphaned backup → prunable
  _bk_1778504826377_task_items_v1: 'z'.repeat(20000),    // orphaned backup → prunable
  undefined: 'data:image/png;base64,' + 'Q'.repeat(60000), // junk key from invalid-key write → prunable
});
const before = JSON.stringify(store);

const sandbox = { window: {}, console: { warn() {}, error() {}, log() {}, group() {}, groupEnd() {} } };
sandbox.localStorage = ls;
sandbox._idbCache = { someOverflowKey: 'z'.repeat(1000) };
vm.createContext(sandbox);
vm.runInContext(block, sandbox);
const { returnStorageReport, _storageClassifyKey, returnStoragePrune, _storageIsOrphanBackup } = sandbox;

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

// ── orphaned-backup prune ──
t.ok('orphan matcher: _bk_ts_ matches', _storageIsOrphanBackup('_bk_1778502000719_inbox_v1') === true);
t.ok('orphan matcher: junk "undefined"/"null" keys match', _storageIsOrphanBackup('undefined') === true && _storageIsOrphanBackup('null') === true);
t.ok('orphan matcher: live key never matches', !_storageIsOrphanBackup('inbox_v1') && !_storageIsOrphanBackup('task_items_v1') && !_storageIsOrphanBackup('_bk_partial') && !_storageIsOrphanBackup('undefined_x'), 'guard');

const beforePrune = JSON.stringify(store);
const dry = returnStoragePrune(); // dry run
t.ok('dry-run matches both backups + junk key', dry.matched === 3 && dry.applied === false, dry);
t.ok('dry-run is read-only', JSON.stringify(store) === beforePrune);
t.ok('dry-run reclaim > 0', dry.reclaimKB > 0, dry.reclaimKB);

const applied = returnStoragePrune({ apply: true, archive: false }); // archive=false: no DOM in node
t.ok('apply deletes backups + junk key', applied.applied === true && applied.removed === 3);
t.ok('backups + junk gone from store', !('_bk_1778502000719_inbox_v1' in store) && !('_bk_1778504826377_task_items_v1' in store) && !('undefined' in store));
t.ok('live keys untouched by prune', !!store.task_items_v1 && !!store.home_banner_v1 && !!store.return_media_sync_v1 && !!store.gcal_cfg_v1);
t.ok('re-run prune is no-op', returnStoragePrune({ apply: true, archive: false }).matched === 0);

t.done();
