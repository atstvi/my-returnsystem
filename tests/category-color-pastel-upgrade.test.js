'use strict';
/* Regression: the "warm multi-pastel" redesign retired the saturated category default colors.
   Any saved/synced category still on an EXACT retired default hex must be remapped to its
   harmonized muted-pastel replacement at the read chokepoint (upgradeCatColor, used by
   normalizeTaskCatColor for tasks and hobGetCat for hobby), while genuinely custom colors pass
   through untouched. Sliced with normalizeTaskCatColor out of index.html. */
const vm = require('vm');
const { readIndex, sliceBlock } = require('./lib');

const html = readIndex();
const block = sliceBlock(html, 'var LEGACY_CAT_COLOR_MAP=', 'function taskCatSoftBg');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(block, ctx);

const { runner } = require('./lib');
const t = runner('Category colors — pastel upgrade');

// 1-3: retired task-category defaults remap to muted pastels
t.ok('old schedule red #E05050 → rose', ctx.upgradeCatColor('#E05050') === '#BE727A');
t.ok('old work teal #38B2AC → mint', ctx.upgradeCatColor('#38B2AC') === '#4E9A84');
t.ok('old uni indigo #6C63FF → periwinkle', ctx.upgradeCatColor('#6C63FF') === '#7E7BC0');

// 4-5: retired hobby-only swatch defaults remap too
t.ok('old hobby indigo #5B5FCF → periwinkle', ctx.upgradeCatColor('#5B5FCF') === '#7E7BC0');
t.ok('old hobby magenta #C05FA0 → plum', ctx.upgradeCatColor('#C05FA0') === '#A96E93');

// 6: case-insensitive
t.ok('lowercase #e05050 upgrades', ctx.upgradeCatColor('#e05050') === '#BE727A');

// 7: custom color preserved
t.ok('custom #123456 preserved', ctx.upgradeCatColor('#123456') === '#123456');

// 8: a new default is stable (idempotent — not double-mapped)
t.ok('new rose #BE727A unchanged', ctx.upgradeCatColor('#BE727A') === '#BE727A');

// 9: non-string safety
t.ok('null → null, no throw', ctx.upgradeCatColor(null) === null);

// 10: normalizeTaskCatColor applies the upgrade, then keeps hex / passes var() through
t.ok('normalize: old hex → new muted hex', ctx.normalizeTaskCatColor('#38B2AC') === '#4E9A84');
t.ok('normalize: var() token passthrough', ctx.normalizeTaskCatColor('var(--t-400)') === 'var(--t-400)');
t.ok('normalize: empty → accent default', ctx.normalizeTaskCatColor('') === 'var(--a-400)');

t.done();
