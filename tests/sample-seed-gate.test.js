'use strict';
/* Regression test: hardcoded sample/demo data must NOT be seeded (and thus
   synced to the cloud) before the user's real cloud data has loaded.

   Bug ("정체불명의 할일·일정"): the app ships with a built-in Firebase config, so
   the cloud is active by default. On a fresh device / cleared cache, the
   seed-when-empty paths (tasks, hobby, timetable, routine) ran at boot and
   immediately persisted demo data via setReturnStorageItem → Firebase sync,
   BEFORE fbApplyData pulled the real cloud data. The demo items then propagated
   to every device and never went away.

   Fix: returnAllowSampleSeed() gates every seed path.

   v2 ("앱 재설치 후 예전 할일이 뭉텅이로 미완료 + 추가한 적 없는 기본 할일"): the
   gate used to ALLOW seeding once _fb_loaded_once was set. On a reinstalled device
   the 2nd fbApplyData (onSnapshot) then saw an empty timetable/routine/hobby for a
   user who simply doesn't use those features and seeded the demo — the demo
   timetable generated ~79 past class sessions (all undone) that synced to every
   device. A cloud account must NEVER be seeded: only an explicit local-only user
   who has never loaded cloud data gets sample data. */

const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();

const block = sliceBlock(
  html,
  'function returnAllowSampleSeed(){',
  '\n/* Sample tasks */'
);

function makeCtx(store) {
  const sb = {
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
  };
  const ctx = vm.createContext(sb);
  vm.runInContext(block, ctx);
  return ctx;
}

function allow(store) {
  const ctx = makeCtx(store);
  return vm.runInContext('returnAllowSampleSeed()', ctx);
}

const r = runner('Sample/demo seed gate (returnAllowSampleSeed)');

/* ── Fresh cloud device, cloud not yet loaded → MUST NOT seed ── */
r.ok('fresh device (nothing set) → no seed', allow({}) === false, allow({}));

/* ── Cloud has been loaded once → NEVER seed (empty area = feature unused) ── */
r.ok('after cloud loaded once → no seed (cloud account)',
  allow({ '_fb_loaded_once': '1' }) === false, allow({ '_fb_loaded_once': '1' }));

/* ── Explicit local-only user → seeding allowed (never touched cloud) ── */
r.ok('explicit local-only user → seed allowed',
  allow({ '_fb_local_only': '1' }) === true);

/* ── local-only flag on a device that has loaded cloud data → no seed ── */
r.ok('local-only + cloud loaded once → no seed',
  allow({ '_fb_local_only': '1', '_fb_loaded_once': '1' }) === false);

/* ── Every seed site goes through the gate ── */
r.ok('task demo seed gated', /else if \(!returnAllowSampleSeed\(\)\) tasks = \[\];/.test(html));
r.ok('timetable demo seed gated', /if \(!timetables\.length && typeof returnAllowSampleSeed==='function' && returnAllowSampleSeed\(\)\)/.test(html));
r.ok('hobby demo seed gated', /if \(!items\.length && cats\.length && typeof returnAllowSampleSeed==='function' && returnAllowSampleSeed\(\)\)/.test(html));
r.ok('routine demo seed gated', /typeof returnAllowSampleSeed==='function'&&returnAllowSampleSeed\(\)\)seedRoutineData\(\);/.test(html));

/* ── Defensive: a throwing localStorage must fail closed (no seed) ── */
{
  const sb = { localStorage: { getItem(){ throw new Error('boom'); } } };
  const ctx = vm.createContext(sb);
  vm.runInContext(block, ctx);
  r.ok('localStorage throw → fail closed (no seed)',
    vm.runInContext('returnAllowSampleSeed()', ctx) === false);
}

r.done();
