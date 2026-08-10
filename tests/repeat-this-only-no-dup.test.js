'use strict';
/* Regression test: editing a recurring task with "이 항목만 변경" (this-only) and
   changing only its CONTENT (not the date) must NOT spawn a duplicate.

   Bug: reconcileGeneratedTasks always tagged a manual (userModifiedDate) task's
   merge key with a "|manual:<date>" suffix. A content-only this-only edit keeps
   the task on its occurrence date, but the suffixed key no longer matched the
   plain expected scheduleKey, so reconcile treated the slot as empty and created
   a fresh occurrence → the original + the edited copy on the same day.

   Fix: only add the "|manual:" suffix when the task's date actually differs from
   its expected occurrence date (a real move). Content-only edits keep the plain
   scheduleKey and occupy the slot, so no regeneration. */

const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();

const suppBlock = sliceBlock(
  html,
  'function activeRuleGenerationKey(',
  '\nfunction isRepeatSuppressed('
);
const reconcileBlock = sliceBlock(
  html,
  '/* Generated task reconciliation v2.',
  '\nrepairGeneratedTasks=function('
);

const TODAY = '2026-06-20';

function dk(base, n) {
  const d = new Date(base + 'T00:00');
  d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function makeCtx(opts) {
  opts = opts || {};
  const store = {};
  const rep = opts.rep;
  const sb = {
    window: {},
    console: { error() {}, warn() {}, log() {}, debug() {} },
    Date,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    setReturnStorageItem: (k, v) => { store[k] = String(v); return true; },
    tasks: opts.tasks ? opts.tasks.slice() : [],
    TK: TODAY,
    taskTodayKeyLocal: () => TODAY,
    taskDateKeyLocal: (d) => {
      if (!d) return '';
      if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
      const dt = d instanceof Date ? d : new Date(d + 'T00:00');
      if (isNaN(dt)) return '';
      return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
    },
    taskAddDaysKey: (d, n) => dk(d, parseInt(n, 10) || 0),
    taskDateFromKey: (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + 'T00:00') : null),
    loadRepeatItems: () => (rep ? [rep] : []),
    repeatGenerationKey: (r, d) => String((r && r.id) || '') + '|' + d,
    activeRuleGenerationKey: (id, src, d) => String(id) + '|' + String(src) + '|' + d,
    loadRepeatSuppressions: () => ({}),
    loadTaskRules: () => [],
    repeatMatchesDate: (r, d) => !!r && d >= r.startDate, // daily from startDate
    repeatWeekdays: () => [],
    ruleDateInRange: () => true,
    mergeGeneratedTaskInto: (target, dup) => { if (dup && dup.done) target.done = true; },
    generatedSourceTasks: () => [],
    inferActiveRuleSourceId: null,
    saveTaskData: () => {},
  };
  const ctx = vm.createContext(sb);
  vm.runInContext(suppBlock, ctx);
  vm.runInContext(reconcileBlock, ctx);
  return ctx;
}

const r = runner('Repeat this-only edit — no duplicate');

const rep = { id: 'rep1', text: '매일 스트레칭', catId: 'health', freq: 'daily', startDate: dk(TODAY, -3) };

/* ── Test 1: content-only this-only edit → single occurrence (no dup) ── */
{
  const scheduleKey = 'repeat:rep1:' + TODAY;
  const editedTask = {
    id: 1, text: '강하게 스트레칭', catId: 'health', date: TODAY,
    sourceType: 'repeat', repeatRuleId: 'rep1', _repeatId: 'rep1',
    occurrenceDate: TODAY, _repeatOccurrence: TODAY,
    scheduleKey, generationKey: scheduleKey, _generationKey: scheduleKey,
    _occurrenceCustomized: true, userModifiedDate: true, done: false,
    createdAt: 0, updatedAt: 0,
  };
  const ctx = makeCtx({ rep, tasks: [editedTask] });
  vm.runInContext('reconcileGeneratedTasks({skipSave:true, from:"' + TODAY + '", horizon:0})', ctx);
  const onToday = ctx.tasks.filter(t => t._repeatId === 'rep1' && t.date === TODAY);
  r.ok('content-only this-only edit keeps a single occurrence', onToday.length === 1,
    'expected 1, got ' + onToday.length + ' [' + onToday.map(t => t.text).join(', ') + ']');
  r.ok('the surviving occurrence is the edited one', onToday.length === 1 && onToday[0].text === '강하게 스트레칭',
    'expected 강하게 스트레칭, got ' + (onToday[0] && onToday[0].text));
}

/* ── Test 2: an untouched occurrence still generates normally (no over-suppress) ── */
{
  const ctx = makeCtx({ rep, tasks: [] });
  vm.runInContext('reconcileGeneratedTasks({skipSave:true, from:"' + TODAY + '", horizon:0})', ctx);
  const onToday = ctx.tasks.filter(t => t._repeatId === 'rep1' && t.date === TODAY);
  r.ok('normal generation still fills the occurrence', onToday.length === 1,
    'expected 1, got ' + onToday.length);
}

r.done();
