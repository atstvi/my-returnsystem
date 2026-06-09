'use strict';
/* mediaSyncPrune (PR #97/#98) — manifest bloat control.
   return_media_sync_v1 grew past its budget because mediaSyncPut refused new
   entries once over the cap but never evicted stale ones, and the fbApplyData /
   fbSaveNow union-merge re-inflated it from the cloud blob each sync.
   mediaSyncPrune brings the manifest back under budget by (1) dropping orphaned
   IDs not referenced anywhere in localStorage, then (2) evicting the largest
   remaining entries until under target.

   Tests:
   1. orphaned entry (no ref in any LS value) is removed
   2. active entry (referenced in a LS value) is kept
   3. over-budget manifest is evicted down to target (largest-first)
   4. prune is a no-op when already under budget + only orphans
   5. MEDIA_SYNC_TOTAL_MAX default is the char budget (~1.5MB on disk at 2B/char) */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html,
  "var MEDIA_SYNC_KEY='return_media_sync_v1';",
  'window.mediaSyncResolve=mediaSyncResolve;');

function makeSandbox() {
  const store = {};
  const ls = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    get length() { return Object.keys(store).length; },
    key: (i) => Object.keys(store)[i],
  };
  const sb = {
    store,
    localStorage: ls,
    window: {},
    console: { log() {}, warn() {}, error() {} },
    // Externals referenced by the block — minimal real behavior.
    isReturnMediaRef: (u) => /^(return-media:|media:)/.test(String(u || '')),
    returnMediaRefId: (r) => String(r || '').replace(/^return-media:|^media:/, ''),
    // setReturnStorageItem just writes through for the test.
    setReturnStorageItem: (k, v) => { store[k] = String(v); return true; },
  };
  vm.createContext(sb);
  vm.runInContext(block, sb);
  return sb;
}

// helper: make a data-image string of approx N bytes
function img(n) { return 'data:image/png;base64,' + 'A'.repeat(Math.max(0, n - 23)); }

const t = runner('mediaSyncPrune — manifest bloat control (PR #97/#98)');

// ── 5. default budget is 750000 chars (~1.5MB on disk at UTF-16 2B/char) ─────
{
  const sb = makeSandbox();
  t.ok('MEDIA_SYNC_TOTAL_MAX === 750000', sb.MEDIA_SYNC_TOTAL_MAX === 750000, sb.MEDIA_SYNC_TOTAL_MAX);
}

// ── 1 & 2. orphan removed, active kept ───────────────────────────────────────
{
  const sb = makeSandbox();
  const manifest = { active1: img(100), orphan1: img(100) };
  sb.store['return_media_sync_v1'] = JSON.stringify(manifest);
  // a LS value references active1 but NOT orphan1
  sb.store['return_theme_studio_state_v1'] = JSON.stringify({ icon: 'return-media:active1' });
  const changed = sb.mediaSyncPrune(10 * 1024 * 1024); // huge target → only orphan logic
  const after = JSON.parse(sb.store['return_media_sync_v1']);
  t.ok('prune reports change', changed === true);
  t.ok('active entry kept', 'active1' in after, Object.keys(after));
  t.ok('orphan entry removed', !('orphan1' in after), Object.keys(after));
}

// ── 3. over-budget → largest evicted first, down to target ───────────────────
{
  const sb = makeSandbox();
  // all three are "active" so orphan pass removes nothing; eviction must trigger
  const manifest = { big: img(200000), mid: img(150000), small: img(50000) };
  sb.store['return_media_sync_v1'] = JSON.stringify(manifest);
  sb.store['ref_holder'] = JSON.stringify([
    'return-media:big', 'return-media:mid', 'return-media:small',
  ]);
  sb.mediaSyncPrune(180000); // budget below big+mid+small (~400k); must evict
  const after = JSON.parse(sb.store['return_media_sync_v1']);
  const total = Object.keys(after).reduce((s, k) => s + after[k].length, 0);
  t.ok('under target after eviction', total <= 180000, total);
  t.ok('largest "big" evicted first', !('big' in after), Object.keys(after));
  t.ok('smallest "small" survives', 'small' in after, Object.keys(after));
}

// ── 4. no-op when under budget and no orphans ────────────────────────────────
{
  const sb = makeSandbox();
  const manifest = { a: img(100), b: img(100) };
  sb.store['return_media_sync_v1'] = JSON.stringify(manifest);
  sb.store['holder'] = JSON.stringify(['return-media:a', 'return-media:b']);
  const changed = sb.mediaSyncPrune(10 * 1024 * 1024);
  const after = JSON.parse(sb.store['return_media_sync_v1']);
  t.ok('no change reported', changed === false);
  t.ok('both entries intact', 'a' in after && 'b' in after, Object.keys(after));
}

// ── 6. manifest key itself is not scanned as a ref source ────────────────────
{
  const sb = makeSandbox();
  // an entry whose ONLY appearance is as a manifest key must still count as orphan
  const manifest = { ghost: img(100) };
  sb.store['return_media_sync_v1'] = JSON.stringify(manifest);
  sb.mediaSyncPrune(10 * 1024 * 1024);
  const after = JSON.parse(sb.store['return_media_sync_v1']);
  t.ok('manifest self-reference does not protect orphan', !('ghost' in after), Object.keys(after));
}

t.done();
