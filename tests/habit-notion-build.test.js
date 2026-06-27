'use strict';
/* Habit status → Notion: habitNotionBuildTexts — builds the two text blobs
   (left/right) from the current habits + today's log. Loads the real function
   out of index.html and exercises the ■/□ mapping + half/half split + ordering
   in a mocked sandbox. The function reads two globals via typeof checks
   (homeRoutineQuickHabits / routineTodayLog) which we inject per case. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'function habitNotionBuildTexts(', 'function queueHabitNotionSave(');

const t = runner('habit-notion — habitNotionBuildTexts');

// Build a fresh sandbox with injected habit list + today log, then run the
// sliced function against it.
function build(habits, log) {
  const sandbox = { console, Math,
    homeRoutineQuickHabits: function(){ return habits; },
    routineTodayLog: function(){ return log || {}; },
    routineHabits: habits };
  vm.createContext(sandbox);
  vm.runInContext(block, sandbox);
  return sandbox.habitNotionBuildTexts();
}

function h(id, title){ return { id, title }; }

// 1. ■ for done, □ otherwise; "■ 이름" line format
let r = build([h('a','침대 정리'), h('b','물 마시기')], { b:{state:'done'} });
t.ok('count = 2', r.count === 2, r.count);
t.ok('not-done → □', r.left.split('\n')[0] === '□ 침대 정리', r.left);
t.ok('done → ■', r.right.split('\n')[0] === '■ 물 마시기', r.right);

// 2. Half/half split — ceil on the left (odd count → left gets the extra)
r = build([h('a','1'),h('b','2'),h('c','3'),h('d','4'),h('e','5')], {});
t.ok('odd split: left has ceil(5/2)=3', r.left.split('\n').length === 3, r.left);
t.ok('odd split: right has 2', r.right.split('\n').length === 2, r.right);
t.ok('order preserved L', r.left === '□ 1\n□ 2\n□ 3', JSON.stringify(r.left));
t.ok('order preserved R', r.right === '□ 4\n□ 5', JSON.stringify(r.right));

// 3. Even split — exactly half each (matches the 4+4 mockup)
r = build([h('a','침대 정리'),h('b','물 마시기'),h('c','아침일기 쓰기'),h('d','아침 식사 & 잡지 읽기'),
           h('e','샤워하기'),h('f','성경읽기 & 큐티하기'),h('g','저녁일기 쓰기'),h('h','책읽기')],
          { b:{state:'done'}, g:{state:'done'} });
t.ok('even split 4/4 L', r.left.split('\n').length === 4, r.left);
t.ok('even split 4/4 R', r.right.split('\n').length === 4, r.right);
t.ok('mockup line ■ 물 마시기 on left', r.left.indexOf('■ 물 마시기') >= 0, r.left);
t.ok('mockup line ■ 저녁일기 쓰기 on right', r.right.indexOf('■ 저녁일기 쓰기') >= 0, r.right);

// 4. Non-done states (skip/rest/empty) are all □ — only 'done' is checked
r = build([h('a','x'),h('b','y'),h('c','z')], { a:{state:'skip'}, b:{state:'rest'}, c:{state:''} });
t.ok('skip/rest/empty all □', r.left.indexOf('■') < 0 && r.right.indexOf('■') < 0, r);

// 5. Single habit → all on left, right empty
r = build([h('a','only')], { a:{state:'done'} });
t.ok('single → left only', r.left === '■ only', r.left);
t.ok('single → right empty', r.right === '', JSON.stringify(r.right));

// 6. Empty list → both empty, count 0
r = build([], {});
t.ok('empty → count 0', r.count === 0, r.count);
t.ok('empty → both blank', r.left === '' && r.right === '', r);

// 7. Missing/blank title coerced to empty string (no crash; checkbox + space kept)
r = build([h('a', undefined), h('b','')], {});
t.ok('blank titles safe', r.left === '□ ' && r.right === '□ ', JSON.stringify([r.left, r.right]));

t.done();
