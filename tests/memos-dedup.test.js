'use strict';
/* Memos de-duplication + stable identity — memosEnsureIds / memosKey + the shared
   returnDedupById. Regression: a memo deleted under the old (tombstone-less) sync
   kept resurrecting and copies piled up ("삭제해도 자꾸 엄청 복사"). The fix gives
   every memo a stable id so dedup/tombstones work. Loads the real functions out of
   index.html; _entityPayloadHash is stubbed deterministically (content-based). */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const ensureBlock = sliceBlock(html, 'function memosEnsureIds(', 'function memosCommit(');
const dedupBlock = sliceBlock(html, 'function returnDedupById(', 'window.returnDedupById=returnDedupById');

const sandbox = { console, String, Object, Number,
  /* deterministic stand-in for the real content hash (envelope/id excluded) */
  _entityPayloadHash: function(e){ return 'H' + JSON.stringify({t:e.text,s:e.ts,y:e.type,p:e.projectId}); } };
vm.createContext(sandbox);
vm.runInContext(ensureBlock, sandbox);
vm.runInContext(dedupBlock, sandbox);
const { memosEnsureIds, memosKey, returnDedupById } = sandbox;

const t = runner('memos — dedup + stable identity');

// 1. Legacy memo (no id/_eid) gets a deterministic, content-derived id
let a = { text: 'hi', ts: 100, type: 'memo' };
let b = { text: 'hi', ts: 100, type: 'memo' };
memosEnsureIds([a]);
memosEnsureIds([b]);
t.ok('legacy memo gets id', a.id != null && String(a.id).indexOf('h') === 0, a.id);
t.ok('same content → same id (cross-device convergence)', a.id === b.id, [a.id, b.id]);

// 2. Distinct memos (different ts) → distinct ids
let c = { text: 'hi', ts: 200, type: 'memo' };
memosEnsureIds([c]);
t.ok('different ts → different id', c.id !== a.id, [a.id, c.id]);

// 3. Existing id is kept; an _eid-only memo gets an id DERIVED from its _eid so
//    a stamped copy and an id-less copy of the same memo unify to one dedup key.
let withId = { id: 'm_99', text: 'x', ts: 1 };
let withEid = { _eid: 'memo_zzz', text: 'y', ts: 2 };
let idless = { text: 'y', ts: 2, type: undefined };
memosEnsureIds([withId, withEid]);
t.ok('memo with id untouched', withId.id === 'm_99', withId.id);
t.ok('_eid-only memo → id derived from _eid', withEid.id === 'zzz', withEid.id);
t.ok('derived id round-trips to same _eid', 'memo_' + withEid.id === withEid._eid, withEid.id);

// 4. After ensureIds, returnDedupById collapses duplicate copies of one memo
let arr = [
  { text: 'dup', ts: 500, type: 'memo' },
  { text: 'dup', ts: 500, type: 'memo' },
  { text: 'dup', ts: 500, type: 'memo' },
  { text: 'other', ts: 600, type: 'insight' },
];
memosEnsureIds(arr);
let r = returnDedupById(arr);
t.ok('3 identical copies → 1', r.removed === 2, r.removed);
t.ok('distinct memo survives', r.arr.length === 2, r.arr.map(function(x){return x.text;}));
t.ok('order preserved (dup first, other second)', r.arr[0].text === 'dup' && r.arr[1].text === 'other', r.arr.map(function(x){return x.text;}));

// 5. memosKey identifies copies for "delete all matching" in deleteMemo
let k1 = memosKey(arr[0]); // dup (now id'd)
t.ok('memosKey returns id-based key', k1 && k1.indexOf('id:') === 0, k1);
t.ok('all dup copies share one key', memosKey(arr[1]) === k1 && memosKey(arr[2]) === k1, [memosKey(arr[1]), memosKey(arr[2])]);
let filtered = arr.filter(function(m){ return memosKey(m) !== k1; });
t.ok('filter by key removes every copy', filtered.length === 1 && filtered[0].text === 'other', filtered.map(function(x){return x.text;}));

// 6. memosKey prefers id, falls back to _eid, else null
t.ok('memosKey id', memosKey({ id: 5 }) === 'id:5');
t.ok('memosKey eid', memosKey({ _eid: 'e1' }) === 'eid:e1');
t.ok('memosKey none → null', memosKey({ text: 'q' }) === null);

// 7. Stable / empty inputs
t.ok('non-array → 0', memosEnsureIds(null) === 0);
t.ok('empty dedup stable', returnDedupById([]).arr.length === 0);

t.done();
