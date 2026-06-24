'use strict';
/* W4b — widgetFocusFold: folding PC-widget focus sessions into the device-local
   timer log. Loads the real pure function out of index.html and exercises the
   dedup / field-mapping / age-prune semantics in a mocked sandbox. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'function widgetFocusFold(', 'function pullWidgetFocusSessions(');

const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(block, sandbox);
const { widgetFocusFold } = sandbox;

const t = runner('W4b — widgetFocusFold');

const DAY = 86400000;
const NOW = 1_000_000_000_000;

function sess(id, over) {
  return Object.assign({ id, mode: 'pomodoro', phase: 'work', durationMs: 1500000, taskId: '', taskText: '', completedAt: NOW }, over);
}

// 1. New session → one entry, fields mapped, source tagged, id remembered
let r = widgetFocusFold([sess('a')], [], NOW, 21);
t.ok('new → one entry', r.entries.length === 1, r.entries.length);
t.ok('entry fields mapped', r.entries[0].mode === 'pomodoro' && r.entries[0].durationMs === 1500000 && r.entries[0].completedAt === NOW);
t.ok('entry tagged source:widget', r.entries[0].source === 'widget', r.entries[0]);
t.ok('new id remembered', r.newIds.length === 1 && r.newIds[0] === 'a', r.newIds);
t.ok('fresh session not pruned', r.deleteIds.length === 0, r.deleteIds);

// 2. Already-consumed id → skipped (the core dedup that prevents re-adding a
//    session that scrolled out of the 200-cap saved log)
r = widgetFocusFold([sess('a'), sess('b')], ['a'], NOW, 21);
t.ok('consumed id skipped', r.entries.length === 1 && r.newIds[0] === 'b', r.newIds);

// 3. Same set pulled twice (consumed now includes both) → no new entries
r = widgetFocusFold([sess('a'), sess('b')], ['a', 'b'], NOW, 21);
t.ok('all consumed → idempotent no-op', r.entries.length === 0 && r.newIds.length === 0, r);

// 4. Aged-out doc → deleteIds, regardless of consumed status
r = widgetFocusFold([sess('old', { completedAt: NOW - 30 * DAY })], ['old'], NOW, 21);
t.ok('aged + consumed → delete, no entry', r.entries.length === 0 && r.deleteIds[0] === 'old', r);

// 5. Aged-out AND unseen → folded once, then marked for deletion (no data loss)
r = widgetFocusFold([sess('oldnew', { completedAt: NOW - 25 * DAY })], [], NOW, 21);
t.ok('aged + unseen → folded', r.entries.length === 1, r.entries);
t.ok('aged + unseen → also pruned', r.deleteIds[0] === 'oldnew', r.deleteIds);

// 6. Just inside the window → kept, not pruned
r = widgetFocusFold([sess('recent', { completedAt: NOW - 20 * DAY })], [], NOW, 21);
t.ok('within window not pruned', r.deleteIds.length === 0, r.deleteIds);

// 7. Defensive: doc without id skipped; missing fields default safely
r = widgetFocusFold([{ mode: 'countdown' }, sess('c', { mode: undefined, durationMs: undefined, completedAt: undefined })], [], NOW, 21);
t.ok('idless doc skipped', r.entries.length === 1 && r.newIds[0] === 'c', r.newIds);
t.ok('missing fields defaulted', r.entries[0].mode === 'pomodoro' && r.entries[0].phase === 'work' && r.entries[0].durationMs === 0, r.entries[0]);
t.ok('missing completedAt → now', r.entries[0].completedAt === NOW, r.entries[0].completedAt);

// 8. Empty / null inputs are stable
r = widgetFocusFold([], [], NOW, 21);
t.ok('empty docs → empty result', r.entries.length === 0 && r.newIds.length === 0 && r.deleteIds.length === 0);
r = widgetFocusFold(null, null, NOW, 21);
t.ok('null inputs stable', r.entries.length === 0, r);

// 9. durationMs rounded
r = widgetFocusFold([sess('d', { durationMs: 1234.7 })], [], NOW, 21);
t.ok('durationMs rounded', r.entries[0].durationMs === 1235, r.entries[0].durationMs);

t.done();
