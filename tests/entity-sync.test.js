'use strict';
/* Stage 6c — per-entity dual-write + idempotent migration against a mock
   Firestore. Proves the mirror format is writable with no data delta. */
const { readIndex, sliceBlock, makeStore, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'var RETURN_ENTITY_DUALWRITE=', 'function fbSanitizeNotionCfg(cfg){');

const { store, localStorage } = makeStore();

/* mock Firestore: flat path -> doc map */
const fsStore = {};
function makeBatch() {
  const pending = [];
  return {
    set: (docRef, data, opts) => pending.push({ path: docRef.__path, data, merge: opts && opts.merge }),
    commit: async () => { pending.forEach((p) => { if (p.merge && fsStore[p.path]) Object.assign(fsStore[p.path], p.data); else fsStore[p.path] = JSON.parse(JSON.stringify(p.data)); }); pending.length = 0; },
  };
}
function docRef(p) {
  return {
    __path: p,
    collection: (c) => colRef(p + '/' + c),
    get: async () => ({ exists: p in fsStore, data: () => fsStore[p] }),
    set: async (data, opts) => { if (opts && opts.merge && fsStore[p]) Object.assign(fsStore[p], data); else fsStore[p] = JSON.parse(JSON.stringify(data)); },
  };
}
function colRef(p) {
  return {
    __path: p,
    doc: (id) => docRef(p + '/' + id),
    get: async () => { const pre = p + '/'; const docs = Object.keys(fsStore).filter((k) => k.startsWith(pre) && k.slice(pre.length).indexOf('/') < 0).map((k) => ({ id: k.slice(pre.length), data: () => fsStore[k] })); return { forEach: (cb) => docs.forEach(cb), size: docs.length }; },
  };
}

let idc = 0;
const sandbox = {
  window: {}, console, localStorage,
  returnNewId: (p) => p + 'gen' + (++idc),
  RETURN_SCHEMA_VERSION: 1,
  FB_CLIENT_ID: 'clientA',
  setReturnStorageItem: (k, v) => { store[k] = String(v); return true; },
  tombstonesLoad: () => sandbox._tomb,
  _tomb: {},
  fbDb: { batch: makeBatch, collection: (c) => colRef(c) },
  fbUser: { uid: 'u1' },
  /* deterministic stand-in for the module-level _entityPayloadHash (defined
     outside this slice). Hashes content with envelope fields excluded. */
  _entityPayloadHash: (e) => {
    const env = ['_eid', 'updatedAt', 'createdAt', 'deletedAt', 'schemaVersion', '_rev', 'modifiedBy'];
    const c = {}; Object.keys(e || {}).forEach((k) => { if (env.indexOf(k) < 0) c[k] = e[k]; });
    const s = JSON.stringify(c); let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return 'H' + s.length + '_' + h;
  },
};
vm.createContext(sandbox);
vm.runInContext(block, sandbox);
const { fbEntityMigrateIfNeeded, fbEntityWriteChanged, fbEntityReadCounts, fbEntityBuildDocs, RETURN_ENTITY_COLLECTIONS, RETURN_ENTITY_DUALWRITE, _entitySafeSet } = sandbox;

const ref = docRef('users/u1');
function countEntityDocs() {
  const r = {};
  Object.keys(fsStore).forEach((k) => {
    const m = k.match(/^users\/u1\/entities\/([^/]+)\/items\/(.+)$/);
    if (m) { r[m[1]] = r[m[1]] || { live: 0, tomb: 0 }; if (fsStore[k]._tombstone || fsStore[k].deletedAt) r[m[1]].tomb++; else r[m[1]].live++; }
  });
  return r;
}

const t = runner('Stage 6c — entity dual-write + migration');

(async () => {
  store['task_items_v1'] = JSON.stringify([{ id: 1, _eid: 't_1', title: 'A', updatedAt: 100 }, { id: 2, _eid: 't_2', title: 'B', updatedAt: 100 }]);
  store['projects_v1'] = JSON.stringify([{ id: 9, _eid: 'p_9', name: 'Proj', updatedAt: 50 }]);
  store['diary_entries_v1'] = JSON.stringify({ '2026-01-01': { _eid: 'diary_2026-01-01', text: 'hi', updatedAt: 70 } });

  let mig = await fbEntityMigrateIfNeeded(ref);
  t.ok('migration runs first time', mig.migrated === true, mig);
  let c = countEntityDocs();
  t.ok('tasks mirrored (2)', c.tasks && c.tasks.live === 2, c.tasks);
  t.ok('projects mirrored (1)', c.projects && c.projects.live === 1, c.projects);
  t.ok('diary mirrored (1)', c.diary && c.diary.live === 1, c.diary);
  t.ok('meta/sync marker set', fsStore['users/u1/meta/sync'].syncModel === 'entity-v1');

  const before = Object.keys(fsStore).length;
  mig = await fbEntityMigrateIfNeeded(ref);
  t.ok('migration idempotent', mig.migrated === false && mig.already === true, mig);
  t.ok('no data delta after re-migrate', Object.keys(fsStore).length === before);

  let ew = await fbEntityWriteChanged(ref);
  t.ok('unchanged dual-write writes 0', ew.written === 0 && ew.tombstoned === 0, ew);

  store['task_items_v1'] = JSON.stringify([{ id: 1, _eid: 't_1', title: 'A2', updatedAt: 200 }, { id: 2, _eid: 't_2', title: 'B', updatedAt: 100 }]);
  ew = await fbEntityWriteChanged(ref);
  t.ok('edit writes exactly 1 entity', ew.written === 1, ew);
  t.ok('edited payload mirrored', fsStore['users/u1/entities/tasks/items/t_1'].payload.title === 'A2');

  sandbox._tomb['t_2'] = { deletedAt: 300, collection: 'tasks' };
  store['task_items_v1'] = JSON.stringify([{ id: 1, _eid: 't_1', title: 'A2', updatedAt: 200 }]);
  ew = await fbEntityWriteChanged(ref);
  t.ok('delete writes 1 tombstone', ew.tombstoned === 1, ew);
  t.ok('tombstone carries registry deletedAt', fsStore['users/u1/entities/tasks/items/t_2'].deletedAt === 300);
  c = countEntityDocs();
  t.ok('tasks 1 live + 1 tomb', c.tasks.live === 1 && c.tasks.tomb === 1, c.tasks);

  const rep = await fbEntityReadCounts(ref);
  t.ok('readCounts match mirror', rep.tasks.live === 1 && rep.tasks.tombs === 1 && rep.projects.live === 1, rep);

  // Regression (static source check): the console helper window.fbEntityReadAll
  // must NOT share its name with the implementation, or — because a top-level
  // `function fbEntityReadAll` becomes a global === window.fbEntityReadAll — the
  // wrapper would overwrite the impl and then call ITSELF (infinite recursion,
  // "Maximum call stack size exceeded"). The vm sandbox can't model the
  // global/window aliasing, so we assert the source shape directly.
  t.ok('no top-level `function fbEntityReadAll` declaration (collision)', !/\bfunction\s+fbEntityReadAll\s*\(/.test(html), 'found a colliding declaration');
  t.ok('window.fbEntityReadAll delegates to fbEntityReadCounts (not itself)', /window\.fbEntityReadAll\s*=\s*function[\s\S]{0,200}fbEntityReadCounts\s*\(/.test(html));

  store['inbox_v1'] = JSON.stringify([{ id: 'abc', text: 'x' }]);
  const docs = fbEntityBuildDocs(RETURN_ENTITY_COLLECTIONS.find((s) => s.collection === 'inbox'));
  t.ok('missing _eid derived deterministically (ib_abc)', 'ib_abc' in docs, Object.keys(docs));

  t.ok('dual-write flag default true', RETURN_ENTITY_DUALWRITE === true);
  const shadowKeys = Object.keys(store).filter((k) => k.startsWith('__entity_wshadow_'));
  t.ok('write-shadow keys non-synced-prefixed', shadowKeys.length >= 3 && shadowKeys.every((k) => k.startsWith('__entity_')), shadowKeys);

  // ── resilience: a poison/oversized doc must not abort the whole write ──
  // _entitySafeSet covers all three skip reasons.
  let sk = [];
  t.ok('safeSet: set-throw → set-failed (the stack-overflow case)',
    _entitySafeSet({ set: () => { throw new RangeError('Maximum call stack size exceeded'); } }, {}, { a: 1 }, 'e1', 'tasks', sk) === false && sk[0].reason === 'set-failed', sk);
  sk = [];
  t.ok('safeSet: oversized → too-large',
    _entitySafeSet({ set: () => {} }, {}, { big: 'x'.repeat(950000) }, 'e2', 'tasks', sk) === false && sk[0].reason === 'too-large', sk);
  sk = [];
  t.ok('safeSet: normal doc queued', _entitySafeSet({ set: () => {} }, {}, { ok: 1 }, 'e3', 'tasks', sk) === true && sk.length === 0);

  // integration: an oversized entity is skipped, the migration still completes,
  // and the legacy store still holds it (no data loss).
  store['memos_v5'] = JSON.stringify([
    { id: 'ok1', _eid: 'memo_ok1', text: 'small', updatedAt: 111 },
    { id: 'big', _eid: 'memo_big', text: 'Z'.repeat(950000), updatedAt: 222 },
  ]);
  ew = await fbEntityWriteChanged(ref);
  t.ok('oversized entity skipped (≥1)', ew.skipped >= 1, ew);
  t.ok('good sibling still mirrored', 'users/u1/entities/memos/items/memo_ok1' in fsStore);
  t.ok('oversized doc NOT in mirror', !('users/u1/entities/memos/items/memo_big' in fsStore));
  t.ok('skip recorded to log', sandbox.window.returnEntityMigrateSkips().some((s) => s._eid === 'memo_big' && s.reason === 'too-large'));
  t.ok('legacy store still holds the skipped entity (no data loss)', JSON.parse(store['memos_v5']).some((m) => m._eid === 'memo_big'));
  // skipped doc omitted from shadow → retried next save (not silently dropped)
  t.ok('skipped eid not in write-shadow', !(JSON.parse(store['__entity_wshadow_memos'] || '{}').memo_big));

  // ════════════════════════════════════════════════════════════════════════
  // Regression: id-less items (legacy memos {text,ts}) must NOT churn.
  // fbEntityBuildDocs used to mint a FRESH returnNewId() for every such item on
  // every call, so each save re-wrote them all + tombstoned the prior cycle's
  // random ids → unbounded write amplification that exhausted the Firestore
  // write quota. Now their id is derived deterministically from the payload.
  // ════════════════════════════════════════════════════════════════════════
  const memoSpec = RETURN_ENTITY_COLLECTIONS.find((s) => s.collection === 'memos');

  // 1) deterministic across calls: same input → identical id set, no randomness.
  store['memos_v5'] = JSON.stringify([{ text: 'alpha', ts: 1 }, { text: 'beta', ts: 2 }]);
  const d1 = Object.keys(fbEntityBuildDocs(memoSpec)).sort();
  const d2 = Object.keys(fbEntityBuildDocs(memoSpec)).sort();
  t.ok('id-less build is deterministic across calls', JSON.stringify(d1) === JSON.stringify(d2) && d1.length === 2, { d1, d2 });
  t.ok('id-less ids are content-derived (memo_h*), not random gen', d1.every((k) => /^memo_h/.test(k)), d1);

  // 2) the actual churn regression: write twice, second pass must write 0 / tomb 0.
  //    (fresh fsStore region: clear memo mirror + shadow first)
  Object.keys(fsStore).forEach((k) => { if (k.indexOf('/entities/memos/') >= 0) delete fsStore[k]; });
  delete store['__entity_wshadow_memos'];
  const firstMemo = await fbEntityWriteChanged(ref);
  const memoWroteFirst = firstMemo.written;
  const secondMemo = await fbEntityWriteChanged(ref);
  t.ok('first memo pass mirrors the 2 id-less items', memoWroteFirst >= 2, firstMemo);
  t.ok('second memo pass writes 0 (NO churn — the quota-burn bug)', secondMemo.written === 0 && secondMemo.tombstoned === 0, secondMemo);

  // 3) duplicate identical payloads do not collide (deterministic __dup suffix).
  store['memos_v5'] = JSON.stringify([{ text: 'same', ts: 9 }, { text: 'same', ts: 9 }]);
  const dupDocs = fbEntityBuildDocs(memoSpec);
  t.ok('identical-payload memos get 2 distinct doc ids', Object.keys(dupDocs).length === 2, Object.keys(dupDocs));
  t.ok('duplicate disambiguated with __dup suffix', Object.keys(dupDocs).some((k) => /__dup\d+$/.test(k)), Object.keys(dupDocs));

  // 4) circuit breaker: a non-migration pass that would write a huge number of
  //    docs aborts to protect the quota (and records it — never silent).
  const many = []; for (let i = 0; i < 800; i++) many.push({ text: 'm' + i, ts: i });
  store['memos_v5'] = JSON.stringify(many);
  Object.keys(fsStore).forEach((k) => { if (k.indexOf('/entities/memos/') >= 0) delete fsStore[k]; });
  delete store['__entity_wshadow_memos'];
  const breaker = await fbEntityWriteChanged(ref);
  t.ok('circuit breaker trips on oversized steady-state pass', breaker.aborted === true, breaker);
  t.ok('breaker caps ops near the configured budget', (breaker.written + breaker.tombstoned) <= 620, breaker);
  t.ok('breaker trip recorded to skip log (not silent)', sandbox.window.returnEntityMigrateSkips().some((s) => s.reason === 'circuit-breaker'));

  // 5) static source check: the random-id mint is gone from build-docs.
  t.ok('fbEntityBuildDocs no longer mints returnNewId() inline',
    !/function fbEntityBuildDocs[\s\S]*?returnNewId\(/.test(html.slice(html.indexOf('function fbEntityBuildDocs'), html.indexOf('function fbEntityBuildDocs') + 1200)));

  // ════════════════════════════════════════════════════════════════════════
  // Regression: fbEntityMergeIntoLocal must NOT inflate array collections
  // when local items have id but no _eid.
  //
  // Root cause: returnEntityMergeArray passthroughs items without _eid
  // instead of matching them against cloud docs. Without the pre-merge
  // _eid stamp, a 36-memo array + 36-doc cloud mirror → 72 merged items.
  // Fix: fbEntityMergeIntoLocal stamps _eids (using same derivation as
  // fbEntityBuildDocs) before calling returnEntityMergeArray.
  // ════════════════════════════════════════════════════════════════════════
  {
    // Set up: 3 local memos without _eid (id-bearing + id-less)
    // Local has higher updatedAt so local wins LWW → returned item retains
    // the stamped _eid (cloud payload would strip envelope fields including _eid)
    const mergeLocalMemos = [
      { id: 1001, text: 'memo A', ts: 100, updatedAt: 500 },
      { id: 1002, text: 'memo B', ts: 200, updatedAt: 500 },
      { text: 'memo C (no id)', ts: 300, updatedAt: 500 },
    ];
    store['memos_v5'] = JSON.stringify(mergeLocalMemos);

    // Set up matching cloud entity mirror docs (same 3 memos, older updatedAt)
    const memoH = (it) => {
      const env = ['_eid','updatedAt','createdAt','deletedAt','schemaVersion','_rev','modifiedBy'];
      const c = {}; Object.keys(it).forEach((k) => { if(env.indexOf(k)<0) c[k]=it[k]; });
      const s = JSON.stringify(c); let h = 7; for (let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0;
      return 'H'+s.length+'_'+h;
    };
    // Clear memo mirror region and write matching cloud docs
    Object.keys(fsStore).forEach((k) => { if (k.indexOf('/entities/memos/') >= 0) delete fsStore[k]; });
    delete store['__entity_wshadow_memos'];
    fsStore['users/u1/entities/memos/items/memo_1001'] = { _eid:'memo_1001', collection:'memos', payload:{id:1001,text:'memo A',ts:100,updatedAt:100}, updatedAt:100 };
    fsStore['users/u1/entities/memos/items/memo_1002'] = { _eid:'memo_1002', collection:'memos', payload:{id:1002,text:'memo B',ts:200,updatedAt:200}, updatedAt:200 };
    const hC = 'memo_h' + memoH({ text:'memo C (no id)', ts:300 });
    fsStore['users/u1/entities/memos/items/'+hC] = { _eid:hC, collection:'memos', payload:{text:'memo C (no id)',ts:300,updatedAt:300}, updatedAt:300 };

    // Wire up remaining stubs fbEntityMergeIntoLocal needs
    sandbox.RETURN_SYNC_MODEL = 'entity';
    sandbox._rawSetItem = (k, v) => { store[k] = String(v); };
    sandbox._applyingFbData = false;

    const { fbEntityMergeIntoLocal } = sandbox;
    const mr = await fbEntityMergeIntoLocal(ref);

    const afterMerge = JSON.parse(store['memos_v5'] || '[]');
    t.ok('_eid stamp: no inflation — merged count === local count (3)', afterMerge.length === 3, afterMerge.length);
    t.ok('_eid stamp: id-bearing item got _eid assigned', afterMerge.some((m) => m.id === 1001 && m._eid === 'memo_1001'), afterMerge.map((m)=>m._eid));
    t.ok('_eid stamp: id-less item got hash _eid assigned', afterMerge.some((m) => m.text === 'memo C (no id)' && m._eid === hC), afterMerge.map((m)=>m._eid));
    t.ok('_eid stamp: memos key in changedKeys', mr.changedKeys && mr.changedKeys.indexOf('memos_v5') >= 0, mr);
  }

  t.done();
})();
