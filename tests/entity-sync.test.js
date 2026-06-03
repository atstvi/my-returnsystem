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
};
vm.createContext(sandbox);
vm.runInContext(block, sandbox);
const { fbEntityMigrateIfNeeded, fbEntityWriteChanged, fbEntityReadAll, fbEntityBuildDocs, RETURN_ENTITY_COLLECTIONS, RETURN_ENTITY_DUALWRITE } = sandbox;

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

  const rep = await fbEntityReadAll(ref);
  t.ok('readAll counts match mirror', rep.tasks.live === 1 && rep.tasks.tombs === 1 && rep.projects.live === 1, rep);

  store['inbox_v1'] = JSON.stringify([{ id: 'abc', text: 'x' }]);
  const docs = fbEntityBuildDocs(RETURN_ENTITY_COLLECTIONS.find((s) => s.collection === 'inbox'));
  t.ok('missing _eid derived deterministically (ib_abc)', 'ib_abc' in docs, Object.keys(docs));

  t.ok('dual-write flag default true', RETURN_ENTITY_DUALWRITE === true);
  const shadowKeys = Object.keys(store).filter((k) => k.startsWith('__entity_wshadow_'));
  t.ok('write-shadow keys non-synced-prefixed', shadowKeys.length >= 3 && shadowKeys.every((k) => k.startsWith('__entity_')), shadowKeys);

  t.done();
})();
