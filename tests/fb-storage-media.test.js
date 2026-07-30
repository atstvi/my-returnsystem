'use strict';
/* STAGE 5b — Firebase Storage media channel (return_media_fb_v1 url map).

   Image ORIGINAL bytes go to Firebase Storage; the app keeps only a tiny synced
   map id → {path,url}. This suite pins the two properties that matter for data
   safety in this repo:

   A. The url-map round-trips through setReturnStorageItem (so it syncs) and
      de-dups (never rewrites an unchanged entry — keeps the Firebase blob calm).
   B. When Storage is NOT ready (SDK unloaded / signed out / offline) EVERY entry
      point degrades quietly to the existing IndexedDB path — no throw, no write.
      This is the whole reason the pipeline is safe to ship before device
      verification: an unconfigured/errored Storage must behave exactly as before.
*/
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(
  html,
  "var RETURN_FB_MEDIA_KEY='return_media_fb_v1';",
  '\nvar MediaStore = {'
);

function makeSandbox() {
  const store = {};
  let setCalls = 0;
  const sb = {
    window: {},
    console: { error() {}, warn() {}, log() {} },
    Date,
    Promise,
    Object,
    Math,
    JSON,
    // localStorage shim (reads for _returnFbMediaMap / scan)
    localStorage: {
      get length() { return Object.keys(store).length; },
      key: (i) => Object.keys(store)[i],
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    // The one canonical write path. Count calls to assert de-dup.
    setReturnStorageItem: (k, v) => { setCalls++; store[k] = String(v); return true; },
    bannerDebugLog: () => {},
    // media-stack collaborators referenced by the block
    MEDIA_SYNC_KEY: 'return_media_sync_v1',
    isReturnMediaRef: (v) => /^(return-media:|media:)/.test(String(v || '')),
    returnMediaRefId: (v) => String(v || '').replace(/^return-media:|^media:/, ''),
    returnMediaGet: () => Promise.resolve(null),
    mediaSyncGet: () => '',
    setTimeout: () => {},
    clearTimeout: () => {},
    // Storage NOT ready in this sandbox: firebase undefined, no handle/user.
    firebase: undefined,
    fbStorage: null,
    fbUser: null,
  };
  vm.createContext(sb);
  vm.runInContext(block, sb);
  return { sb, store, setCalls: () => setCalls };
}

const t = runner('STAGE 5b — Firebase Storage media map + safety guards');

// ── A1. put → get round-trips, and rides setReturnStorageItem (syncs) ────────
{
  const { sb, store } = makeSandbox();
  const rec = { path: 'users/u1/media/m_1.jpg', url: 'https://x/o/m_1.jpg?token=abc' };
  const ok = sb.returnFbMediaPut('m_1', rec);
  t.ok('put returns true', ok === true);
  t.ok('written under return_media_fb_v1 (synced key)', !!store['return_media_fb_v1']);
  const got = sb.returnFbMediaGet('m_1');
  t.ok('get returns the stored record', got && got.url === rec.url && got.path === rec.path, got);
}

// ── A2. get is null for missing / malformed ──────────────────────────────────
{
  const { sb, store } = makeSandbox();
  t.ok('missing id → null', sb.returnFbMediaGet('nope') === null);
  store['return_media_fb_v1'] = JSON.stringify({ bad: { path: 'p' } }); // no url
  t.ok('record without url → null', sb.returnFbMediaGet('bad') === null);
  store['return_media_fb_v1'] = 'not json';
  t.ok('corrupt map → null (no throw)', sb.returnFbMediaGet('bad') === null);
}

// ── A3. put de-dups: identical rec must NOT re-write (keeps blob sync calm) ───
{
  const { sb, setCalls } = makeSandbox();
  const rec = { path: 'users/u1/media/m_2.jpg', url: 'https://x/o/m_2.jpg?token=z' };
  sb.returnFbMediaPut('m_2', rec);
  const after1 = setCalls();
  sb.returnFbMediaPut('m_2', { path: rec.path, url: rec.url }); // same url+path
  t.ok('identical put does not re-write', setCalls() === after1, { after1, now: setCalls() });
  sb.returnFbMediaPut('m_2', { path: rec.path, url: rec.url + 'NEW' }); // changed url
  t.ok('changed put re-writes', setCalls() === after1 + 1, { after1, now: setCalls() });
}

// ── A4. delete removes the entry ─────────────────────────────────────────────
{
  const { sb } = makeSandbox();
  sb.returnFbMediaPut('m_3', { path: 'p', url: 'https://x/m_3?token=t' });
  t.ok('present before delete', !!sb.returnFbMediaGet('m_3'));
  sb.returnFbMediaDelete('m_3');
  t.ok('absent after delete', sb.returnFbMediaGet('m_3') === null);
}

// ── B1. returnStorageReady is false when the SDK/handle/user are absent ──────
{
  const { sb } = makeSandbox();
  t.ok('not ready without firebase/handle/user', sb.returnStorageReady() === false);
}

const t2done = (async () => {
  // ── B2. upload degrades to null (no throw) when Storage not ready ─────────
  {
    const { sb, setCalls } = makeSandbox();
    const before = setCalls();
    const out = await sb.returnStorageUpload('m_x', 'data:image/png;base64,AAAA', {});
    t.ok('upload → null when not ready', out === null);
    t.ok('upload wrote nothing when not ready', setCalls() === before);
  }
  // ── B3. upload → null for a non-image value even if it were ready ─────────
  {
    const { sb } = makeSandbox();
    const out = await sb.returnStorageUpload('m_y', 'not-a-data-url', {});
    t.ok('upload → null for non-image', out === null);
  }
  // ── B4. backfill resolves an empty tally (no throw) when not ready ────────
  {
    const { sb, store } = makeSandbox();
    // even with referenced media in storage, a not-ready backfill is a no-op
    store['diary_entries_v1'] = JSON.stringify({ '2026-07-30': { img: 'return-media:m_z' } });
    const res = await sb.returnStorageBackfill();
    t.ok('backfill no-op when not ready', res && res.uploaded === 0 && res.scanned === 0, res);
  }
  // ── B5. delete is a resolved no-op when not ready (map entry still purged) ─
  {
    const { sb } = makeSandbox();
    sb.returnFbMediaPut('m_d', { path: 'users/u/media/m_d.jpg', url: 'https://x/m_d?token=t' });
    await sb.returnStorageDelete('return-media:m_d');
    t.ok('delete purges map entry even when Storage not ready', sb.returnFbMediaGet('m_d') === null);
  }
})();

t2done.then(() => { t.done(); }).catch((e) => { console.error(e); process.exitCode = 1; });
