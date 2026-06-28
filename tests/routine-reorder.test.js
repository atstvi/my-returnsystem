'use strict';
/* Routine bundle reordering — routineSortedBundles / routineMoveBundle: move a
   whole routine up/down, persisted via an `order` field (so it syncs across
   devices). Loads the real functions out of index.html and exercises ordering +
   move semantics in a mocked sandbox. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'function routineSortedBundles(', 'function homeRoutineQuickHabits(');

const t = runner('routine — bundle reorder');

function mk(bundles) {
  const sandbox = { console, String, Number, Math,
    routineBundles: bundles,
    saveRoutineData: function(){ sandbox._saved = (sandbox._saved||0)+1; return true; },
    renderRoutine: function(){} };
  vm.createContext(sandbox);
  vm.runInContext(block, sandbox);
  return sandbox;
}
const ids = (arr) => arr.map(b => b.id);

// 1. No order field → keeps current array order
let s = mk([{id:'a'},{id:'b'},{id:'c'}]);
t.ok('unordered → array order', ids(s.routineSortedBundles()).join() === 'a,b,c', ids(s.routineSortedBundles()));

// 2. order field drives the sequence
s = mk([{id:'a',order:2},{id:'b',order:0},{id:'c',order:1}]);
t.ok('sorted by order', ids(s.routineSortedBundles()).join() === 'b,c,a', ids(s.routineSortedBundles()));

// 3. Move down: b (idx1) → idx2
s = mk([{id:'a'},{id:'b'},{id:'c'}]);
s.routineMoveBundle('b', 1);
t.ok('move down swaps with next', ids(s.routineSortedBundles()).join() === 'a,c,b', ids(s.routineSortedBundles()));
t.ok('saveRoutineData called', s._saved === 1, s._saved);

// 4. Now order is a,c,b. Move c up → swaps with a → c,a,b
s.routineMoveBundle('c', -1);
t.ok('move up swaps with prev', ids(s.routineSortedBundles()).join() === 'c,a,b', ids(s.routineSortedBundles()));

// 5. order fields persisted (numeric, contiguous after canonicalize)
let ordered = s.routineSortedBundles().map(b => b.order);
t.ok('order fields assigned', ordered.every(o => typeof o === 'number'), ordered);

// 6. Move up at top → no-op
s = mk([{id:'a'},{id:'b'}]);
s.routineMoveBundle('a', -1);
t.ok('top move-up is no-op', ids(s.routineSortedBundles()).join() === 'a,b', ids(s.routineSortedBundles()));

// 7. Move down at bottom → no-op
s.routineMoveBundle('b', 1);
t.ok('bottom move-down is no-op', ids(s.routineSortedBundles()).join() === 'a,b', ids(s.routineSortedBundles()));

// 8. Unknown id → no-op, no throw
s = mk([{id:'a'},{id:'b'}]);
s.routineMoveBundle('zzz', 1);
t.ok('unknown id no-op', ids(s.routineSortedBundles()).join() === 'a,b', ids(s.routineSortedBundles()));

// 9. Stable sort: equal/none order keeps insertion order
s = mk([{id:'x'},{id:'y'},{id:'z'}]);
t.ok('stable for ties', ids(s.routineSortedBundles()).join() === 'x,y,z', ids(s.routineSortedBundles()));

t.done();
