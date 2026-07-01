'use strict';
/* "나의 상황" 일정 연결 인식 — scheduleTargetHasLinkedTask: a schedule/일정 target
   counts as linked whether the link is stored on the prep task (forward) or on the
   schedule itself (reverse, produced when the user links from the 일정 side).
   Regression: reverse-direction links were shown as "연결 필요". Loads the real pure
   function out of index.html. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'function scheduleTargetHasLinkedTask(', 'function renderHomeSituation(');

const sandbox = { console, String, Array };
vm.createContext(sandbox);
vm.runInContext(block, sandbox);
const { scheduleTargetHasLinkedTask } = sandbox;

const t = runner('situation — schedule link recognition');

const S = { id: 100, catId: 'schedule' };            // the 일정 target
const prep = { id: 200, text: '준비', deadlineId: '100' };

// 1. Forward: a prep task points to the schedule via deadlineId
t.ok('forward deadlineId → linked', scheduleTargetHasLinkedTask(S, [S, prep]) === true);

// 2. THE BUG: reverse — the schedule itself points to a live prep task
let Srev = { id: 100, catId: 'schedule', deadlineId: '200' };
let prep2 = { id: 200, text: '준비' };
t.ok('reverse (일정→할일) → linked', scheduleTargetHasLinkedTask(Srev, [Srev, prep2]) === true);

// 3. Forward via generated-task source fields
t.ok('sourceTaskId → linked', scheduleTargetHasLinkedTask(S, [S, { id: 201, sourceTaskId: '100' }]) === true);
t.ok('_ruleSourceId → linked', scheduleTargetHasLinkedTask(S, [S, { id: 202, _ruleSourceId: '100' }]) === true);

// 4. No link at all → not linked
t.ok('no link → false', scheduleTargetHasLinkedTask(S, [S, { id: 300, deadlineId: '999' }]) === false);

// 5. Forward prep is done → not counted
t.ok('done prep → false', scheduleTargetHasLinkedTask(S, [S, { id: 200, deadlineId: '100', done: true }]) === false);

// 6. Reverse target points to a DONE task → not counted
t.ok('reverse → done target → false', scheduleTargetHasLinkedTask(Srev, [Srev, { id: 200, done: true }]) === false);

// 7. Reverse target points to a missing task → false
t.ok('reverse → missing target → false', scheduleTargetHasLinkedTask(Srev, [Srev]) === false);

// 8. _travelOnly links are ignored (both directions)
t.ok('travelOnly forward ignored', scheduleTargetHasLinkedTask(S, [S, { id: 210, deadlineId: '100', _travelOnly: true }]) === false);
t.ok('travelOnly reverse ignored', scheduleTargetHasLinkedTask(Srev, [Srev, { id: 200, _travelOnly: true }]) === false);

// 9. numeric/string id coercion
t.ok('numeric deadlineId matches string id', scheduleTargetHasLinkedTask({ id: 100 }, [{ id: 5, deadlineId: 100 }]) === true);

// 10. Defensive: null target / empty list
t.ok('null target → false', scheduleTargetHasLinkedTask(null, []) === false);
t.ok('empty list → false', scheduleTargetHasLinkedTask(S, []) === false);
t.ok('non-array list → false', scheduleTargetHasLinkedTask(S, null) === false);

t.done();
