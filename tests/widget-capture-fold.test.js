'use strict';
/* Widget quick-capture queue — widgetCaptureFold: folding desktop-widget
   quick-input items (inbox/tasks) into the main app. Loads the real pure
   function out of index.html and exercises the cross-device dedup (by _wcid
   already present in synced data) + kind-mapping in a mocked sandbox. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'function widgetCaptureFold(', 'function _buildWidgetCaptureTask(');

const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(block, sandbox);
const { widgetCaptureFold } = sandbox;

const t = runner('widget — widgetCaptureFold');

const NOW = 1_000_000_000_000;

function cap(id, over) {
  return Object.assign({ id, kind: 'inbox', text: '메모', cat: 'memo', date: '2026-06-25', createdAt: NOW }, over);
}

// 1. New item (not present) → one item, fields mapped; also queued for deletion
let r = widgetCaptureFold([cap('a')], []);
t.ok('new → one item', r.items.length === 1, r.items.length);
t.ok('fields mapped', r.items[0].text === '메모' && r.items[0].cat === 'memo' && r.items[0].createdAt === NOW, r.items[0]);
t.ok('kind preserved (inbox)', r.items[0].kind === 'inbox', r.items[0].kind);
t.ok('id carried for _wcid tagging', r.items[0].id === 'a', r.items[0].id);
t.ok('folded doc queued for delete (consume)', r.deleteIds.length === 1 && r.deleteIds[0] === 'a', r.deleteIds);

// 2. Task kind preserved; unknown kind coerced to inbox
r = widgetCaptureFold([cap('tk', { kind: 'task' }), cap('weird', { kind: 'nope' })], []);
t.ok('task kind preserved', r.items[0].kind === 'task', r.items[0].kind);
t.ok('unknown kind → inbox', r.items[1].kind === 'inbox', r.items[1].kind);

// 3. Already-present _wcid → NOT re-folded, only marked for delete (cross-device
//    dedup: another device already folded this into the synced data)
r = widgetCaptureFold([cap('a'), cap('b')], ['a']);
t.ok('present id not re-folded', r.items.length === 1 && r.items[0].id === 'b', r.items.map(x => x.id));
t.ok('present id queued for delete', r.deleteIds.indexOf('a') >= 0, r.deleteIds);
t.ok('fresh id also queued for delete', r.deleteIds.indexOf('b') >= 0, r.deleteIds);

// 4. All present → idempotent no-op (no items), all cleaned up
r = widgetCaptureFold([cap('a'), cap('b')], ['a', 'b']);
t.ok('all present → no items', r.items.length === 0, r.items);
t.ok('all present → both deleted', r.deleteIds.length === 2, r.deleteIds);

// 5. _wcid compared as string (queue ids are strings, synced field may be numeric)
r = widgetCaptureFold([cap(123)], [123]);
t.ok('numeric/string _wcid match', r.items.length === 0 && r.deleteIds.length === 1, r);

// 6. Defensive: idless doc skipped entirely; missing fields default safely
r = widgetCaptureFold([{ kind: 'task' }, cap('c', { text: undefined, cat: undefined, createdAt: undefined })], []);
t.ok('idless doc skipped', r.items.length === 1 && r.items[0].id === 'c', r.items.map(x => x.id));
t.ok('missing text → empty string', r.items[0].text === '', JSON.stringify(r.items[0].text));
t.ok('missing cat → empty string', r.items[0].cat === '', JSON.stringify(r.items[0].cat));
t.ok('missing createdAt → 0', r.items[0].createdAt === 0, r.items[0].createdAt);

// 7. imgs passthrough (array kept, non-array → null)
r = widgetCaptureFold([cap('img', { imgs: ['data:image/jpeg;base64,xx'] }), cap('noimg')], []);
t.ok('imgs array kept', Array.isArray(r.items[0].imgs) && r.items[0].imgs.length === 1, r.items[0].imgs);
t.ok('no imgs → null', r.items[1].imgs === null, r.items[1].imgs);

// 8. Empty / null inputs stable
r = widgetCaptureFold([], []);
t.ok('empty docs → empty result', r.items.length === 0 && r.deleteIds.length === 0);
r = widgetCaptureFold(null, null);
t.ok('null inputs stable', r.items.length === 0 && r.deleteIds.length === 0, r);

t.done();
