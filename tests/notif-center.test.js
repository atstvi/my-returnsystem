'use strict';
/* 알림 센터 + 스누즈(뒤로 미루기)의 순수 로직 고정.

   - notifComputeDueAt(now, opt): 스누즈 옵션 → 다시 뜰 절대 시각(ms).
     · {min:N}      → now + N분
     · {atHHMM}     → 오늘 그 시각(이미 지났으면 내일)
     · {atHHMM,tomorrow} → 내일 그 시각
   - notifBuildFeed(state): tasks/inbox/snooze/log 상태만 받아
     지금 챙길 것(actionable) / 오늘 예정(upcoming) / 미뤄둔(snoozed) / 최근(recent)을
     계산. DOM·저장소와 무관한 순수 함수라 여기서 고정한다. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'var NOTIF_SNOOZE_OPTS = [', '\nfunction notifCurrentFeed(){');

const sb = {
  window: {}, console: { log() {}, warn() {} },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  Date, Math, JSON, String, Number, Array, Object, parseInt, isNaN,
};
vm.createContext(sb);
vm.runInContext(block, sb);

const t = runner('알림 센터 · 스누즈');

const dueAt = sb.notifComputeDueAt;
const feed = sb.notifBuildFeed;

t.ok('exposes notifComputeDueAt', typeof dueAt === 'function');
t.ok('exposes notifBuildFeed', typeof feed === 'function');

// ── notifComputeDueAt ───────────────────────────────────────────────────────
{
  const now = new Date(2026, 7, 22, 14, 0, 0).getTime(); // 2026-08-22 14:00 local
  t.ok('10분 = now+600000', dueAt(now, { min: 10 }) === now + 600000);
  t.ok('180분 = now+3h', dueAt(now, { min: 180 }) === now + 180 * 60000);
  // atHHMM in the future today (18:00 > 14:00) → today 18:00
  const eve = dueAt(now, { atHHMM: '18:00' });
  t.ok('저녁 18:00 = 오늘 18:00', new Date(eve).getHours() === 18 && new Date(eve).getDate() === 22, new Date(eve).toString());
  // atHHMM already passed today (09:00 < 14:00) → next day 09:00
  const past = dueAt(now, { atHHMM: '09:00' });
  t.ok('지난 09:00 → 내일 09:00', new Date(past).getDate() === 23 && new Date(past).getHours() === 9);
  // explicit tomorrow flag
  const tmr = dueAt(now, { atHHMM: '09:00', tomorrow: true });
  t.ok('내일 아침 플래그', new Date(tmr).getDate() === 23 && new Date(tmr).getHours() === 9);
}

// ── notifBuildFeed ──────────────────────────────────────────────────────────
{
  const now = new Date(2026, 7, 22, 14, 0, 0).getTime();
  const today = '2026-08-22';
  const state = {
    now, today,
    tasks: [
      { id: 't1', text: '지난 할일', date: today, timeStart: '10:00' },      // 과거 → overdue
      { id: 't2', text: '임박 할일', date: today, timeStart: '16:00' },      // 2h 후 → soon
      { id: 't3', text: '나중 할일', date: today, timeStart: '20:00' },      // 6h 후 → upcoming
      { id: 't4', text: '완료됨',   date: today, timeStart: '11:00', done: true }, // 제외
      { id: 't5', text: '지난 마감', deadlineDate: '2026-08-21' },           // 마감 지남 → actionable
    ],
    inbox: [{ id: 'i1', done: false, needsAction: true }, { id: 'i2', done: true, needsAction: true }],
    snooze: [
      { id: 's1', kind: 'custom', refId: 'x', title: '미룬 것(도래)', dueAt: now - 1000 },  // 도래 → actionable
      { id: 's2', kind: 'custom', refId: 'y', title: '미룬 것(미래)', dueAt: now + 3600000 }, // 미래 → snoozed
    ],
    log: [{ id: 'l1', title: '옛 알림', ts: now - 5000 }],
  };
  const f = feed(state);
  const ids = f.actionable.map((r) => r.refId);
  t.ok('overdue 할일 actionable', f.actionable.some((r) => r.kind === 'task' && r.refId === 't1' && r.overdue));
  t.ok('soon 할일 actionable', f.actionable.some((r) => r.kind === 'task' && r.refId === 't2' && r.soon));
  t.ok('나중 할일은 upcoming', f.upcoming.some((r) => r.refId === 't3') && !ids.includes('t3'));
  t.ok('완료 할일 제외', !ids.includes('t4') && !f.upcoming.some((r) => r.refId === 't4'));
  t.ok('지난 마감 actionable(kind=deadline)', f.actionable.some((r) => r.kind === 'deadline' && r.refId === 't5'));
  t.ok('인박스 needsAction 1개 요약', f.actionable.some((r) => r.kind === 'inbox' && /1/.test(r.sub)));
  t.ok('도래한 스누즈 actionable', f.actionable.some((r) => r.snoozeId === 's1'));
  t.ok('미래 스누즈는 snoozed', f.snoozed.length === 1 && f.snoozed[0].id === 's2');
  t.ok('recent = log', f.recent.length === 1 && f.recent[0].id === 'l1');
  // actionable is sorted ascending by atMs
  const ats = f.actionable.map((r) => r.atMs);
  t.ok('actionable atMs 오름차순', ats.slice().sort((a, b) => a - b).join() === ats.join());
}

// ── 미룬(스누즈) 대상은 '지금 챙길 것'에서 빠진다 (배지가 줄도록) ───────────────
{
  const now = new Date(2026, 7, 22, 14, 0, 0).getTime();
  const today = '2026-08-22';
  const state = {
    now, today,
    tasks: [
      { id: 't1', text: '지난 할일', date: today, timeStart: '10:00' },   // overdue
      { id: 't2', text: '마감 지남', deadlineDate: '2026-08-21' },        // deadline
    ],
    inbox: [{ id: 'i1', done: false, needsAction: true }],
    snooze: [
      { id: 's1', kind: 'task', refId: 't1', title: '지난 할일', dueAt: now + 3600000 }, // 미룸
      { id: 's2', kind: 'inbox', refId: 'inbox', title: '인박스', dueAt: now + 1800000 }, // 미룸
    ],
    log: [],
  };
  const f = feed(state);
  const ids = f.actionable.map((r) => r.refId);
  t.ok('미룬 할일은 actionable에서 빠짐', !ids.includes('t1'), JSON.stringify(ids));
  t.ok('미룬 인박스도 빠짐', !f.actionable.some((r) => r.kind === 'inbox'));
  t.ok('마감(안 미룸)은 남음', f.actionable.some((r) => r.refId === 't2'));
  t.ok('미룬 것은 snoozed에 있음', f.snoozed.length === 2);
  // 배지 관점: 미루기 전 3건(overdue,deadline,inbox) → 미루기 후 1건
  t.ok('actionable 1건으로 줄어듦', f.actionable.length === 1, f.actionable.length);
}

// ── empty state doesn't throw ───────────────────────────────────────────────
{
  const f = feed({});
  t.ok('빈 상태 → 빈 피드', f.actionable.length === 0 && f.upcoming.length === 0 && f.snoozed.length === 0 && f.recent.length === 0);
}

t.done();
