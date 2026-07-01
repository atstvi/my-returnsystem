'use strict';
/* Routine timer cross-device sync — routine_timer_state_v1 must be in the synced
   DATA_KEYS list (so start/pause/stop on one device reaches the others), and
   shouldFbSyncKey must classify it as syncable. Regression guard: the key was
   device-local before, which is why the routine timer didn't sync. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const t = runner('routine timer — cross-device sync wiring');

// 1. DATA_KEYS literal includes the timer state key
const m = html.match(/var DATA_KEYS = \[([\s\S]*?)\];/);
t.ok('DATA_KEYS block found', !!m);
t.ok('DATA_KEYS includes routine_timer_state_v1', !!m && m[1].indexOf("'routine_timer_state_v1'") >= 0, m && m[1].slice(0, 80));

// 2. shouldFbSyncKey('routine_timer_state_v1') is true when FB_DATA_KEYS carries it
//    (it does NOT match the generic regex, so membership is what makes it sync).
const block = sliceBlock(html, 'function shouldFbSyncKey(k){', '\nfunction fbConfig(){');
function classify(fbDataKeys) {
  const sandbox = { CLOUD_SETTING_KEYS: [], FB_DATA_KEYS: fbDataKeys, console };
  vm.createContext(sandbox);
  vm.runInContext(block + '\nthis.shouldFbSyncKey = shouldFbSyncKey;', sandbox);
  return sandbox.shouldFbSyncKey;
}
let withKey = classify(['routine_timer_state_v1']);
t.ok('synced when in FB_DATA_KEYS', withKey('routine_timer_state_v1') === true);
let without = classify([]);
t.ok('NOT synced by generic regex alone (proves list drives it)', without('routine_timer_state_v1') === false);

// 3. rehydrate hook is wired into the fbApply refresh
t.ok('routineTimerRehydrate defined', html.indexOf('function routineTimerRehydrate(') >= 0);
t.ok('routineTimerRehydrate called on fbApply', html.indexOf("routineTimerRehydrate()") >= 0);

t.done();
