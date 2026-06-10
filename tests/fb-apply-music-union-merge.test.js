'use strict';
/* fbApplyData — music_playlists_v1 union-merge (음악 탭: 플레이리스트 추가했는데
   사라지는 문제).

   Symptom: 음악 탭에서 플레이리스트(또는 곡)를 추가하면 가끔 다시 사라진다.

   Root cause: unlike task_items_v1/inbox_v1/projects_v1/hobby_items_v2/
   memos_v5, music_playlists_v1 had NO merge protection in fbApplyData at
   all — it fell straight through to the generic `_fbWriter(k, data.keys[k])`
   blind overwrite. musicSave() writes the new playlist to localStorage
   synchronously and queues an async fbSaveAll() push; if a Firestore
   onSnapshot/fbApplyData fires with the OLD cloud snapshot before that push
   lands, the just-added playlist (or song) is wiped from localStorage.

   Fix: same pattern as the projects_v1/memos_v5 fix (PR #108) — preserve
   local-only songs/playlists (missing from the cloud {songs,playlists} blob)
   whose createdAt is after the fixed _returnSessionLoadMs baseline.

   Tests:
   1. New playlist missing from a stale cloud snapshot → preserved.
   2. New song missing from a stale cloud snapshot → preserved.
   3. Old (pre-session) local-only playlist, missing from cloud → NOT
      resurrected (cloud wins, as before).
   4. Legacy array-shaped cloud blob → falls through to plain overwrite
      (no merge attempted; musicLoad() normalizes on next load). */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
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
  vm.runInContext(fbApplyBlock, sb);
  return { sb, written, win };
}

const t = runner('fbApplyData — music_playlists_v1 union-merge');

const SESSION_START = 1_000_000;

// ── 1. new playlist missing from stale cloud snapshot is preserved ─────────
{
  const local = JSON.stringify({
    songs: [],
    playlists: [{ id: 'pl_new', title: '집중 플레이리스트', songIds: [], createdAt: 2_000_000, updatedAt: 2_000_000 }],
  });
  const cloud = JSON.stringify({ songs: [], playlists: [] });
  const { sb, written } = makeSandbox({ music_playlists_v1: local }, SESSION_START);
  sb.fbApplyData({ keys: { music_playlists_v1: cloud }, updatedAtMs: SESSION_START + 100 });
  const saved = JSON.parse(written.music_playlists_v1 || '{}');
  t.ok('new playlist preserved', (saved.playlists || []).some(p => p.id === 'pl_new'), saved);
}

// ── 2. new song missing from stale cloud snapshot is preserved ─────────────
{
  const local = JSON.stringify({
    songs: [{ id: 'song_new', title: '새 노래', youtubeUrl: 'https://youtu.be/abc', createdAt: 2_000_000, updatedAt: 2_000_000 }],
    playlists: [],
  });
  const cloud = JSON.stringify({ songs: [], playlists: [] });
  const { sb, written } = makeSandbox({ music_playlists_v1: local }, SESSION_START);
  sb.fbApplyData({ keys: { music_playlists_v1: cloud }, updatedAtMs: SESSION_START + 100 });
  const saved = JSON.parse(written.music_playlists_v1 || '{}');
  t.ok('new song preserved', (saved.songs || []).some(s => s.id === 'song_new'), saved);
}

// ── 3. pre-session local-only playlist missing from cloud → not revived ────
{
  const local = JSON.stringify({
    songs: [],
    playlists: [{ id: 'pl_old', title: '오래된 목록', songIds: [], createdAt: SESSION_START - 5000, updatedAt: SESSION_START - 5000 }],
  });
  const cloud = JSON.stringify({ songs: [], playlists: [] });
  const { sb, written } = makeSandbox({ music_playlists_v1: local }, SESSION_START);
  sb.fbApplyData({ keys: { music_playlists_v1: cloud }, updatedAtMs: SESSION_START + 100 });
  const saved = JSON.parse(written.music_playlists_v1 || '{}');
  t.ok('pre-session local-only playlist not resurrected', !(saved.playlists || []).some(p => p.id === 'pl_old'), saved);
}

// ── 4. legacy array-shaped cloud blob → plain overwrite, no throw ──────────
{
  const local = JSON.stringify({ songs: [], playlists: [{ id: 'pl_new', title: 'X', songIds: [], createdAt: 2_000_000, updatedAt: 2_000_000 }] });
  const cloud = JSON.stringify([{ id: 'legacy1', title: 'Legacy playlist', items: [] }]);
  const { sb, written } = makeSandbox({ music_playlists_v1: local }, SESSION_START);
  let threw = false;
  try { sb.fbApplyData({ keys: { music_playlists_v1: cloud }, updatedAtMs: SESSION_START + 100 }); }
  catch (e) { threw = true; }
  t.ok('does not throw on legacy array cloud blob', threw === false);
  t.ok('legacy cloud blob written as-is', written.music_playlists_v1 === cloud, written.music_playlists_v1);
}

t.done();
