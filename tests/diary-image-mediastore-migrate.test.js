'use strict';
/* Regression test: legacy inline-base64 diary images migrate onto MediaStore.

   Background: diary block images used to be stored as raw base64 directly in
   diary_entries_v1[date]._blocks[].content. That bloated localStorage AND the
   Firebase blob (quota trap), which is why image sync was abandoned. The fix
   routes diary images through MediaStore (IndexedDB + the deduplicated synced
   manifest) as `return-media:<id>` refs, and a one-time migration converts any
   existing inline images.

   This locks in the migration's data-safety contract:
   - every inline data:image block is handed to MediaStore.put (so the bytes are
     preserved in IndexedDB + registered for cross-device sync),
   - its content is replaced with the returned ref,
   - non-image / already-ref / plain-URL blocks are left untouched,
   - the device-local "done" marker is set so it runs once per device,
   - it re-saves when anything changed. */

const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();

const migrateBlock = sliceBlock(
  html,
  'function diaryMigrateInlineImagesToMediaStore(){',
  '\n/* Kick the migration'
);

function makeCtx(opts) {
  opts = opts || {};
  const store = {};
  const putCalls = [];
  let saveAllCalls = 0;
  let nextId = 0;

  const sb = {
    entries: opts.entries || {},
    console: { log() {}, warn() {}, error() {} },
    Promise,
    Object,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    MediaStore: opts.noMediaStore ? undefined : {
      put: (dataUrl) => {
        putCalls.push(dataUrl);
        if (opts.putFails) return Promise.reject(new Error('boom'));
        return Promise.resolve('return-media:m_' + (nextId++));
      },
    },
    saveAll: () => { saveAllCalls++; return true; },
    _apTrace: () => {},
  };
  const ctx = vm.createContext(sb);
  vm.runInContext(migrateBlock, ctx);
  return { ctx, store, putCalls, getSaveAllCalls: () => saveAllCalls };
}

const r = runner('Diary image MediaStore migration');

/* ── Test 1: inline image → ref, bytes handed to MediaStore, saveAll fired ── */
(async function () {
  const entries = {
    '2026-06-20': { _blocks: [
      { type: 'text', content: '오늘 일기' },
      { type: 'image', content: 'data:image/jpeg;base64,AAAA', caption: '사진' },
    ] },
  };
  const { ctx, store, putCalls, getSaveAllCalls } = makeCtx({ entries });
  const migrated = await vm.runInContext('diaryMigrateInlineImagesToMediaStore()', ctx);

  const block = ctx.entries['2026-06-20']._blocks[1];
  r.ok('one image migrated', migrated === 1, migrated);
  r.ok('MediaStore.put received the original bytes',
    putCalls.length === 1 && putCalls[0] === 'data:image/jpeg;base64,AAAA', putCalls);
  r.ok('block.content replaced with a return-media ref',
    /^return-media:/.test(block.content), block.content);
  r.ok('caption preserved', block.caption === '사진', block.caption);
  r.ok('text block untouched',
    ctx.entries['2026-06-20']._blocks[0].content === '오늘 일기');
  r.ok('saveAll fired after migration', getSaveAllCalls() === 1, getSaveAllCalls());
  r.ok('device-local done marker set', store['diary_img_migrated_v1'] === '1', store['diary_img_migrated_v1']);

  /* ── Test 2: already-ref / plain-URL / no images → nothing migrated, no save ── */
  const entries2 = {
    '2026-06-19': { _blocks: [
      { type: 'image', content: 'return-media:m_existing', caption: '' },
      { type: 'image', content: 'https://example.com/a.png', caption: '' },
      { type: 'text', content: 'hi' },
    ] },
  };
  const c2 = makeCtx({ entries: entries2 });
  const migrated2 = await vm.runInContext('diaryMigrateInlineImagesToMediaStore()', c2.ctx);
  r.ok('nothing migrated when no inline base64', migrated2 === 0, migrated2);
  r.ok('no MediaStore.put for non-inline blocks', c2.putCalls.length === 0, c2.putCalls);
  r.ok('saveAll not fired when no change', c2.getSaveAllCalls() === 0, c2.getSaveAllCalls());
  r.ok('done marker still set on no-op pass', c2.store['diary_img_migrated_v1'] === '1');
  r.ok('existing ref left as-is',
    c2.ctx.entries['2026-06-19']._blocks[0].content === 'return-media:m_existing');

  /* ── Test 3: put failure keeps the original inline content (no data loss) ── */
  const entries3 = {
    '2026-06-18': { _blocks: [
      { type: 'image', content: 'data:image/png;base64,BBBB', caption: 'x' },
    ] },
  };
  const c3 = makeCtx({ entries: entries3, putFails: true });
  const migrated3 = await vm.runInContext('diaryMigrateInlineImagesToMediaStore()', c3.ctx);
  r.ok('failed put migrates nothing', migrated3 === 0, migrated3);
  r.ok('original inline image preserved on put failure',
    c3.ctx.entries['2026-06-18']._blocks[0].content === 'data:image/png;base64,BBBB',
    c3.ctx.entries['2026-06-18']._blocks[0].content);

  /* ── Test 4: no MediaStore available → safe no-op, marker NOT set (retry later) ── */
  const c4 = makeCtx({ entries: { '2026-06-17': { _blocks: [ { type:'image', content:'data:image/png;base64,CCCC' } ] } }, noMediaStore: true });
  const migrated4 = await vm.runInContext('diaryMigrateInlineImagesToMediaStore()', c4.ctx);
  r.ok('no-op when MediaStore unavailable', migrated4 === 0, migrated4);
  r.ok('inline image kept when MediaStore unavailable',
    c4.ctx.entries['2026-06-17']._blocks[0].content === 'data:image/png;base64,CCCC');
  r.ok('marker NOT set so a later boot can retry',
    c4.store['diary_img_migrated_v1'] === undefined, c4.store['diary_img_migrated_v1']);

  r.done();
})();
