'use strict';
/* fbApplyData._fbApplySkip guard (PR #48).
   When a cloud blob contains device-local keys (e.g. return_sync_model),
   fbApplyData must NOT write them to localStorage. Without this guard a stale
   cloud blob with return_sync_model='entity' would re-enable entity mode on
   every reload — which was the root cause of the 10k-memo inflation incident.

   Tests:
   1. return_sync_model in cloud blob → NOT written to localStorage
   2. normal sync keys in cloud blob → ARE written
   3. _applyingFbData lock is set during apply, released on exit
   4. null/empty data → returns early without throw
   5. __noop flag → returns early, no writes */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'function fbApplyData(data){', '\nfunction fbStatusTime(');

function makeSandbox() {
  const written = {};
  const win = {};
  const sb = {
    window: win,
    console: { error() {}, warn() {}, log() {} },
    // Track what _rawSetItem actually writes
    _rawSetItem: (k, v) => { written[k] = v; },
    localStorage: {
      getItem: (k) => (k in written ? written[k] : null),
      setItem: (k, v) => { written[k] = String(v); },
      removeItem: (k) => { delete written[k]; },
    },
    // Module-level vars fbApplyData reads/writes
    _applyingFbData: false,
    _lastRemoteApplyMs: 0,
    _lastRepairSaveMs: 0,
    // Union-merge constant referenced for EVERY key (if(k===MEDIA_SYNC_KEY)).
    // Without it the per-key body throws ReferenceError on the first compare,
    // the catch swallows it, and NO key is ever written — making every
    // "key written" assertion fail. Mirror the app's value.
    MEDIA_SYNC_KEY: 'return_media_sync_v1',
    _mediaSyncManifest: null,
    // Runtime stubs needed outside try/catch blocks
    setTimeout: () => {},
    clearTimeout: () => {},
    Date,
    // Stubs — everything inside try/catch so undefined is fine
    fbSaveAll: () => {},
  };
  vm.createContext(sb);
  vm.runInContext(block, sb);
  return { sb, written, win };
}

const t = runner('fbApplyData — _fbApplySkip guard (PR #48)');

// ── 1. return_sync_model must NOT be written ─────────────────────────────────
{
  const { sb, written } = makeSandbox();
  sb.fbApplyData({
    keys: { 'return_sync_model': 'entity', 'task_items_v1': '[]' },
    updatedAtMs: Date.now(),
  });
  t.ok('return_sync_model not written (skipped)', !('return_sync_model' in written), written);
}

// ── 2. normal keys ARE written ───────────────────────────────────────────────
{
  const { sb, written } = makeSandbox();
  sb.fbApplyData({
    keys: { 'return_sync_model': 'entity', 'task_items_v1': '[{"id":1}]', 'memos_v5': '[]' },
    updatedAtMs: Date.now(),
  });
  t.ok('task_items_v1 written', written['task_items_v1'] === '[{"id":1}]', written);
  t.ok('memos_v5 written', written['memos_v5'] === '[]', written);
}

// ── 3. _applyingFbData lock released after apply ─────────────────────────────
{
  const { sb } = makeSandbox();
  sb.fbApplyData({
    keys: { 'task_items_v1': '[]' },
    updatedAtMs: Date.now(),
  });
  t.ok('_applyingFbData false after apply', sb._applyingFbData === false, sb._applyingFbData);
}

// ── 4. null / missing keys → early return, no throw ─────────────────────────
{
  const { sb } = makeSandbox();
  let threw = false;
  try {
    sb.fbApplyData(null);
    sb.fbApplyData({});
    sb.fbApplyData({ keys: null });
  } catch(e) { threw = true; }
  t.ok('null/empty data does not throw', threw === false);
}

// ── 5. __noop flag → early return, no writes ────────────────────────────────
{
  const { sb, written } = makeSandbox();
  sb.fbApplyData({
    keys: { 'task_items_v1': '[1,2,3]' },
    updatedAtMs: Date.now(),
    __noop: true,
  });
  t.ok('__noop: task_items_v1 not written', !('task_items_v1' in written), written);
}

// ── 6. return_sync_model exclusion is the only skip — other keys not affected
{
  const { sb, written } = makeSandbox();
  const keys = {
    'return_sync_model': 'entity',
    'hobby_cats_v2': '[]',
    'diary_entries_v1': '{}',
    'memos_v5': '[]',
    'return_theme_mode': 'dark',
  };
  sb.fbApplyData({ keys, updatedAtMs: Date.now() });
  t.ok('hobby_cats_v2 written', 'hobby_cats_v2' in written);
  t.ok('diary_entries_v1 written', 'diary_entries_v1' in written);
  t.ok('return_theme_mode written (not device-local)', 'return_theme_mode' in written);
  t.ok('return_sync_model still skipped among other keys', !('return_sync_model' in written));
}

t.done();
