'use strict';
/* Regression: the "warm multi-pastel" redesign retired the old red/cream default colors. A
   saved (and Firebase-synced) Theme Studio state that still carries an EXACT old-default hex must
   be upgraded to the new default on read — otherwise the stale cloud value shadows the new brand
   default forever (and re-poisons after every cloud round-trip). A genuinely custom color must be
   left alone. This exercises themeStudioUpgradeLegacyColorDefaults, sliced with its two backing
   constants out of index.html. */
const vm = require('vm');
const { readIndex, sliceBlock, runner } = require('./lib');

const html = readIndex();
// Slice the default object + legacy map + upgrade helper (ends where themeStudioClone begins).
const block = sliceBlock(html, 'var THEME_STUDIO_DEFAULT={', 'function themeStudioClone(');

const ctx = {};
vm.createContext(ctx);
vm.runInContext(block, ctx);

const t = runner('Theme Studio — legacy color default upgrade');

const NEW = ctx.THEME_STUDIO_DEFAULT.colors;

// 1-4: each retired default hex upgrades to the new default
t.ok('accent #C2433D → new default',
  ctx.themeStudioUpgradeLegacyColorDefaults({ accent: '#C2433D' }).accent === NEW.accent, NEW.accent);
t.ok('page #FAF9F7 → new default',
  ctx.themeStudioUpgradeLegacyColorDefaults({ page: '#FAF9F7' }).page === NEW.page, NEW.page);
t.ok('text #352B2B → new default',
  ctx.themeStudioUpgradeLegacyColorDefaults({ text: '#352B2B' }).text === NEW.text, NEW.text);
t.ok('sidebarActive #FBE5EC → new default',
  ctx.themeStudioUpgradeLegacyColorDefaults({ sidebarActive: '#FBE5EC' }).sidebarActive === NEW.sidebarActive, NEW.sidebarActive);

// 5: case-insensitive match (hex may be stored lowercase)
t.ok('lowercase #c2433d still upgrades',
  ctx.themeStudioUpgradeLegacyColorDefaults({ accent: '#c2433d' }).accent === NEW.accent);

// 6: a genuine custom color is preserved (NOT an old default)
t.ok('custom blue accent preserved',
  ctx.themeStudioUpgradeLegacyColorDefaults({ accent: '#5B9BD5' }).accent === '#5B9BD5');

// 7: the new default itself is stable (idempotent — no double-upgrade)
t.ok('new accent left unchanged (idempotent)',
  ctx.themeStudioUpgradeLegacyColorDefaults({ accent: NEW.accent }).accent === NEW.accent);

// 8: null / non-object safety
t.ok('null colors → returns null, no throw',
  ctx.themeStudioUpgradeLegacyColorDefaults(null) === null);

// 9: only the drifted key changes; sibling custom keys untouched
const mixed = ctx.themeStudioUpgradeLegacyColorDefaults({ accent: '#C2433D', text: '#123456' });
t.ok('mixed: legacy accent upgraded, custom text kept',
  mixed.accent === NEW.accent && mixed.text === '#123456', mixed);

t.done();
