'use strict';
/* 습관 스케줄(매일 / 주 N회 / 특정 요일)의 순수 로직 고정.

   - routineHabitSched(h): sched 정규화(없으면 daily, 범위 클램프).
   - routineSchedLabel(h): 배지 문구('매일' / '주 3회' / '월·수·금').
   - routineHabitScheduledOn(h, date): 그 요일에 '예정'인지.
   - routineHabitWeekStatus(h, ref): 주간 칸(cells) + 달성치(achieved/target/met).
     · daily  → 분모 7, 채운 날 수
     · weekly → 분모 count, 채운 날 수(상한 count)
     · days   → 분모 예정요일 수, 예정요일 중 채운 수 (지난 예정 미완료 = miss) */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'var ROUTINE_WD=[', '\nwindow.routineHabitWeekStatus=routineHabitWeekStatus;');

function makeSandbox(logs, ws, todayDate) {
  const routineDateKey = (d) => {
    d = d || todayDate;
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  const sb = {
    window: {}, console: { warn() {}, log() {} },
    routineLogs: logs || {},
    weekStart: ws == null ? 0 : ws,
    routineDateKey,
    returnLogicalNow: () => new Date(todayDate),
    Date, Math, Number, String, Array, Object, parseInt, isNaN,
  };
  vm.createContext(sb);
  vm.runInContext(block, sb);
  return sb;
}

const t = runner('습관 스케줄 · 계산');

// 기준: 2026-08-26 (수요일). weekStart=0(일) → 주는 8/23(일)~8/29(토).
const TODAY = new Date(2026, 7, 26); // Wed
const sb = makeSandbox({}, 0, TODAY);

// ── 정규화 & 라벨 ────────────────────────────────────────────────────────────
{
  t.ok('sched 없으면 daily', sb.routineHabitSched({}).type === 'daily');
  t.ok('daily 라벨', sb.routineSchedLabel({}) === '매일');
  const w = sb.routineHabitSched({ sched: { type: 'weekly', count: 3 } });
  t.ok('weekly count 유지', w.type === 'weekly' && w.count === 3);
  t.ok('weekly 라벨', sb.routineSchedLabel({ sched: { type: 'weekly', count: 3 } }) === '주 3회');
  const w0 = sb.routineHabitSched({ sched: { type: 'weekly', count: 0 } });
  t.ok('weekly count 최소 1로 클램프', w0.count === 1, w0.count);
  const w9 = sb.routineHabitSched({ sched: { type: 'weekly', count: 99 } });
  t.ok('weekly count 최대 7로 클램프', w9.count === 7, w9.count);
  const d = sb.routineHabitSched({ sched: { type: 'days', days: [5, 1, 3, 3, 8] } });
  t.ok('days 정렬·중복·범위 정리', d.days.join(',') === '1,3,5', d.days.join(','));
  t.ok('days 라벨', sb.routineSchedLabel({ sched: { type: 'days', days: [1, 3, 5] } }) === '월·수·금');
  t.ok('days 비면 평일 기본값', sb.routineHabitSched({ sched: { type: 'days', days: [] } }).days.join(',') === '1,2,3,4,5');
}

// ── scheduledOn ──────────────────────────────────────────────────────────────
{
  const mwf = { sched: { type: 'days', days: [1, 3, 5] } };
  t.ok('월(1) 예정', sb.routineHabitScheduledOn(mwf, new Date(2026, 7, 24)) === true); // Mon
  t.ok('화(2) 비예정', sb.routineHabitScheduledOn(mwf, new Date(2026, 7, 25)) === false); // Tue
  t.ok('daily는 항상 예정', sb.routineHabitScheduledOn({}, new Date(2026, 7, 25)) === true);
  t.ok('weekly는 항상 기회', sb.routineHabitScheduledOn({ sched: { type: 'weekly', count: 2 } }, new Date(2026, 7, 25)) === true);
}

// ── weekly 계산: 요일 무관, 채운 날 수(상한 count) ───────────────────────────
{
  const logs = {
    '2026-08-23': { hW: { state: 'done' } },  // Sun
    '2026-08-25': { hW: { state: 'skip' } },  // Tue (skip=완료로 계산)
    '2026-08-26': { hW: { state: 'done' } },  // Wed(today)
  };
  const s = makeSandbox(logs, 0, TODAY);
  const h = { id: 'hW', sched: { type: 'weekly', count: 3 } };
  const ws = s.routineHabitWeekStatus(h, TODAY);
  t.ok('weekly 7칸', ws.cells.length === 7);
  t.ok('weekly done 3', ws.doneCount === 3, ws.doneCount);
  t.ok('weekly target=count', ws.target === 3);
  t.ok('weekly achieved 상한', ws.achieved === 3);
  t.ok('weekly 달성', ws.met === true);
  // 하루 더 채우면 doneCount 4지만 achieved는 3에서 상한
  const logs2 = Object.assign({}, logs, { '2026-08-24': { hW: { state: 'done' } } });
  const s2 = makeSandbox(logs2, 0, TODAY);
  const ws2 = s2.routineHabitWeekStatus(h, TODAY);
  t.ok('weekly 초과해도 achieved 상한 유지', ws2.doneCount === 4 && ws2.achieved === 3, ws2.doneCount + '/' + ws2.achieved);
}

// ── days 계산: 지나간 예정요일만 분모(so-far), 지난 예정 미완료 = miss ─────────
{
  // 월수금 습관. 이번 주(8/23~8/29): 예정=월(24)·수(26=today)·금(28).
  // 오늘=수. 지나간 예정 = 월·수(2) — 금은 미래(대기). 월 완료 → 1/2.
  const logs = { '2026-08-24': { hD: { state: 'done' } } };
  const s = makeSandbox(logs, 0, TODAY);
  const h = { id: 'hD', sched: { type: 'days', days: [1, 3, 5] } };
  const ws = s.routineHabitWeekStatus(h, TODAY);
  t.ok('days target=지나간 예정요일 수', ws.target === 2, ws.target);
  t.ok('days achieved=예정 중 완료', ws.achieved === 1, ws.achieved);
  t.ok('days 미달성(오늘 예정 아직 안함)', ws.met === false);
  // 칸 상태: 화(25)=off(비예정), 월(24)=done, 오늘(26)=예정이지만 아직 안함 → miss 아님(과거 아님)
  const byKey = {}; ws.cells.forEach((c) => { byKey[c.key] = c; });
  t.ok('월 done', byKey['2026-08-24'].cls === 'done');
  t.ok('화 off(비예정)', byKey['2026-08-25'].cls === 'off', byKey['2026-08-25'].cls);
  t.ok('오늘(예정,미완료,과거아님)은 miss 아님', byKey['2026-08-26'].cls === '' && byKey['2026-08-26'].isToday, byKey['2026-08-26'].cls);
  t.ok('금 미래 예정 = future', byKey['2026-08-28'].cls === 'future', byKey['2026-08-28'].cls);

  // 지난 예정을 놓쳤을 때(월 미완료) → miss
  const s2 = makeSandbox({}, 0, TODAY);
  const ws2 = s2.routineHabitWeekStatus(h, TODAY);
  const b2 = {}; ws2.cells.forEach((c) => { b2[c.key] = c; });
  t.ok('놓친 월 예정 = miss', b2['2026-08-24'].cls === 'miss', b2['2026-08-24'].cls);
}

// ── weekStart=1(월요일 시작)이면 주 경계가 달라진다 ──────────────────────────
{
  const s = makeSandbox({}, 1, TODAY); // week Mon 8/24 ~ Sun 8/30
  const h = { id: 'hx' };
  const ws = s.routineHabitWeekStatus(h, TODAY);
  t.ok('월시작 첫 칸 = 월(24)', ws.cells[0].key === '2026-08-24', ws.cells[0].key);
  t.ok('월시작 마지막 칸 = 일(30)', ws.cells[6].key === '2026-08-30', ws.cells[6].key);
}

// ── daily 계산: 분모 = 지나간 날 수(so-far) ──────────────────────────────────
{
  // 오늘=수(8/26). 주 시작 일(8/23) → 지나간 날 = 일·월·화·수 = 4.
  const logs = { '2026-08-24': { hd: { state: 'done' } }, '2026-08-26': { hd: { state: 'done' } } };
  const s = makeSandbox(logs, 0, TODAY);
  const ws = s.routineHabitWeekStatus({ id: 'hd' }, TODAY);
  t.ok('daily target=지나간 날 수', ws.target === 4, ws.target);
  t.ok('daily achieved=완료 날 수', ws.achieved === 2, ws.achieved);
  t.ok('daily 미래 날은 future', ws.cells.filter((c) => c.cls === 'future').length === 3, ws.cells.filter((c) => c.cls === 'future').length);
}

t.done();
