'use strict';
/* Regression test: in-flight diary edits must not be lost when a Firebase
   snapshot arrives mid-typing.

   Bug: diary text is only written into `entries` on the 4s autosave debounce
   (commitCurrent inside saveTimer). If a cloud snapshot landed during that
   window, fbApplyData's per-date LWW merge compared the cloud entry against a
   STALE saved entry, cloud won, and loadDate repainted the textarea — wiping
   the text the user was still typing ("쓰던 분량이 사라지는").

   Fix: fbApplyData now flushes the in-flight edit (commitCurrent) BEFORE the
   merge so the local entry carries the freshest text + updatedAt and wins.

   This test locks in the property the fix relies on: commitCurrent() copies the
   live textarea values into entries[currentDate] and stamps a fresh updatedAt
   that is strictly newer than the previously-saved entry. */

const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();

const commitBlock = sliceBlock(
  html,
  'function commitCurrent() {',
  '\nfunction saveAll() {'
);

const SECTIONS = ['sleep','morning','resolution','timeline','accomplishment','night','recap'];

function makeCtx(opts) {
  opts = opts || {};
  const currentDate = '2026-06-20';
  // textarea live values keyed by section (what the user has typed)
  const live = opts.live || {};
  // pre-existing saved entry (stale text + old updatedAt)
  const entries = opts.entries || { [currentDate]: { updatedAt: 1000 } };

  const els = {};
  SECTIONS.forEach(function(k){
    els['diary_'+k] = { value: (k in live) ? live[k] : '' };
  });
  // no block-list in this scenario
  const document = {
    getElementById: (id) => (id in els ? els[id] : null),
  };

  const sb = {
    SECTIONS,
    currentDate,
    entries,
    document,
    Date,
    console: { log(){}, warn(){}, error(){} },
  };
  const ctx = vm.createContext(sb);
  vm.runInContext(commitBlock, ctx);
  return ctx;
}

const r = runner('Diary in-flight edit flush (commitCurrent)');

/* ── Test 1: live textarea text is captured into entries ── */
{
  const ctx = makeCtx({
    live: { morning: '오늘 아침 감사한 것 — 길게 쓰는 중...', night: '' },
    entries: { '2026-06-20': { morning: '(예전 내용)', updatedAt: 1000 } },
  });
  vm.runInContext('commitCurrent()', ctx);
  const e = ctx.entries['2026-06-20'];
  r.ok('live morning text captured into entries',
    e.morning === '오늘 아침 감사한 것 — 길게 쓰는 중...', e.morning);
}

/* ── Test 2: updatedAt is stamped fresh (newer than the stale saved value) ── */
{
  const before = Date.now();
  const ctx = makeCtx({
    live: { resolution: '다짐' },
    entries: { '2026-06-20': { resolution: '', updatedAt: 1000 } },
  });
  vm.runInContext('commitCurrent()', ctx);
  const e = ctx.entries['2026-06-20'];
  r.ok('updatedAt stamped strictly newer than stale saved value',
    Number(e.updatedAt) >= before && Number(e.updatedAt) > 1000, e.updatedAt);
}

/* ── Test 3: this fresh updatedAt makes local WIN the per-date LWW ──
   Mirrors the merge rule in fbApplyData: cloud wins only when cu >= lu. After a
   flush, local lu is "now", so a cloud entry with any earlier updatedAt loses. */
{
  const ctx = makeCtx({
    live: { timeline: '내가 방금 친 타임라인' },
    entries: { '2026-06-20': { timeline: '', updatedAt: 1000 } },
  });
  vm.runInContext('commitCurrent()', ctx);
  const localUpdatedAt = Number(ctx.entries['2026-06-20'].updatedAt);
  const cloudUpdatedAt = 1500; // a stale cloud snapshot from before this edit
  const cloudWins = cloudUpdatedAt >= localUpdatedAt;
  r.ok('flushed local edit beats stale cloud snapshot in LWW',
    cloudWins === false, { localUpdatedAt, cloudUpdatedAt });
}

/* ── Test 4: untouched sections still round-trip (no accidental wipe) ── */
{
  const ctx = makeCtx({
    live: { sleep: '7시간', morning: '', resolution: '', timeline: '',
            accomplishment: '', night: '', recap: '' },
    entries: { '2026-06-20': { sleep: '', updatedAt: 1000 } },
  });
  vm.runInContext('commitCurrent()', ctx);
  const e = ctx.entries['2026-06-20'];
  r.ok('sleep captured', e.sleep === '7시간', e.sleep);
  r.ok('empty sections stay empty (no undefined)', e.recap === '', JSON.stringify(e.recap));
}

r.done();
