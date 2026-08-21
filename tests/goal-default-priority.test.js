'use strict';
/* Goal default priority (프로젝트 목표별 기본 우선순위).

   A goal can carry a `defaultPriority` ('high'/'mid'/'low'). When a task is
   filed under that goal via goalAddTask(), it should inherit the goal's
   default UNLESS the user has set the task's priority explicitly
   (`_prioExplicit`). This pins:
     1. A task with no explicit priority inherits the goal default on add.
     2. A task the user pinned explicitly (_prioExplicit) keeps its own
        priority — the goal default never overrides a deliberate choice.
     3. A goal with no defaultPriority leaves the task's priority untouched.

   Slices findGoal + goalAddTask out of index.html and runs them against a
   mocked projects/tasks sandbox. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const findGoalBlock = sliceBlock(html, 'function findGoal(goalId){', '\nfunction goalOf(');
const addTaskBlock = sliceBlock(html, 'function goalAddTask(goalId,taskId){', '\nfunction goalRemoveTask(');

function makeSandbox(goalDefault) {
  const goal = { id: 'g1', title: '3장' };
  if (goalDefault !== undefined) goal.defaultPriority = goalDefault;
  const sb = {
    window: {},
    console: { error() {}, warn() {}, log() {} },
    projects: [{ id: 'p1', title: '논문', goals: [goal] }],
    tasks: [
      { id: 1, text: '일반', priority: '' },
      { id: 2, text: '개별지정', priority: 'low', _prioExplicit: true },
    ],
    saveTaskData: () => {},
    Date, String, Array,
  };
  vm.createContext(sb);
  vm.runInContext(findGoalBlock, sb);
  vm.runInContext(addTaskBlock, sb);
  return sb;
}

const t = runner('Goal default priority — inheritance on goalAddTask');

// ── 1. non-explicit task inherits the goal default ──────────────────────────
{
  const sb = makeSandbox('high');
  const ok = sb.goalAddTask('g1', 1);
  const task = sb.tasks.find((x) => x.id === 1);
  t.ok('add succeeds', ok === true);
  t.ok('task linked to goal', task.goalId === 'g1' && task.projectId === 'p1');
  t.ok('inherits high', task.priority === 'high', task.priority);
}

// ── 2. explicitly-pinned task keeps its own priority ────────────────────────
{
  const sb = makeSandbox('high');
  sb.goalAddTask('g1', 2);
  const task = sb.tasks.find((x) => x.id === 2);
  t.ok('explicit priority preserved', task.priority === 'low', task.priority);
  t.ok('still marked explicit', task._prioExplicit === true);
}

// ── 3. goal without a default leaves priority untouched ─────────────────────
{
  const sb = makeSandbox(undefined);
  sb.goalAddTask('g1', 1);
  const task = sb.tasks.find((x) => x.id === 1);
  t.ok('no default → priority stays empty', task.priority === '', JSON.stringify(task.priority));
}

t.done();
