'use strict';
/* 집중 기록(focus_timer_log_v1)은 사용자가 직접 삭제하지 않는 한 절대 사라지면 안 된다.
   예전 focusTimerSaveLog는 저장할 때마다 focusTimerLog.slice(-200)으로 잘라, 기록이
   200개를 넘으면 오래된 것이 조용히 없어졌다. 이 테스트는 실제 focusTimerLoadLog /
   focusTimerSaveLog를 index.html에서 떼어 와, 200개를 넘겨도 저장·재로드 후 전부
   살아남는지 고정한다. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'function focusTimerLoadLog(', '/* ── W4b: fold PC-widget');

function makeSandbox() {
  const store = {};
  const ls = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
  const sb = {
    console,
    FOCUS_TIMER_LOG_KEY: 'focus_timer_log_v1',
    focusTimerLog: [],
    focusTimerEnsureIds: function () {},           // no-op mock
    localStorage: ls,
    // real app routes app-data writes through setReturnStorageItem (which mirrors to localStorage)
    setReturnStorageItem: (k, v) => { store[k] = String(v); return true; },
  };
  vm.createContext(sb);
  vm.runInContext(block, sb);
  return { sb, store };
}

const t = runner('Focus log — never silently truncated');

/* ── 1. 250개 저장 → 재로드 시 250개 전부 유지(예전엔 200개로 잘림) ── */
{
  const { sb } = makeSandbox();
  for (let i = 0; i < 250; i++) sb.focusTimerLog.push({ id: 'r' + i, durationMs: 60000, completedAt: 1000 + i });
  sb.focusTimerSaveLog();
  sb.focusTimerLog = [];          // 메모리 비우고
  sb.focusTimerLoadLog();          // 디스크에서 다시 로드
  t.ok('all 250 records survive save+reload', sb.focusTimerLog.length === 250, 'len=' + sb.focusTimerLog.length);
  t.ok('oldest record kept (r0)', sb.focusTimerLog.some((r) => r.id === 'r0'), 'r0 present');
  t.ok('newest record kept (r249)', sb.focusTimerLog.some((r) => r.id === 'r249'), 'r249 present');
}

/* ── 2. writes go through setReturnStorageItem (quota overflow → IndexedDB 안전) ── */
{
  const { sb } = makeSandbox();
  let viaSet = 0;
  sb.setReturnStorageItem = (k, v) => { viaSet++; return true; };
  sb.focusTimerLog.push({ id: 'x', durationMs: 1000, completedAt: 1 });
  sb.focusTimerSaveLog();
  t.ok('save routes through setReturnStorageItem', viaSet === 1, 'calls=' + viaSet);
}

/* ── 3. 명시적 삭제(한 건 필터)만 기록을 없앤다 — 나머지는 보존 ── */
{
  const { sb } = makeSandbox();
  for (let i = 0; i < 5; i++) sb.focusTimerLog.push({ id: 'r' + i, durationMs: 1000, completedAt: i });
  // focusTimerDeleteRecord가 하는 것과 동일: id 하나만 필터
  sb.focusTimerLog = sb.focusTimerLog.filter((l) => l && l.id !== 'r2');
  sb.focusTimerSaveLog();
  sb.focusTimerLog = [];
  sb.focusTimerLoadLog();
  t.ok('explicit delete removes only that record', sb.focusTimerLog.length === 4 && !sb.focusTimerLog.some((r) => r.id === 'r2'), 'len=' + sb.focusTimerLog.length);
}

t.done();
