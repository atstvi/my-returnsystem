'use strict';
/* W5 — loadWidgetPrefs: the web app's Settings → 위젯 panel saves widget_prefs_v1
   (synced to the PC widget). This loads the real loader out of index.html and
   checks defaulting + clamping so a poisoned/partial value can't push the widget
   into a broken state (e.g. end <= start hour). */
const { readIndex, sliceBlock, makeStore, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'var WIDGET_PREFS_KEY=', 'function saveWidgetPrefs(');

const { store, localStorage } = makeStore();
const sandbox = { console, localStorage };
vm.createContext(sandbox);
vm.runInContext(block, sandbox);
const { loadWidgetPrefs } = sandbox;

const t = runner('W5 — loadWidgetPrefs');

function set(v) { store['widget_prefs_v1'] = JSON.stringify(v); }

// defaults when nothing stored
delete store['widget_prefs_v1'];
let p = loadWidgetPrefs();
t.ok('default start 6', p.timelineStartHour === 6, p);
t.ok('default end 24', p.timelineEndHour === 24, p);
t.ok('default habitLimit 0', p.habitLimit === 0, p);
t.ok('default followAccent true', p.followAccent === true, p);

// malformed JSON → defaults, no throw
store['widget_prefs_v1'] = '{not json';
p = loadWidgetPrefs();
t.ok('malformed → defaults', p.timelineStartHour === 6 && p.timelineEndHour === 24);

// partial overrides preserved
set({ habitLimit: 5 });
p = loadWidgetPrefs();
t.ok('partial: habitLimit applied', p.habitLimit === 5, p);
t.ok('partial: others defaulted', p.timelineStartHour === 6 && p.followAccent === true, p);

// start-hour clamp 0..23
set({ timelineStartHour: 99 });
t.ok('start clamped to 23', loadWidgetPrefs().timelineStartHour === 23);
set({ timelineStartHour: -5 });
t.ok('start clamped to 0', loadWidgetPrefs().timelineStartHour === 0);

// end must be > start (never inverted)
set({ timelineStartHour: 20, timelineEndHour: 8 });
p = loadWidgetPrefs();
t.ok('end forced above start', p.timelineEndHour >= p.timelineStartHour + 1 && p.timelineEndHour === 21, p);

// end clamp <= 24
set({ timelineStartHour: 6, timelineEndHour: 50 });
t.ok('end clamped to 24', loadWidgetPrefs().timelineEndHour === 24);

// habitLimit clamp 0..50
set({ habitLimit: 999 });
t.ok('habitLimit clamped to 50', loadWidgetPrefs().habitLimit === 50);
set({ habitLimit: -3 });
t.ok('habitLimit clamped to 0', loadWidgetPrefs().habitLimit === 0);

// followAccent false respected
set({ followAccent: false });
t.ok('followAccent false respected', loadWidgetPrefs().followAccent === false);

// wrong types ignored → defaults
set({ timelineStartHour: '7', habitLimit: 'x', followAccent: 'yes' });
p = loadWidgetPrefs();
t.ok('non-number start ignored', p.timelineStartHour === 6, p);
t.ok('non-number habitLimit ignored', p.habitLimit === 0, p);
t.ok('non-bool followAccent ignored', p.followAccent === true, p);

t.done();
