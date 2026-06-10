'use strict';
/* gcalPlanTitleTimeDedup — cross-calendar title+start+end dedup planning
   (gcalRepairDuplicates Pass 3).
   Symptom: after fixing gcal_cfg_v1.taskCalendarId persistence (so tasks now
   correctly sync to the dedicated "할일" calendar instead of falling back to
   the "일정" calendar), tasks that were already pushed to the 일정 calendar
   under an OLD returnTaskKey got a FRESH copy created in the 할일 calendar
   under the CURRENT returnTaskKey — leaving one event per calendar with the
   same title+start+end but different (and non-matching) returnTaskKey
   values. Neither Pass 1 (per-calendar returnTaskKey grouping) nor Pass 2
   (cross-calendar returnTaskKey grouping) can pair these up, since the two
   copies don't share a returnTaskKey. "중복 진단" also missed this because it
   grouped per-calendar — each calendar individually has only ONE matching
   event.

   Fix: Pass 3 now groups by title+start+end ACROSS all configured calendars
   (not per-calendar), and gcalPlanTitleTimeDedup picks the copy in the
   task's CURRENT preferred calendar (gcalPreferredCalendarForKey) as the
   keeper, regardless of which returnTaskKey it carries.

   Tests:
   1. Cross-calendar dup, old key in 일정 / current key in 할일 → keeps the
      할일 copy (matches preferredCalId), removes the 일정 copy.
   2. Same-calendar dup, no current task (preferredKey='') → Return-owned
      event wins over an untagged one.
   3. Same-calendar dup, neither owned → most recently updated wins.
   4. Group of 1 → no plan entry. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'function gcalTaskStableKey(t){', '\nasync function gcalListAllEvents(calId){');

function makeSandbox(cfg, taskList) {
  const sb = {
    console: { error() {}, warn() {}, log() {} },
    _gcalCfg: cfg || {},
    tasks: taskList || [],
  };
  vm.createContext(sb);
  vm.runInContext(block, sb);
  return sb;
}

function ev(id, summary, start, end, calId, props, updated) {
  return {
    id, summary, _calId: calId, updated: updated || '2026-01-01T00:00:00Z',
    start: { dateTime: start }, end: { dateTime: end },
    extendedProperties: props ? { private: props } : undefined,
  };
}

const t = runner('gcalPlanTitleTimeDedup — cross-calendar title+time dedup (Pass 3)');

// ── 1. cross-calendar dup, old key (일정) vs current key (할일) ─────────────
{
  const sb = makeSandbox(
    { calendarId: 'calSchedule', taskCalendarId: 'calTask' },
    [{ id: '1', text: '미분적분학', date: '2026-06-04', catId: 'study' }]
  );
  const evOld = ev('oldid111', '미분적분학', '2026-06-04T16:00:00+09:00', '2026-06-04T17:30:00+09:00', 'calSchedule',
    { returnTaskKey: 'tt|123|1|3|16:00|17:30|미분적분학|2026-06-04', returnSyncSource: 'return' });
  const evNew = ev('newid222', '미분적분학', '2026-06-04T16:00:00+09:00', '2026-06-04T17:30:00+09:00', 'calTask',
    { returnTaskKey: '1', returnSyncSource: 'return' });
  const gk = '미분적분학|2026-06-04T16:00:00+09:00|2026-06-04T17:30:00+09:00';
  const currentKeyByGroup = { [gk]: '1' };
  const plans = sb.gcalPlanTitleTimeDedup([evOld, evNew], currentKeyByGroup);
  t.ok('one dedup plan produced', plans.length === 1, plans);
  const plan = plans[0];
  t.ok('keeps the 할일(calTask) copy', plan.keep.id === 'newid222', plan.keep && plan.keep.id);
  t.ok('removes the 일정(calSchedule) copy', plan.remove.length === 1 && plan.remove[0].id === 'oldid111', plan.remove);
}

// ── 2. same-calendar dup, no current task → Return-owned wins ──────────────
{
  const sb = makeSandbox({ calendarId: 'calSchedule', taskCalendarId: 'calTask' }, []);
  const evOwned = ev('owned1', '일화실 퀴즈 준비', '2026-03-19', '2026-03-19', 'calSchedule',
    { returnTaskKey: 'repeat:ri_1:2026-03-19', returnSyncSource: 'return' });
  const evPlain = ev('plain1', '일화실 퀴즈 준비', '2026-03-19', '2026-03-19', 'calSchedule', null);
  const plans = sb.gcalPlanTitleTimeDedup([evPlain, evOwned], {});
  t.ok('one dedup plan produced', plans.length === 1, plans);
  t.ok('keeps Return-owned event', plans[0].keep.id === 'owned1', plans[0].keep && plans[0].keep.id);
  t.ok('removes the untagged event', plans[0].remove.length === 1 && plans[0].remove[0].id === 'plain1', plans[0].remove);
}

// ── 3. same-calendar dup, neither owned → most recently updated wins ───────
{
  const sb = makeSandbox({ calendarId: 'calSchedule', taskCalendarId: 'calTask' }, []);
  const evOlder = ev('o1', '진성이랑 약속', '2026-05-20', '2026-05-20', 'calSchedule', null, '2026-01-01T00:00:00Z');
  const evNewer = ev('o2', '진성이랑 약속', '2026-05-20', '2026-05-20', 'calSchedule', null, '2026-02-01T00:00:00Z');
  const plans = sb.gcalPlanTitleTimeDedup([evOlder, evNewer], {});
  t.ok('one dedup plan produced', plans.length === 1, plans);
  t.ok('keeps most recently updated event', plans[0].keep.id === 'o2', plans[0].keep && plans[0].keep.id);
}

// ── 4. group of 1 → no plan entry ───────────────────────────────────────────
{
  const sb = makeSandbox({ calendarId: 'calSchedule', taskCalendarId: 'calTask' }, []);
  const single = ev('s1', '단일 이벤트', '2026-05-20', '2026-05-20', 'calSchedule', null);
  const plans = sb.gcalPlanTitleTimeDedup([single], {});
  t.ok('no dedup plan for singleton group', plans.length === 0, plans);
}

t.done();
