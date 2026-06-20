'use strict';
/* Regression test: deleted active-rule tasks must not be resurrected when a
   stale Firebase sync re-injects them into tasks[].

   Bug: expectedForExistingGenerated() fallback (rule lookup path) bypassed the
   suppression check in buildExpectedGeneratedMap. A suppressed-but-stale task
   that arrived via cross-device Firebase sync was kept by reconcileGeneratedTasks
   instead of being dropped.

   Fix: reconcileGeneratedTasks now loads genSuppressions and re-checks
   suppression after expectedForExistingGenerated's fallback returns non-null. */

const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();

// Suppression storage + key functions (includes loadGeneratedTaskSuppressions,
// saveGeneratedTaskSuppressions, generatedTaskKey original, suppressGeneratedTask,
// noteGeneratedTaskDeleted)
const suppBlock = sliceBlock(
  html,
  'function activeRuleGenerationKey(',
  '\nfunction isRepeatSuppressed('
);

// reconcile v2 block
const reconcileBlock = sliceBlock(
  html,
  '/* Generated task reconciliation v2.',
  '\nrepairGeneratedTasks=function('
);

const TODAY = '2026-06-20'; // Saturday

function makeCtx(opts) {
  opts = opts || {};
  const store = {};
  const rules = opts.rules || [];
  const suppressions = opts.suppressions || {};

  if (Object.keys(suppressions).length) {
    store['generated_task_suppressions_v1'] = JSON.stringify(suppressions);
  }

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
      return dt.getFullYear() + '-' +
        String(dt.getMonth() + 1).padStart(2, '0') + '-' +
        String(dt.getDate()).padStart(2, '0');
    },
    taskAddDaysKey: (dk, n) => {
      const d = new Date(dk + 'T00:00');
      d.setDate(d.getDate() + (parseInt(n, 10) || 0));
      return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
    },
    taskDateFromKey: (dk) => {
      if (!dk || !/^\d{4}-\d{2}-\d{2}$/.test(dk)) return null;
      return new Date(dk + 'T00:00');
    },
    loadTaskRules: () => rules,
    loadRepeatItems: () => [],
    loadRepeatSuppressions: () => ({}),
    repeatMatchesDate: () => false,
    repeatWeekdays: (rep) => String((rep && rep.weekdays) || '')
      .split(/[, ]+/).filter(Boolean)
      .map(x => parseInt(x, 10)).filter(n => n >= 0 && n <= 6),
    ruleDateInRange: (rule, dk) => {
      if (rule.startDate && dk < rule.startDate) return false;
      if (rule.endDate && dk > rule.endDate) return false;
      return true;
    },
    buildRepeatExpected: () => null,
    isRepeatSourceTask: () => false,
    generatedSourceTasks: () => [],
    inferActiveRuleSourceId: null,
    mergeGeneratedTaskInto: () => {},
    returnNewId: (pfx) => pfx + Date.now(),
    saveTaskData: () => {},
    repairGeneratedTasks: () => {},
  };

  const ctx = vm.createContext(sb);
  vm.runInContext(suppBlock, ctx);
  vm.runInContext(reconcileBlock, ctx);
  return ctx;
}

const r = runner('Active rule task suppression — stale sync resurrection fix');

/* ── Test 1: suppressed task dropped when stale sync re-injects it ── */
{
  const rule = {
    id: 'rule1', triggerType: 'weekday', weekdays: '6', // Saturday only
    taskText: 'Test task', taskCatId: 'etc', taskPriority: '',
    offsetDays: 0, startDate: '2026-06-20', endDate: '2026-06-20' // only today
  };
  const scheduleKey = 'rule:rule1:weekday:2026-06-20:2026-06-20';
  const staleTask = {
    id: 99, text: 'Test task', _ruleGen: true, _ruleId: 'rule1',
    activeRuleId: 'rule1', sourceType: 'activeRule',
    sourceTaskId: 'weekday:2026-06-20', occurrenceDate: '2026-06-20',
    date: '2026-06-20', scheduleKey, catId: 'etc', done: false,
    createdAt: 0, updatedAt: 0
  };

  const ctx = makeCtx({
    rules: [rule],
    tasks: [staleTask],
    suppressions: { [scheduleKey]: { reason: 'deleted', at: Date.now() } }
  });

  vm.runInContext('reconcileGeneratedTasks({skipSave:true})', ctx);

  // The suppressed task (id:99) must be gone; rule's endDate prevents any regeneration
  const remaining = ctx.tasks.filter(t => t._ruleId === 'rule1');
  r.ok('stale suppressed task dropped after reconcile', remaining.length === 0,
    'expected 0, got ' + remaining.length);
}

/* ── Test 2: old-format (pipe) suppression key prevents regeneration ── */
{
  const rule = {
    id: 'rule2', triggerType: 'weekday', weekdays: '6',
    taskText: 'Old task', taskCatId: 'etc', taskPriority: '',
    offsetDays: 0, startDate: '2026-06-20', endDate: ''
  };
  // Old format: "ruleId|weekday:dueDate|dueDate"
  const oldKey = 'rule2|weekday:2026-06-20|2026-06-20';

  const ctx = makeCtx({
    rules: [rule],
    tasks: [],
    suppressions: { [oldKey]: { reason: 'deleted', at: Date.now() } }
  });

  vm.runInContext('reconcileGeneratedTasks({skipSave:true, from:"2026-06-20", horizon:1})', ctx);

  const generated = ctx.tasks.filter(t => t._ruleId === 'rule2');
  r.ok('old-format pipe suppression prevents regeneration', generated.length === 0,
    'expected 0, got ' + generated.length);
}

/* ── Test 3: non-suppressed task is kept (no duplicate for today) ── */
{
  const rule = {
    id: 'rule3', triggerType: 'weekday', weekdays: '6',
    taskText: 'Active task', taskCatId: 'etc', taskPriority: '',
    offsetDays: 0, startDate: '2026-06-20', endDate: '2026-06-20' // today only
  };
  const scheduleKey = 'rule:rule3:weekday:2026-06-20:2026-06-20';
  const task = {
    id: 100, text: 'Active task', _ruleGen: true, _ruleId: 'rule3',
    activeRuleId: 'rule3', sourceType: 'activeRule',
    sourceTaskId: 'weekday:2026-06-20', occurrenceDate: '2026-06-20',
    date: '2026-06-20', scheduleKey, catId: 'etc', done: false,
    createdAt: 0, updatedAt: 0
  };

  const ctx = makeCtx({ rules: [rule], tasks: [task], suppressions: {} });
  vm.runInContext('reconcileGeneratedTasks({skipSave:true})', ctx);

  const kept = ctx.tasks.filter(t => t._ruleId === 'rule3');
  r.ok('non-suppressed task is kept (exactly 1, no duplicate)', kept.length === 1,
    'expected 1, got ' + kept.length);
}

/* ── Test 4: manually-moved task (userModifiedDate) is always preserved ── */
{
  // A task with userModifiedDate is treated as manually modified →
  // it should be kept even if not in expected (isGeneratedManual returns true)
  // Verifies the suppression check doesn't accidentally drop manually-moved tasks
  const rule = {
    id: 'rule4', triggerType: 'weekday', weekdays: '6',
    taskText: 'Manual task', taskCatId: 'etc', taskPriority: '',
    offsetDays: 0, startDate: '2026-06-20', endDate: '2026-06-20'
  };
  const scheduleKey = 'rule:rule4:weekday:2026-06-20:2026-06-20';
  const manualTask = {
    id: 101, text: 'Manual task', _ruleGen: true, _ruleId: 'rule4',
    activeRuleId: 'rule4', sourceType: 'activeRule',
    sourceTaskId: 'weekday:2026-06-20', occurrenceDate: '2026-06-20',
    date: '2026-06-21', // user moved to a different date
    scheduleKey, catId: 'etc', done: false, userModifiedDate: true,
    createdAt: 0, updatedAt: 0
  };

  const ctx = makeCtx({
    rules: [rule],
    tasks: [manualTask],
    suppressions: {} // no suppression — only userModifiedDate flag keeps it
  });
  vm.runInContext('reconcileGeneratedTasks({skipSave:true})', ctx);

  const byId = ctx.tasks.filter(t => t.id === 101);
  r.ok('manually-moved task preserved (userModifiedDate exemption)', byId.length === 1,
    'expected 1, got ' + byId.length);
}

r.done();
