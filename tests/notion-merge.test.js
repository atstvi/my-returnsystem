'use strict';
/* Stage 7 — guarded Notion two-way merge (R10). Loads the real merge helpers
   from index.html and verifies a Notion pull can never silently clobber a
   local edit, while genuine Notion-only changes are still adopted. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'var _NOTION_SECTION_KEYS=', 'async function _pullDiaryPageBody(pageId, dateKey, notionEditedMs){');

const sandbox = {
  window: {}, console,
  timetableTaskHash: (s) => 'h' + s.length, // stub hash: length-based, deterministic
  returnEntityLogConflicts: (l) => { sandbox._logged = (sandbox._logged || []).concat(l); },
};
vm.createContext(sandbox);
vm.runInContext(block, sandbox);
const { _notionMergeSection, _notionUpdateBaseline } = sandbox;

const t = runner('Stage 7 — guarded Notion merge');
let e, c;

e = { sleep: 'local' };
t.ok('empty Notion never overwrites', _notionMergeSection(e, 'sleep', '', 999, []) === 'keep-local-empty' && e.sleep === 'local');

e = { sleep: 'localEdit', _nbase: { sleep: 'base' }, updatedAt: 100 };
t.ok('Notion unchanged vs baseline → keep local edit', _notionMergeSection(e, 'sleep', 'base', 999, []) === 'keep-local-notion-unchanged' && e.sleep === 'localEdit');

e = { sleep: 'base', _nbase: { sleep: 'base' }, updatedAt: 100 };
t.ok('only Notion changed → adopt Notion', _notionMergeSection(e, 'sleep', 'notionNew', 999, []) === 'adopt-notion' && e.sleep === 'notionNew');

e = { sleep: 'localEdit', _nbase: { sleep: 'base' }, updatedAt: 100 }; c = [];
t.ok('both changed, Notion newer → Notion wins + logged', _notionMergeSection(e, 'sleep', 'notionEdit', 500, c) === 'conflict-notion-wins' && e.sleep === 'notionEdit' && c.length === 1 && c[0].winner === 'notion');

e = { sleep: 'localEdit', _nbase: { sleep: 'base' }, updatedAt: 900 }; c = [];
t.ok('both changed, local newer → keep local (no clobber)', _notionMergeSection(e, 'sleep', 'notionEdit', 500, c) === 'conflict-local-wins' && e.sleep === 'localEdit' && c[0].winner === 'local');

e = { sleep: 'freshLocal', updatedAt: 900 };
t.ok('no baseline + stale Notion → keep fresh local', _notionMergeSection(e, 'sleep', 'oldNotion', 500, []) === 'conflict-local-wins' && e.sleep === 'freshLocal');

e = { sleep: 'oldLocal', updatedAt: 100 };
t.ok('no baseline + newer Notion → adopt (legacy preserved)', _notionMergeSection(e, 'sleep', 'newNotion', 500, []) === 'conflict-notion-wins' && e.sleep === 'newNotion');

e = { sleep: 'same' };
t.ok('identical → no-op', _notionMergeSection(e, 'sleep', 'same', 999, []) === 'identical');

e = { sleep: 's', morning: 'm', _blocks: [{ type: 'text', content: 'x' }] }; _notionUpdateBaseline(e);
t.ok('baseline snapshots sections', e._nbase.sleep === 's' && e._nbase.morning === 'm');
t.ok('baseline includes blocks hash', typeof e._nbase._blocksHash === 'string' && e._nbase._blocksHash.length > 0, e._nbase._blocksHash);

t.done();
