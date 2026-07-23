'use strict';
/* Focus records — pure helpers behind the timer's 집중 기록 weekly view:
   focusWeekStart / focusFmtDur / focusWeekAggregate / buildManualFocusRecord.
   Loaded straight out of index.html and exercised in a mocked sandbox.
   Dates are built with `new Date(y,m,d,hh,mm)` and aggregated with the same
   local-time arithmetic, so the assertions hold regardless of host timezone. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'function _ftDateKeyFromMs(', 'function focusLogHtml(');

const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(block, sandbox);
const { focusWeekStart, focusFmtDur, focusWeekAggregate, buildManualFocusRecord, _ftDateKeyFromMs, focusYearAggregate, _ftDayKey } = sandbox;

const t = runner('Focus timeline — pure helpers');

/* ── focusWeekStart ── 2026-06-24 is a Wednesday ── */
let ws0 = focusWeekStart(new Date(2026, 5, 24), 0);
t.ok('week start (Sun) → 6/21', ws0.getDate() === 21 && ws0.getDay() === 0, ws0.toString());
let ws1 = focusWeekStart(new Date(2026, 5, 24), 1);
t.ok('week start (Mon) → 6/22', ws1.getDate() === 22 && ws1.getDay() === 1, ws1.toString());
let wsSun = focusWeekStart(new Date(2026, 5, 21), 1); // a Sunday, Monday-anchored → prev Monday 6/15
t.ok('Sunday w/ Mon anchor → 6/15', wsSun.getDate() === 15 && wsSun.getDay() === 1, wsSun.toString());

/* ── focusFmtDur ── */
t.ok('0ms → 0초', focusFmtDur(0) === '0초', focusFmtDur(0));
t.ok('45s → 45초', focusFmtDur(45000) === '45초', focusFmtDur(45000));
t.ok('25m → 25분', focusFmtDur(1500000) === '25분', focusFmtDur(1500000));
t.ok('1h → 1시간', focusFmtDur(3600000) === '1시간', focusFmtDur(3600000));
t.ok('1h30m → 1시간 30분', focusFmtDur(5400000) === '1시간 30분', focusFmtDur(5400000));

/* ── _ftDateKeyFromMs ── */
t.ok('date key padded', _ftDateKeyFromMs(new Date(2026, 0, 3).getTime()) === '2026-01-03', _ftDateKeyFromMs(new Date(2026, 0, 3).getTime()));

/* ── focusWeekAggregate ── */
const WS = focusWeekStart(new Date(2026, 5, 24), 0).getTime(); // Sunday 6/21 00:00 local

// empty
let agg = focusWeekAggregate([], WS);
t.ok('empty → 7 days', agg.days.length === 7, agg.days.length);
t.ok('empty → count 0', agg.count === 0 && agg.totalMs === 0, agg);
t.ok('empty → default range 8–22', agg.rangeStart === 8 && agg.rangeEnd === 22, agg);

// one session Tue 6/23 14:00–14:30 (30m)
const tue = new Date(2026, 5, 23, 14, 30).getTime();
agg = focusWeekAggregate([{ id: 's1', mode: 'pomodoro', durationMs: 1800000, completedAt: tue, taskText: 'A' }], WS);
t.ok('one → count 1', agg.count === 1 && agg.totalMs === 1800000, agg);
t.ok('attributed to day index 2 (Tue)', agg.days[2].totalMs === 1800000 && agg.days[2].sessions.length === 1, agg.days[2]);
t.ok('block start/end minutes', agg.days[2].sessions[0].startMin === 840 && agg.days[2].sessions[0].endMin === 870, agg.days[2].sessions[0]);
t.ok('range fits + min 4h (14–18)', agg.rangeStart === 14 && agg.rangeEnd === 18, agg);
t.ok('busiest key = Tue', agg.busiestKey === agg.days[2].key, agg.busiestKey);
t.ok('activeDays 1', agg.activeDays === 1, agg.activeDays);
t.ok('avg = total/7', agg.avgMs === Math.round(1800000 / 7), agg.avgMs);

// session outside the week ignored
agg = focusWeekAggregate([{ id: 'x', durationMs: 1000, completedAt: WS - 1000 }], WS);
t.ok('before week → ignored', agg.count === 0, agg);
agg = focusWeekAggregate([{ id: 'x', durationMs: 1000, completedAt: WS + 7 * 86400000 }], WS);
t.ok('after week → ignored', agg.count === 0, agg);

// two sessions same day accumulate
const a = new Date(2026, 5, 22, 9, 0).getTime();   // Mon 09:00 (0m? use 60m)
const b = new Date(2026, 5, 22, 20, 0).getTime();  // Mon 20:00
agg = focusWeekAggregate([
  { id: 'a', durationMs: 3600000, completedAt: a },
  { id: 'b', durationMs: 1800000, completedAt: b }
], WS);
t.ok('same day accumulates', agg.days[1].totalMs === 5400000 && agg.days[1].sessions.length === 2, agg.days[1]);
t.ok('count 2', agg.count === 2, agg.count);

/* ── buildManualFocusRecord ── */
let rec = buildManualFocusRecord({ date: '2026-06-23', startHHMM: '09:05', durationMin: 30, mode: 'pomodoro', taskId: 'x', taskText: 'T', id: 'fixed' });
t.ok('valid → record', !!rec && rec.id === 'fixed', rec);
t.ok('durationMs from minutes', rec.durationMs === 1800000, rec.durationMs);
t.ok('completedAt = start + dur', rec.completedAt === new Date(2026, 5, 23, 9, 5).getTime() + 1800000, rec.completedAt);
t.ok('source manual', rec.source === 'manual', rec.source);
t.ok('mode carried', rec.mode === 'pomodoro', rec.mode);
t.ok('bad date → null', buildManualFocusRecord({ date: 'nope', durationMin: 10 }) === null);
t.ok('zero duration → null', buildManualFocusRecord({ date: '2026-06-23', durationMin: 0 }) === null);
let rec2 = buildManualFocusRecord({ date: '2026-06-23', durationMin: 15, id: 'z' });
t.ok('missing time → 00:00', rec2 && rec2.completedAt === new Date(2026, 5, 23, 0, 0).getTime() + 900000, rec2 && rec2.completedAt);

/* ── focusYearAggregate ── 연간 잔디 히트맵 ── */
const yr = focusYearAggregate([
  { id: 'y1', durationMs: 10 * 60000, completedAt: new Date(2026, 0, 5, 9).getTime() },   // 10m → level 1
  { id: 'y2', durationMs: 40 * 60000, completedAt: new Date(2026, 0, 5, 14).getTime() },   // +40m → 50m total → level 2
  { id: 'y3', durationMs: 130 * 60000, completedAt: new Date(2026, 5, 10, 9).getTime() },  // 130m → level 4
  { id: 'yOut', durationMs: 60 * 60000, completedAt: new Date(2025, 11, 31, 9).getTime() } // prior year → excluded
], 2026, 0);
t.ok('year total excludes other years', yr.total === (10 + 40 + 130) * 60000, yr.total);
t.ok('active days = 2', yr.activeDays === 2, yr.activeDays);
t.ok('weeks are 7-tall columns', yr.weeks.every(c => c.length === 7), yr.weeks.length);
t.ok('grid spans whole year (>=52 cols)', yr.weeks.length >= 52 && yr.weeks.length <= 54, yr.weeks.length);
const allDays = yr.weeks.flat();
const jan5 = allDays.find(d => d.key === '2026-01-05');
t.ok('Jan 5 accumulates to level 2', jan5 && jan5.totalMs === 50 * 60000 && jan5.level === 2, jan5);
const jun10 = allDays.find(d => d.key === '2026-06-10');
t.ok('130m day → level 4', jun10 && jun10.level === 4, jun10);
t.ok('out-of-year cells flagged', allDays.some(d => !d.inYear), 'some padding days');
t.ok('empty log → 0 total, 0 active', (function(){ const e = focusYearAggregate([], 2026, 0); return e.total === 0 && e.activeDays === 0; })());
t.ok('_ftDayKey padded', _ftDayKey(new Date(2026, 2, 4)) === '2026-03-04', _ftDayKey(new Date(2026, 2, 4)));

t.done();
