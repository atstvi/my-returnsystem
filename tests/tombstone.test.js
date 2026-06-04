'use strict';
/* Tombstone registry (returnTombstoneMark / tombstonesLoad / returnTombstoneIsActive /
   returnTombstoneClear / returnTombstoneGC / returnEntityFilterTombstoned).
   These are the real implementations — entity-sync.test.js mocks them.

   Tests:
   1. mark → load → eid present with deletedAt
   2. isActive: delete newer than entity → true
   3. isActive: entity newer than delete → false
   4. isActive: unknown eid → false
   5. clear → eid gone
   6. GC: old entries pruned, recent kept
   7. filterTombstoned: removes active tombstones, keeps live items
   8. markMany: marks multiple eids in one call */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'var RETURN_TOMBSTONE_KEY=', '\nfunction returnEntityPrepareForSave(');

function makeSandbox() {
  const store = {};
  const ls = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
  const sb = {
    window: {},
    console: { error() {}, warn() {}, log() {} },
    localStorage: ls,
    setReturnStorageItem: (k, v) => { store[k] = String(v); return true; },
    Date,  // real Date; individual tests override sb.Date.now as needed
  };
  vm.createContext(sb);
  vm.runInContext(block, sb);
  return { sb, store };
}

const t = runner('Tombstone registry');

// ── 1. mark → load ──────────────────────────────────────────────────────────
{
  const { sb } = makeSandbox();
  sb.returnTombstoneMark('t_1', 'tasks');
  const ts = sb.tombstonesLoad();
  t.ok('mark: eid present after mark', 't_1' in ts, Object.keys(ts));
  t.ok('mark: collection recorded', ts['t_1'].collection === 'tasks', ts['t_1']);
  t.ok('mark: deletedAt is a number', typeof ts['t_1'].deletedAt === 'number', ts['t_1']);
}

// ── 2. isActive: delete newer than entity → active ──────────────────────────
{
  const { sb } = makeSandbox();
  sb.Date = { now: () => 5000 };
  sb.returnTombstoneMark('t_2', 'tasks');
  t.ok('isActive: delete(5000) >= entity(3000) → true', sb.returnTombstoneIsActive('t_2', 3000) === true);
}

// ── 3. isActive: entity newer than delete → not active ──────────────────────
{
  const { sb } = makeSandbox();
  sb.Date = { now: () => 500 };
  sb.returnTombstoneMark('t_3', 'tasks');
  t.ok('isActive: delete(500) < entity(900) → false', sb.returnTombstoneIsActive('t_3', 900) === false);
}

// ── 4. isActive: unknown eid → false ────────────────────────────────────────
{
  const { sb } = makeSandbox();
  t.ok('isActive: unknown eid → false', sb.returnTombstoneIsActive('unknown', 0) === false);
  t.ok('isActive: null eid → false', sb.returnTombstoneIsActive(null, 0) === false);
}

// ── 5. clear → eid removed ──────────────────────────────────────────────────
{
  const { sb } = makeSandbox();
  sb.returnTombstoneMark('t_4', 'tasks');
  sb.returnTombstoneClear(['t_4']);
  t.ok('clear: eid removed from registry', !('t_4' in sb.tombstonesLoad()), sb.tombstonesLoad());
}

// ── 6. GC: old entries pruned, recent kept ───────────────────────────────────
{
  const { sb, store } = makeSandbox();
  // write stale and fresh tombstones directly using real clock
  const _now = Date.now();
  const staleAt = _now - (91 * 24 * 60 * 60 * 1000);  // 91 days ago
  const freshAt = _now - 1000;
  store['return_tombstones_v1'] = JSON.stringify({
    stale_1: { deletedAt: staleAt, collection: 'tasks' },
    fresh_1: { deletedAt: freshAt, collection: 'tasks' },
  });
  sb._tombstones = null;  // reset in-memory cache so tombstonesLoad re-reads localStorage
  const pruned = sb.returnTombstoneGC();
  const remaining = sb.tombstonesLoad();
  t.ok('GC: stale entry pruned', !('stale_1' in remaining), Object.keys(remaining));
  t.ok('GC: recent entry kept', 'fresh_1' in remaining, Object.keys(remaining));
  t.ok('GC: returns count of pruned', pruned === 1, pruned);
}

// ── 7. filterTombstoned ──────────────────────────────────────────────────────
{
  const { sb } = makeSandbox();
  sb.Date = { now: () => 9000 };
  sb.returnTombstoneMark('t_del', 'tasks');  // deletedAt=9000
  const arr = [
    { _eid: 't_del', updatedAt: 5000 },   // deleted(9000) > entity(5000) → filtered
    { _eid: 't_live', updatedAt: 5000 },   // no tombstone → kept
    { _eid: 't_newer', updatedAt: 12000 }, // entity(12000) > deleted → kept if marked
    { title: 'no-eid' },                    // no eid → passthrough
  ];
  sb.returnTombstoneMark('t_newer', 'tasks');  // deletedAt=9000 < entity(12000) → kept
  const filtered = sb.returnEntityFilterTombstoned(arr);
  t.ok('filter: deleted item removed', !filtered.some((e) => e && e._eid === 't_del'), filtered.map((e)=>e&&e._eid));
  t.ok('filter: live item kept', filtered.some((e) => e && e._eid === 't_live'));
  t.ok('filter: entity newer than delete kept', filtered.some((e) => e && e._eid === 't_newer'));
  t.ok('filter: no-eid passthrough kept', filtered.some((e) => e && e.title === 'no-eid'));
}

// ── 8. markMany ──────────────────────────────────────────────────────────────
{
  const { sb } = makeSandbox();
  const n = sb.returnTombstoneMarkMany(['a_1', 'a_2', 'a_3'], 'inbox');
  const ts = sb.tombstonesLoad();
  t.ok('markMany: returns count', n === 3, n);
  t.ok('markMany: all eids present', ['a_1','a_2','a_3'].every((e) => e in ts), Object.keys(ts));
}

t.done();
