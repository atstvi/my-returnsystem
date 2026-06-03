'use strict';
/* Boot-order safety: a #settings deep-link runs goPage() during initial parse,
   so saves (theme/cats) can fire BEFORE the module-level CLOUD_SETTING_KEYS /
   FB_DATA_KEYS arrays are assigned further down index.html. shouldFbSyncKey is
   a pure predicate and must NEVER throw in that window — previously it did
   (CLOUD_SETTING_KEYS.indexOf on undefined), which failed the whole save. This
   loads the real shouldFbSyncKey with those globals deliberately undefined and
   asserts it classifies via the regex fallback without throwing. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'function shouldFbSyncKey(k){', '\nfunction fbConfig(){');

// NOTE: CLOUD_SETTING_KEYS and FB_DATA_KEYS are intentionally absent from the
// sandbox — this reproduces the pre-assignment boot window.
const sandbox = { window: {}, console };
vm.createContext(sandbox);
vm.runInContext(block, sandbox);
const { shouldFbSyncKey } = sandbox;

const t = runner('Boot-order: shouldFbSyncKey null-safety');

let threw = false, r1, r2, r3, r4, r5;
try {
  r1 = shouldFbSyncKey('hobby_cats_v2');     // regex prefix hobby_ → true
  r2 = shouldFbSyncKey('return_theme_mode');  // regex prefix return_ → true
  r3 = shouldFbSyncKey('task_items_v1');      // regex prefix task_ → true
  r4 = shouldFbSyncKey('gcal_cfg_v1');        // explicit exclusion → false
  r5 = shouldFbSyncKey('something_random');   // no match → false
} catch (e) { threw = true; }

t.ok('does not throw when config arrays are undefined', threw === false);
t.ok('hobby_cats_v2 still syncs (regex fallback)', r1 === true);
t.ok('return_theme_mode still syncs (regex fallback)', r2 === true);
t.ok('task_items_v1 still syncs (regex fallback)', r3 === true);
t.ok('gcal_cfg_v1 excluded', r4 === false);
t.ok('unknown key not synced', r5 === false);
t.ok('falsy key → false', shouldFbSyncKey('') === false && shouldFbSyncKey(null) === false);

// once the arrays ARE assigned, explicit membership still works
sandbox.CLOUD_SETTING_KEYS = ['notif_interval'];
sandbox.FB_DATA_KEYS = ['repeat_items_v1'];
t.ok('explicit CLOUD_SETTING_KEYS membership works once assigned', shouldFbSyncKey('notif_interval') === true);
t.ok('explicit FB_DATA_KEYS membership works once assigned', shouldFbSyncKey('repeat_items_v1') === true);

t.done();
