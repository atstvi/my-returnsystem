'use strict';
/* Regression test: hardcoded sample/demo data must NOT be seeded (and thus
   synced to the cloud) before the user's real cloud data has loaded.

   Bug ("정체불명의 할일·일정"): the app ships with a built-in Firebase config, so
   the cloud is active by default. On a fresh device / cleared cache, the
   seed-when-empty paths (tasks, hobby, timetable, routine) ran at boot and
   immediately persisted demo data via setReturnStorageItem → Firebase sync,
   BEFORE fbApplyData pulled the real cloud data. The demo items then propagated
   to every device and never went away.

   Fix: returnAllowSampleSeed() gates every seed path. It permits seeding only
   for explicit local-only users, or after the cloud has been loaded once
   (_fb_loaded_once, set at the end of fbApplyData). */

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

/* ── Cloud has been loaded once → seeding allowed (cloud was genuinely empty) ── */
r.ok('after cloud loaded once → seed allowed',
  allow({ '_fb_loaded_once': '1' }) === true);

/* ── Explicit local-only user → seeding allowed even without cloud load ── */
r.ok('explicit local-only user → seed allowed',
  allow({ '_fb_local_only': '1' }) === true);

/* ── local-only takes precedence regardless of loaded flag ── */
r.ok('local-only + not loaded → seed allowed',
  allow({ '_fb_local_only': '1' }) === true);

/* ── Defensive: a throwing localStorage must fail closed (no seed) ── */
{
  const sb = { localStorage: { getItem(){ throw new Error('boom'); } } };
  const ctx = vm.createContext(sb);
  vm.runInContext(block, ctx);
  r.ok('localStorage throw → fail closed (no seed)',
    vm.runInContext('returnAllowSampleSeed()', ctx) === false);
}

r.done();
