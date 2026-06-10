'use strict';
/* Music tab — bulk select for songs (노래에서 여러 항목 선택후 한번에 삭제/
   플레이리스트 추가).

   Adds a checkbox to each song row (musicSongCard) plus a toolbar
   (#music-bulk-toolbar) above the song grid with "선택 해제" / "+ 플레이리스트에
   추가" / "선택 삭제" buttons. Selection state lives in musicBulkSelected
   (id -> true).

   - musicBulkToggleSong(id, checked): tracks/untracks an id as selected.
   - musicBulkSelectedIds(): returns the currently-selected ids.
   - musicUpdateBulkToolbar(): toggles the toolbar's "active" class and
     updates the "N곡 선택됨" counter based on selection size.
   - musicBulkDeleteSelected(): after confirm(), removes selected songs from
     musicLibrary.songs AND from every playlist's songIds, clears the
     selection, saves + re-renders.
   - musicBulkAddToPlaylist(): prompts for a target playlist by number, adds
     all selected song ids to it (de-duped), clears the selection, saves +
     re-renders.

   Tests:
   1. musicBulkToggleSong / musicBulkSelectedIds track selection state.
   2. musicUpdateBulkToolbar reflects selection count in the DOM.
   3. musicBulkDeleteSelected removes selected songs from the library and
      from playlists that referenced them; declines if confirm() is false.
   4. musicBulkAddToPlaylist adds selected songs to the chosen playlist,
      de-duplicating against songs already in it.
   5. musicBulkClearSelection empties the selection and re-renders. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const musicSrc = sliceBlock(html, "var MUSIC_KEY='music_playlists_v1';", "\nmusicDeletePlaylist=function(id){");

const MUSIC_KEY_NAME = 'music_playlists_v1';

function makeClassList(initial) {
  const set = new Set(initial || []);
  return {
    contains: (c) => set.has(c),
    add: (...cs) => cs.forEach((c) => set.add(c)),
    remove: (...cs) => cs.forEach((c) => set.delete(c)),
    toggle: (c, force) => {
      if (force === undefined) {
        if (set.has(c)) { set.delete(c); return false; }
        set.add(c); return true;
      }
      if (force) set.add(c); else set.delete(c);
      return force;
    },
    _set: set,
  };
}

function makeSandbox(initialLibrary, opts) {
  opts = opts || {};
  const store = {};
  if (initialLibrary) store[MUSIC_KEY_NAME] = JSON.stringify(initialLibrary);
  const toasts = [];
  let renderCalls = 0, renderGridCalls = 0;

  const elements = {};
  function makeEl(id) {
    return {
      id,
      classList: makeClassList(),
      textContent: '',
      dataset: {},
    };
  }
  // toolbar elements present by default
  elements['music-bulk-toolbar'] = makeEl('music-bulk-toolbar');
  elements['music-bulk-count'] = makeEl('music-bulk-count');

  const sb = {
    console: { error() {}, warn() {}, log() {} },
    window: {},
    document: {
      createElement: () => ({ style: {}, dataset: {}, classList: makeClassList(), appendChild() {}, querySelector: () => null, querySelectorAll: () => [] }),
      body: { appendChild(el) { return el; } },
      getElementById: (id) => (id in elements ? elements[id] : null),
      querySelectorAll: () => [],
    },
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    setReturnStorageItem: (k, v) => { store[k] = String(v); return true; },
    fbSaveAll: () => {},
    showToast: (msg) => { toasts.push(msg); },
    musicRender: () => { renderCalls++; },
    confirm: opts.confirm || (() => true),
    prompt: opts.prompt || (() => '1'),
    setTimeout: () => {},
    clearTimeout: () => {},
    Date,
    Math,
    JSON,
    String,
    Object,
    Array,
    parseInt,
    RegExp,
  };
  vm.createContext(sb);
  vm.runInContext(musicSrc, sb);
  // Re-apply render stubs after the slice's hoisted declarations run.
  sb.musicRender = () => { renderCalls++; };
  sb.musicRenderGrid = () => { renderGridCalls++; };
  return {
    sb, store, toasts, elements,
    get renderCalls() { return renderCalls; },
    get renderGridCalls() { return renderGridCalls; },
  };
}

const t = runner('Music bulk select (delete / add to playlist)');

// ── 1. musicBulkToggleSong / musicBulkSelectedIds ───────────────────────
{
  const { sb } = makeSandbox(null);
  t.ok('starts empty', sb.musicBulkSelectedIds().length === 0);
  sb.musicBulkToggleSong('s1', true);
  sb.musicBulkToggleSong('s2', true);
  t.ok('two ids selected', JSON.stringify(sb.musicBulkSelectedIds().sort()) === JSON.stringify(['s1', 's2']));
  sb.musicBulkToggleSong('s1', false);
  t.ok('one id remains after deselect', JSON.stringify(sb.musicBulkSelectedIds()) === JSON.stringify(['s2']));
}

// ── 2. musicUpdateBulkToolbar ────────────────────────────────────────────
{
  const sandbox = makeSandbox(null);
  const { sb, elements } = sandbox;
  sb.musicUpdateBulkToolbar();
  t.ok('toolbar inactive when nothing selected', elements['music-bulk-toolbar'].classList.contains('active') === false);
  t.ok('counter shows 0', elements['music-bulk-count'].textContent === '0곡 선택됨', elements['music-bulk-count'].textContent);
  sb.musicBulkToggleSong('s1', true);
  t.ok('toolbar active once something selected', elements['music-bulk-toolbar'].classList.contains('active') === true);
  t.ok('counter shows 1', elements['music-bulk-count'].textContent === '1곡 선택됨', elements['music-bulk-count'].textContent);
}

// ── 3. musicBulkDeleteSelected ───────────────────────────────────────────
{
  const library = {
    songs: [
      { id: 's1', title: 'Song A', youtubeUrl: 'https://youtu.be/AAAAAAAAAAA', tags: [], createdAt: 1, updatedAt: 1 },
      { id: 's2', title: 'Song B', youtubeUrl: 'https://youtu.be/BBBBBBBBBBB', tags: [], createdAt: 1, updatedAt: 1 },
      { id: 's3', title: 'Song C', youtubeUrl: 'https://youtu.be/CCCCCCCCCCC', tags: [], createdAt: 1, updatedAt: 1 },
    ],
    playlists: [
      { id: 'pl1', title: 'Mix', coverImage: '', description: '', tags: [], mood: '', useCase: '', songIds: ['s1', 's2', 's3'], createdAt: 1, updatedAt: 1 },
    ],
  };
  const sandbox = makeSandbox(library);
  const { sb, store, toasts } = sandbox;
  sb.musicBulkToggleSong('s1', true);
  sb.musicBulkToggleSong('s2', true);
  sb.musicBulkDeleteSelected();

  const saved = JSON.parse(store[MUSIC_KEY_NAME]);
  t.ok('selected songs removed from library', saved.songs.map((s) => s.id).sort().join(',') === 's3', saved.songs);
  t.ok('selected songs removed from playlist songIds', JSON.stringify(saved.playlists[0].songIds) === JSON.stringify(['s3']), saved.playlists[0].songIds);
  t.ok('selection cleared', sb.musicBulkSelectedIds().length === 0);
  t.ok('musicRender called', sandbox.renderCalls === 1, sandbox.renderCalls);
  t.ok('toast reports 2 deleted', toasts.some((m) => /2곡을 삭제했어요/.test(m)), toasts);
}

// ── 3b. musicBulkDeleteSelected — declined confirm() does nothing ───────
{
  const library = {
    songs: [{ id: 's1', title: 'Song A', youtubeUrl: 'https://youtu.be/AAAAAAAAAAA', tags: [], createdAt: 1, updatedAt: 1 }],
    playlists: [],
  };
  const sandbox = makeSandbox(library, { confirm: () => false });
  const { sb, store } = sandbox;
  sb.musicBulkToggleSong('s1', true);
  sb.musicBulkDeleteSelected();
  const saved = JSON.parse(store[MUSIC_KEY_NAME]);
  t.ok('song not removed when confirm declined', saved.songs.length === 1, saved.songs);
  t.ok('selection retained when confirm declined', sb.musicBulkSelectedIds().length === 1);
  t.ok('musicRender not called', sandbox.renderCalls === 0, sandbox.renderCalls);
}

// ── 4. musicBulkAddToPlaylist ────────────────────────────────────────────
{
  const library = {
    songs: [
      { id: 's1', title: 'Song A', youtubeUrl: 'https://youtu.be/AAAAAAAAAAA', thumbnail: 'cover-a.jpg', tags: [], createdAt: 1, updatedAt: 1 },
      { id: 's2', title: 'Song B', youtubeUrl: 'https://youtu.be/BBBBBBBBBBB', thumbnail: 'cover-b.jpg', tags: [], createdAt: 1, updatedAt: 1 },
    ],
    playlists: [
      { id: 'pl1', title: 'Existing', coverImage: '', description: '', tags: [], mood: '', useCase: '', songIds: ['s1'], createdAt: 1, updatedAt: 1 },
      { id: 'pl2', title: 'Other', coverImage: '', description: '', tags: [], mood: '', useCase: '', songIds: [], createdAt: 1, updatedAt: 1 },
    ],
  };
  const sandbox = makeSandbox(library, { prompt: () => '1' }); // pick playlist #1 ("Existing")
  const { sb, store, toasts } = sandbox;
  sb.musicBulkToggleSong('s1', true);
  sb.musicBulkToggleSong('s2', true);
  sb.musicBulkAddToPlaylist();

  const saved = JSON.parse(store[MUSIC_KEY_NAME]);
  const pl = saved.playlists.find((p) => p.id === 'pl1');
  t.ok('new song added, existing not duplicated', JSON.stringify(pl.songIds) === JSON.stringify(['s1', 's2']), pl.songIds);
  t.ok('cover stays from already-present song', pl.coverImage === '' || pl.coverImage === 'cover-a.jpg', pl.coverImage);
  t.ok('selection cleared', sb.musicBulkSelectedIds().length === 0);
  t.ok('musicRender called', sandbox.renderCalls === 1, sandbox.renderCalls);
  t.ok('toast reports 1 added, 1 already present', toasts.some((m) => /1곡을 추가했어요/.test(m) && /1곡 이미 있음/.test(m)), toasts);
}

// ── 4b. musicBulkAddToPlaylist — no playlists yet ───────────────────────
{
  const library = {
    songs: [{ id: 's1', title: 'Song A', youtubeUrl: 'https://youtu.be/AAAAAAAAAAA', tags: [], createdAt: 1, updatedAt: 1 }],
    playlists: [],
  };
  const sandbox = makeSandbox(library);
  const { sb, toasts } = sandbox;
  sb.musicBulkToggleSong('s1', true);
  sb.musicBulkAddToPlaylist();
  t.ok('toast asks to create a playlist first', toasts.some((m) => /플레이리스트를 먼저 만들어 주세요/.test(m)), toasts);
  t.ok('selection retained', sb.musicBulkSelectedIds().length === 1);
}

// ── 5. musicBulkClearSelection ───────────────────────────────────────────
{
  const sandbox = makeSandbox(null);
  const { sb } = sandbox;
  sb.musicBulkToggleSong('s1', true);
  sb.musicBulkClearSelection();
  t.ok('selection emptied', sb.musicBulkSelectedIds().length === 0);
  t.ok('musicRenderGrid called', sandbox.renderGridCalls === 1, sandbox.renderGridCalls);
}

t.done();
