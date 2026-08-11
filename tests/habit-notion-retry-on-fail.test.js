'use strict';
/* Regression: routine → Notion auto-send must RETRY after a failed send.

   Bug: queueHabitNotionSave recorded the state signature at ARM time (before the
   async PATCH ran) under 'habit_notion_last_sig'. If that send then failed, the
   signature was already stored, so every later saveRoutineData with the same
   routine state hit `_last===_sig` and bailed — the routine never reached Notion
   ("아직도 루틴 노션에 반영 안됨"), with no retry until the state changed.

   Fix: the signature is written only on a SUCCESSFUL send (in
   syncHabitStatusToNotion), under a fresh key 'habit_notion_sent_sig'.
   queueHabitNotionSave only skips when the current state equals the last
   *successfully sent* signature. A failed send leaves sent_sig unchanged, so the
   next save re-arms and retries. */

const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const queueBlock = sliceBlock(html, 'function queueHabitNotionSave(', 'async function syncHabitStatusToNotion(');

const SEP = '␟'; // ␟ — same separator the source uses

function makeCtx() {
  const store = {};
  let state = '□ a';                       // current routine text blob (mutable)
  const traces = [];
  let armCount = 0;
  const sb = {
    window: {},
    console: { error(){}, warn(){}, log(){} },
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    getHabitNotionCfg: () => ({ dbId:'db', leftProp:'L', rightProp:'R', pageId:'pg', pageTitle:'루틴' }),
    getNotionCfg: () => ({ workerUrl:'https://w' }),
    habitNotionBuildTexts: () => ({ left: state, right: '', count: 1 }),
    _hnTrace: (stage, detail) => { traces.push({ stage, detail }); },
    _habitNotionSaveTimer: undefined,
    clearTimeout: () => {},
    // Mocked: record that a send was armed, but DON'T actually invoke the sync.
    setTimeout: () => { armCount++; return 1; },
    syncHabitStatusToNotion: () => {},
  };
  const ctx = vm.createContext(sb);
  vm.runInContext(queueBlock, ctx);
  return {
    ctx, store, traces,
    setState: (s) => { state = s; },
    sig: () => state + SEP + '',
    armCount: () => armCount,
    lastStage: () => (traces.length ? traces[traces.length - 1].stage : null),
    call: () => vm.runInContext('queueHabitNotionSave()', ctx),
    // simulate a successful send recording its signature (what syncHabitStatusToNotion now does)
    markSent: () => { store['habit_notion_sent_sig'] = state + SEP + ''; },
  };
}

const r = runner('habit-notion — retry after failed send');

/* 1. First save with empty sent_sig → armed. */
{
  const m = makeCtx();
  m.call();
  r.ok('first save arms a send', m.lastStage() === 'armed' && m.armCount() === 1,
    'stage=' + m.lastStage() + ' arms=' + m.armCount());
}

/* 2. Send FAILED (sent_sig never written) → same state re-saves must RE-ARM. */
{
  const m = makeCtx();
  m.call();                 // arm #1 (then imagine the PATCH failed → no markSent)
  m.call();                 // same state again
  r.ok('failed send retries on next save (no permanent skip)',
    m.lastStage() === 'armed' && m.armCount() === 2,
    'stage=' + m.lastStage() + ' arms=' + m.armCount());
}

/* 3. Send SUCCEEDED (sent_sig recorded) → identical state is skipped (no spam). */
{
  const m = makeCtx();
  m.call();                 // arm #1
  m.markSent();             // success records the signature
  m.call();                 // same state again
  r.ok('successful send suppresses identical re-save',
    m.lastStage() === 'skip' && m.armCount() === 1,
    'stage=' + m.lastStage() + ' arms=' + m.armCount());
  r.ok('skip reason is 상태 변화 없음(전송 완료)',
    m.traces[m.traces.length - 1].detail.indexOf('전송 완료') >= 0,
    m.traces[m.traces.length - 1].detail);
}

/* 4. After a success, a CHANGED state re-arms. */
{
  const m = makeCtx();
  m.call();
  m.markSent();
  m.setState('■ a');        // user checks the habit → state changes
  m.call();
  r.ok('changed state after success re-arms',
    m.lastStage() === 'armed' && m.armCount() === 2,
    'stage=' + m.lastStage() + ' arms=' + m.armCount());
}

/* 5. The old arm-time key is never written (only sent_sig, on success). */
{
  const m = makeCtx();
  m.call();
  r.ok('no arm-time signature written', m.store['habit_notion_last_sig'] == null,
    'habit_notion_last_sig=' + m.store['habit_notion_last_sig']);
  r.ok('sent_sig only set by a successful send, not by arming',
    m.store['habit_notion_sent_sig'] == null,
    'sent_sig=' + m.store['habit_notion_sent_sig']);
}

r.done();
