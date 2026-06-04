'use strict';
/* Stage 6d — per-entity merge semantics (design §3 + verification matrix §7).
   Loads the real merge functions from index.html and exercises the matrix. */
const { readIndex, sliceBlock, makeStore, runner } = require('./lib');

const html = readIndex();
const block = sliceBlock(html, 'var RETURN_SYNC_CONFLICT_KEY=', 'window.returnEntityMergeArray=');

const { store, localStorage } = makeStore();
const sandbox = {
  window: {},
  console,
  localStorage,
  setReturnStorageItem: (k, v) => { store[k] = String(v); return true; },
  _entityPayloadHash: (e) => JSON.stringify(e), // stub: payload-equality only
};
const vm = require('vm');
vm.createContext(sandbox);
vm.runInContext(block, sandbox);
const { returnEntityMergeArray, returnEntityMergeObject, returnEntityLogConflicts } = sandbox;

const t = runner('Stage 6d — merge matrix');

/* single-eid array merge helper */
function D(eid, L, C, tomb) {
  const local = L ? [Object.assign({ _eid: eid }, L)] : [];
  const cloud = {}; if (C) cloud[eid] = C;
  return returnEntityMergeArray(local, cloud, tomb || {}, 'tasks');
}

// §7.4 — both live, concurrent edit → newer updatedAt wins, conflict logged
let r = D('t_1', { title: 'local', updatedAt: 200 }, { _eid: 't_1', payload: { _eid: 't_1', title: 'cloud', updatedAt: 300 }, updatedAt: 300 });
t.ok('cloud newer wins', r.merged.length === 1 && r.merged[0].title === 'cloud', r.merged);
t.ok('conflict logged (cloud)', r.conflicts.length === 1 && r.conflicts[0].winner === 'cloud', r.conflicts);
r = D('t_1', { title: 'local', updatedAt: 400 }, { _eid: 't_1', payload: { title: 'cloud', updatedAt: 300 }, updatedAt: 300 });
t.ok('local newer wins', r.merged[0].title === 'local' && r.conflicts[0].winner === 'local');
r = D('t_1', { title: 'local', updatedAt: 300 }, { _eid: 't_1', payload: { title: 'cloud', updatedAt: 300 }, updatedAt: 300 });
t.ok('tie → cloud, no conflict', r.merged[0].title === 'cloud' && r.conflicts.length === 0);

// §7.5 — A deletes (cloud tombstone), B stale → stays deleted; newer local edit survives
r = D('t_2', { title: 'stale', updatedAt: 100 }, { _eid: 't_2', deletedAt: 500, _tombstone: true });
t.ok('cloud tombstone > stale local → dropped', r.merged.length === 0, r.merged);
r = D('t_2', { title: 'fresh', updatedAt: 900 }, { _eid: 't_2', deletedAt: 500, _tombstone: true });
t.ok('newer local edit survives delete', r.merged.length === 1 && r.merged[0].title === 'fresh', r.merged);

// §7.6 — delete-vs-edit decided by timestamp both ways
r = D('t_3', null, { _eid: 't_3', payload: { title: 'cloud-edit', updatedAt: 700 }, updatedAt: 700 }, { t_3: { deletedAt: 600 } });
t.ok('edit(700) > delete(600) → survives', r.merged.length === 1 && r.merged[0].title === 'cloud-edit', r.merged);
r = D('t_3', null, { _eid: 't_3', payload: { title: 'cloud-edit', updatedAt: 500 }, updatedAt: 500 }, { t_3: { deletedAt: 600 } });
t.ok('delete(600) >= edit(500) → dropped', r.merged.length === 0, r.merged);

// §7.3 / R3 — cloud-only adopt, but suppressed by newer local tombstone
r = returnEntityMergeArray([], { t_9: { _eid: 't_9', payload: { title: 'remote-new', updatedAt: 50 }, updatedAt: 50 } }, {}, 'tasks');
t.ok('cloud-only adopted', r.merged.length === 1 && r.merged[0].title === 'remote-new');
r = returnEntityMergeArray([], { t_9: { _eid: 't_9', payload: { title: 'remote-new', updatedAt: 50 }, updatedAt: 50 } }, { t_9: { deletedAt: 80 } }, 'tasks');
t.ok('cloud-only suppressed by newer local tombstone (R3)', r.merged.length === 0, r.merged);

// local-only kept; eid-less passthrough; order preserved
r = returnEntityMergeArray([{ _eid: 't_a', title: 'A', updatedAt: 1 }, { title: 'noeid' }, { _eid: 't_b', title: 'B', updatedAt: 1 }], {}, {}, 'tasks');
t.ok('local-only + eid-less passthrough + order', r.merged.length === 3 && r.merged[0].title === 'A' && r.merged[1].title === 'noeid' && r.merged[2].title === 'B', r.merged.map((x) => x.title));

// §7.8 — diary per-date merge
let dr = returnEntityMergeObject(
  { '2026-01-01': { _eid: 'diary_2026-01-01', text: 'local', updatedAt: 100 } },
  { 'diary_2026-01-01': { _eid: 'diary_2026-01-01', payload: { _eid: 'diary_2026-01-01', text: 'cloud', updatedAt: 200 }, updatedAt: 200 },
    'diary_2026-01-02': { _eid: 'diary_2026-01-02', payload: { _eid: 'diary_2026-01-02', text: 'new-day', updatedAt: 10 }, updatedAt: 10 } },
  {}, 'diary', 'diary_');
t.ok('diary same-date LWW (cloud newer)', dr.merged['2026-01-01'].text === 'cloud', dr.merged['2026-01-01']);
t.ok('diary new cloud date adopted', dr.merged['2026-01-02'] && dr.merged['2026-01-02'].text === 'new-day', Object.keys(dr.merged));
dr = returnEntityMergeObject({ '2026-01-03': { _eid: 'diary_2026-01-03', text: 'old', updatedAt: 100 } }, {}, { 'diary_2026-01-03': { deletedAt: 200 } }, 'diary', 'diary_');
t.ok('diary date suppressed by tombstone', !dr.merged['2026-01-03'], dr.merged);

// §7.8 extension — legacy diary entries lacking _eid use prefix+dateKey fallback
// (mirrors the `e._eid || (prefix+dk)` path in returnEntityMergeObject)
dr = returnEntityMergeObject(
  { '2026-02-01': { text: 'no-eid-local', updatedAt: 50 } },   // no _eid
  { 'diary_2026-02-01': { _eid: 'diary_2026-02-01', payload: { text: 'cloud', updatedAt: 200 }, updatedAt: 200 } },
  {}, 'diary', 'diary_');
t.ok('legacy diary (no _eid) matched via prefix+dateKey — no inflation', Object.keys(dr.merged).length === 1, Object.keys(dr.merged));
t.ok('legacy diary (no _eid): cloud newer wins LWW', dr.merged['2026-02-01'] && dr.merged['2026-02-01'].text === 'cloud', dr.merged['2026-02-01']);

// local-only diary entry (no cloud counterpart) kept as-is
dr = returnEntityMergeObject(
  { '2026-02-02': { text: 'local-only', updatedAt: 100 } },
  {}, {}, 'diary', 'diary_');
t.ok('local-only diary entry (no _eid) preserved', dr.merged['2026-02-02'] && dr.merged['2026-02-02'].text === 'local-only', dr.merged);

// conflict ring buffer cap 50
const big = []; for (let i = 0; i < 60; i++) big.push({ collection: 'tasks', _eid: 'x' + i });
returnEntityLogConflicts(big);
const buf = JSON.parse(store['__sync_conflicts_v1']);
t.ok('conflict buffer capped at 50', buf.length === 50 && buf[49]._eid === 'x59', buf.length);

t.ok('empty merge stable', returnEntityMergeArray([], {}, {}, 'x').merged.length === 0);

// adoption flood guard — cap fires when cloud has >> local items
(function(){
  var localArr = [];
  for(var i=0;i<10;i++) localArr.push({_eid:'local_'+i,title:'local '+i,updatedAt:1});
  // cap = max(10*3+100, 200) = 200; add 300 cloud-only docs → should cap at 200
  var cloudByEid = {};
  for(var j=0;j<300;j++){
    var eid='cloud_'+j;
    cloudByEid[eid]={_eid:eid,payload:{title:'cloud '+j,updatedAt:2},updatedAt:2};
  }
  var r2 = returnEntityMergeArray(localArr, cloudByEid, {}, 'memos');
  t.ok('adoption flood: aborted flag set', r2.adoptionFloodAborted === true, r2.adoptionFloodAborted);
  t.ok('adoption flood: adopted exactly cap (200)', r2.merged.length === 10+200, r2.merged.length);
})();

// no false positive — small cloud-only set (within cap) must not abort
(function(){
  var local2 = [{_eid:'x_1',updatedAt:1}];
  var cloud2 = {x_2:{_eid:'x_2',payload:{updatedAt:2},updatedAt:2},x_3:{_eid:'x_3',payload:{updatedAt:2},updatedAt:2}};
  var r3 = returnEntityMergeArray(local2, cloud2, {}, 'tasks');
  t.ok('no false positive: small adoption not aborted', r3.adoptionFloodAborted === false || r3.adoptionFloodAborted === undefined, r3.adoptionFloodAborted);
  t.ok('no false positive: all cloud-only adopted', r3.merged.length === 3, r3.merged.length);
})();

t.done();
