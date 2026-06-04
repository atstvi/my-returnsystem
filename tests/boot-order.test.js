'use strict';
/* Boot-order safety: a #diary or #settings deep-link runs goPage() during
   initial parse, before module-level globals (CLOUD_SETTING_KEYS, FB_DATA_KEYS,
   SECTIONS, entries) are assigned further down index.html. All affected
   functions must never throw in that window.

   Tests:
   1. shouldFbSyncKey — null-safe when CLOUD_SETTING_KEYS/FB_DATA_KEYS undefined
   2. renderStripEntries — null-safe when SECTIONS/entries undefined             */
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
t.ok('return_sync_model not synced (device-local flag)', shouldFbSyncKey('return_sync_model') === false);

// once the arrays ARE assigned, explicit membership still works
sandbox.CLOUD_SETTING_KEYS = ['notif_interval'];
sandbox.FB_DATA_KEYS = ['repeat_items_v1'];
t.ok('explicit CLOUD_SETTING_KEYS membership works once assigned', shouldFbSyncKey('notif_interval') === true);
t.ok('explicit FB_DATA_KEYS membership works once assigned', shouldFbSyncKey('repeat_items_v1') === true);

// ── renderStripEntries boot-order safety ────────────────────────────────────
// A #diary deep-link fires goPage('diary') during initial parse, before the
// module-level `var entries = {}` and `var SECTIONS = [...]` assignments at
// ~lines 17761/17764 are reached. Both are var-hoisted as undefined at that
// point. renderStripEntries must return silently — no throw.
const stripBlock = sliceBlock(html, 'function renderStripEntries() {', '\nfunction _initDiary(){');
function makeFakeEl() { return { innerHTML: '', appendChild: () => {}, addEventListener: () => {}, style: {}, className: '', textContent: '' }; }
const stripSandbox = { window: {}, console, document: { getElementById: () => makeFakeEl(), createElement: () => makeFakeEl(), body: makeFakeEl() } };
vm.createContext(stripSandbox);
vm.runInContext(stripBlock, stripSandbox);
const { renderStripEntries } = stripSandbox;

const t2 = runner('Boot-order: renderStripEntries null-safety');

let stripThrew = false;
try { renderStripEntries(); } catch(e) { stripThrew = true; }
t2.ok('does not throw when SECTIONS and entries are undefined', stripThrew === false);

// guard 2: SECTIONS assigned, entries empty — filter runs, forEach skips, no crash
stripSandbox.SECTIONS = ['sleep','morning','recap'];
stripSandbox.entries = {};
const fakeEl = { innerHTML: '', appendChild: () => {}, addEventListener: () => {} };
stripSandbox.document = { getElementById: () => fakeEl, createElement: () => fakeEl };
let stripThrew2 = false;
try { renderStripEntries(); } catch(e) { stripThrew2 = true; }
t2.ok('does not throw with valid SECTIONS + empty entries + container', stripThrew2 === false);
t2.ok('container.innerHTML was set (no keys → empty-state message)', typeof fakeEl.innerHTML === 'string');

// non-string section values (e.g. migrated object fields) must not crash
// entries has one key, but entry.sleep is an object → typeof guard skips it → no crash
stripSandbox.entries = { '2026-06-02': { sleep: { text: 'object' }, morning: '' } };
let stripThrew3 = false;
try { renderStripEntries(); } catch(e) { stripThrew3 = true; }
t2.ok('non-string section value does not crash (typeof guard)', stripThrew3 === false);

t2.done();

t.done();
