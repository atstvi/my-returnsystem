'use strict';
/* _afterWriteSideEffects in setReturnStorageItem (added to fix Firebase/GCal/Notion
   sync triggers being bypassed — setReturnStorageItem uses _rawSetItem internally,
   skipping the patched localStorage.setItem that held the triggers).

   Tests:
   1. sync key (task_items_v1) → fbSaveAll fires
   2. task key → gcalQueueAutoSync fires
   3. diary key → queueDiaryNotionSave fires
   4. _applyingFbData guard → no side-effects
   5. _notionSyncActive guard → queueDiaryNotionSave suppressed
   6. return_sync_model → fbSaveAll does NOT fire (device-local, PR #48)
   7. non-sync key (__local_key) → no side-effects */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();

// Load the real shouldFbSyncKey so we test the actual exclusion list
const syncKeyBlock = sliceBlock(html, 'function shouldFbSyncKey(k){', '\nfunction fbConfig(){');
const storageBlock = sliceBlock(html, 'function setReturnStorageItem(key,value){', '\nvar HOME_BANNER_SYNC_MAX');

function makeSandbox() {
  const store = {};
  const ls = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
  const calls = { fbSaveAll: 0, gcal: 0, notion: [], };
  const win = {};
  const sb = {
    window: win,
    console: { error() {}, warn() {}, log() {} },
    localStorage: ls,
    _rawSetItem: (k, v) => { store[k] = String(v); },
    _idbCache: {},
    _idbDelete: () => {},
    _idbOverflow: false,
    bannerDebugLog: () => {},
    __storageHealthRecord: () => {},
    __clearStaleQuota: () => {},
    // Real shouldFbSyncKey — loaded below
    shouldFbSyncKey: null,
    // Spy functions
    fbSaveAll: () => { calls.fbSaveAll++; },
    gcalQueueAutoSync: () => { calls.gcal++; },
    queueDiaryNotionSave: (d) => { calls.notion.push(d); },
    // shouldFbSyncKey deps
    CLOUD_SETTING_KEYS: [],
    FB_DATA_KEYS: [],
    // currentDate for notion queue
    currentDate: '2026-06-04',
  };
  vm.createContext(sb);
  vm.runInContext(syncKeyBlock, sb);   // defines shouldFbSyncKey in sb
  vm.runInContext(storageBlock, sb);   // defines setReturnStorageItem in sb
  return { sb, store, calls, win };
}

const t = runner('setReturnStorageItem — _afterWriteSideEffects');

// ── 1. sync key fires fbSaveAll ──────────────────────────────────────────────
{
  const { sb, calls } = makeSandbox();
  sb.setReturnStorageItem('task_items_v1', '[]');
  t.ok('task_items_v1 → fbSaveAll fires', calls.fbSaveAll === 1, calls.fbSaveAll);
}

// ── 2. task key fires gcalQueueAutoSync ─────────────────────────────────────
{
  const { sb, calls } = makeSandbox();
  sb.setReturnStorageItem('task_items_v1', '[]');
  t.ok('task_items_v1 → gcalQueueAutoSync fires', calls.gcal === 1, calls.gcal);
}

// ── 3. diary key fires queueDiaryNotionSave ─────────────────────────────────
{
  const { sb, calls } = makeSandbox();
  sb.setReturnStorageItem('diary_entries_v1', '{}');
  t.ok('diary_entries_v1 → fbSaveAll fires', calls.fbSaveAll === 1, calls.fbSaveAll);
  t.ok('diary_entries_v1 → queueDiaryNotionSave fires', calls.notion.length === 1, calls.notion);
}

// ── 4. _applyingFbData guard suppresses all side-effects ────────────────────
{
  const { sb, calls, win } = makeSandbox();
  win._applyingFbData = true;
  sb.setReturnStorageItem('task_items_v1', '[]');
  t.ok('_applyingFbData guard: fbSaveAll suppressed', calls.fbSaveAll === 0, calls.fbSaveAll);
  t.ok('_applyingFbData guard: gcal suppressed', calls.gcal === 0, calls.gcal);
}

// ── 5. _notionSyncActive guard suppresses queueDiaryNotionSave ──────────────
{
  const { sb, calls, win } = makeSandbox();
  win._notionSyncActive = true;
  sb.setReturnStorageItem('diary_entries_v1', '{}');
  t.ok('_notionSyncActive: fbSaveAll still fires', calls.fbSaveAll === 1, calls.fbSaveAll);
  t.ok('_notionSyncActive: queueDiaryNotionSave suppressed', calls.notion.length === 0, calls.notion);
}

// ── 6. return_sync_model must NOT trigger fbSaveAll (PR #48) ─────────────────
{
  const { sb, calls } = makeSandbox();
  sb.setReturnStorageItem('return_sync_model', 'entity');
  t.ok('return_sync_model → fbSaveAll NOT fired (device-local)', calls.fbSaveAll === 0, calls.fbSaveAll);
  t.ok('return_sync_model → gcal NOT fired', calls.gcal === 0, calls.gcal);
}

// ── 7. non-sync key produces no side-effects ────────────────────────────────
{
  const { sb, calls } = makeSandbox();
  sb.setReturnStorageItem('__local_only_key', 'value');
  t.ok('non-sync key → no fbSaveAll', calls.fbSaveAll === 0, calls.fbSaveAll);
  t.ok('non-sync key → no gcal', calls.gcal === 0, calls.gcal);
  t.ok('non-sync key → no notion', calls.notion.length === 0, calls.notion);
}

// ── 8. hobby key also triggers fbSaveAll ────────────────────────────────────
{
  const { sb, calls } = makeSandbox();
  sb.setReturnStorageItem('hobby_cats_v2', '[]');
  t.ok('hobby_cats_v2 → fbSaveAll fires (regex match)', calls.fbSaveAll === 1, calls.fbSaveAll);
}

t.done();
