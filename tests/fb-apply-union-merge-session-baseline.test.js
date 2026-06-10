'use strict';
/* fbApplyData — union-merge "local-only item" baseline (projects/기록 add bug).
   Symptom: in the 프로젝트 and 기록(메모) tabs, an item added via 추가/저장
   intermittently disappears right after the dialog closes — "works most of
   the time, occasionally not".

   Root cause: the union-merge for task_items_v1/inbox_v1/projects_v1 and
   hobby_items_v2/memos_v5 preserved a local-only item (missing from the cloud
   snapshot) only if `item.createdAt > _prevRemoteApplyMs`. But
   `_lastRemoteApplyMs` (the source of `_prevRemoteApplyMs`) advances on
   EVERY fbApplyData call, even ones whose cloud snapshot is stale and still
   lacks the just-created item. If a SECOND stale snapshot arrives shortly
   after the first (common with Firestore onSnapshot — pending-write echo +
   server ack, or a near-simultaneous update from another device), the new
   _prevRemoteApplyMs can already be >= the item's createdAt, so the item
   fails the check on the second call and the code falls through to a blind
   overwrite — silently deleting the just-added item from localStorage.

   Fix: anchor the "was this created on this device, this session, before
   cloud caught up" check to a FIXED `_returnSessionLoadMs` (set once when the
   page loads) instead of the per-call `_prevRemoteApplyMs`.

   Tests:
   1. projects_v1: item created this session, missing from a stale cloud
      snapshot → preserved by union-merge (not lost).
   2. projects_v1: a SECOND stale snapshot (simulating the Firestore
      double-fire race) still preserves the same item.
   3. projects_v1: an item created BEFORE this session started, missing from
      cloud → NOT resurrected (blind overwrite still applies to old data).
   4. memos_v5: same "this-session item survives two stale snapshots" check,
      keyed by `ts` instead of `id`. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const dedupBlock = sliceBlock(html, 'function returnDedupById(arr){', '\nwindow.returnDedupById=returnDedupById;');
const fbApplyBlock = sliceBlock(html, 'function fbApplyData(data){', '\nfunction fbStatusTime(');

function makeSandbox(initialStore, sessionLoadMs) {
  const written = Object.assign({}, initialStore || {});
  const win = {};
  const sb = {
    window: win,
    console: { error() {}, warn() {}, log() {} },
    _rawSetItem: (k, v) => { written[k] = v; },
    localStorage: {
      getItem: (k) => (k in written ? written[k] : null),
      setItem: (k, v) => { written[k] = String(v); },
      removeItem: (k) => { delete written[k]; },
    },
    _applyingFbData: false,
    _lastRemoteApplyMs: 0,
    _lastRepairSaveMs: 0,
    _returnSessionLoadMs: sessionLoadMs,
    MEDIA_SYNC_KEY: 'return_media_sync_v1',
    _mediaSyncManifest: null,
    setTimeout: () => {},
    clearTimeout: () => {},
    Date,
    fbSaveAll: () => {},
  };
  vm.createContext(sb);
  vm.runInContext(dedupBlock, sb);
  vm.runInContext(fbApplyBlock, sb);
  return { sb, written, win };
}

const t = runner('fbApplyData — union-merge local-only items use a fixed session baseline');

const SESSION_START = 1_000_000;

// ── 1. this-session item missing from a stale cloud snapshot is preserved ──
{
  const localProjects = JSON.stringify([{ id: 'project_2000000', title: '새 프로젝트', createdAt: 2_000_000, updatedAt: 2_000_000 }]);
  const { sb, written } = makeSandbox({ projects_v1: localProjects }, SESSION_START);
  sb._lastRemoteApplyMs = SESSION_START - 500; // previous baseline, before this device's item existed
  sb.fbApplyData({
    keys: { projects_v1: '[]' }, // stale cloud snapshot — doesn't know about the new project yet
    updatedAtMs: SESSION_START + 100,
  });
  const saved = JSON.parse(written.projects_v1 || '[]');
  t.ok('new project preserved after first stale snapshot', saved.some(p => p.id === 'project_2000000'), saved);
}

// ── 2. a SECOND stale snapshot (Firestore double-fire) still preserves it ──
{
  const localProjects = JSON.stringify([{ id: 'project_2000000', title: '새 프로젝트', createdAt: 2_000_000, updatedAt: 2_000_000 }]);
  const { sb, written } = makeSandbox({ projects_v1: localProjects }, SESSION_START);
  // First stale snapshot already advanced _lastRemoteApplyMs past createdAt.
  sb._lastRemoteApplyMs = 2_000_500;
  sb.fbApplyData({
    keys: { projects_v1: '[]' }, // STILL stale — cloud hasn't caught up yet
    updatedAtMs: 2_000_600,
  });
  const saved = JSON.parse(written.projects_v1 || '[]');
  t.ok('new project survives a second stale snapshot', saved.some(p => p.id === 'project_2000000'), saved);
}

// ── 3. an item created BEFORE this session, missing from cloud → not revived ─
{
  const localProjects = JSON.stringify([{ id: 'project_old', title: '오래된 프로젝트', createdAt: SESSION_START - 5000, updatedAt: SESSION_START - 5000 }]);
  const { sb, written } = makeSandbox({ projects_v1: localProjects }, SESSION_START);
  sb._lastRemoteApplyMs = SESSION_START - 10000;
  sb.fbApplyData({
    keys: { projects_v1: '[]' },
    updatedAtMs: SESSION_START + 100,
  });
  const saved = JSON.parse(written.projects_v1 || '[]');
  t.ok('pre-session local-only item is not resurrected', !saved.some(p => p.id === 'project_old'), saved);
}

// ── 4. memos_v5: this-session memo survives two stale snapshots ────────────
{
  const localMemos = JSON.stringify([{ id: 'm_2000000_1', text: '새 메모', ts: 2_000_000, type: 'memo' }]);
  const { sb, written } = makeSandbox({ memos_v5: localMemos }, SESSION_START);
  sb._lastRemoteApplyMs = 2_000_500; // already past the memo's ts, like a prior stale apply
  sb.fbApplyData({
    keys: { memos_v5: '[]' },
    updatedAtMs: 2_000_600,
  });
  const saved = JSON.parse(written.memos_v5 || '[]');
  t.ok('new memo preserved across stale snapshots', saved.some(m => m.id === 'm_2000000_1'), saved);
}

t.done();
