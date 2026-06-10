'use strict';
/* Music tab — playlist-only gallery view (플레이리스트 라이브러리만 보이는 뷰).

   A segmented toggle (전체 / 플레이리스트) collapses the management chrome and
   shows just the playlist library. The chosen mode is a device-local UI
   preference, stored in localStorage under music_view_mode_v1 and toggled on
   #page-music via the `music-view-gallery` class (CSS hides .music-v9-left
   etc. when present). Implemented in the "Music UX v14 JS" IIFE, which exposes
   window.musicGetViewMode / window.musicSetViewMode.

   Tests:
   1. Default mode is 'full' when nothing is stored.
   2. musicSetViewMode('gallery') persists the choice and adds the
      music-view-gallery class to #page-music.
   3. musicSetViewMode('full') clears the class.
   4. An unknown value is normalized to 'full'.
   5. A stored 'gallery' value is restored as the current mode. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const startMarker = "/* ── Music UX v14 JS: playlist-only gallery view ─────────────────────────";
const endMarker = "\n/* ── end Music UX v14 JS ─────────────────────────────────────────────── */";
const v14Src = sliceBlock(html, startMarker, endMarker);

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

function makeSandbox(stored) {
  const store = {};
  if (stored != null) store['music_view_mode_v1'] = stored;
  const page = { id: 'page-music', classList: makeClassList(), dataset: {} };
  const win = {};
  const sb = {
    window: win,
    console: { log() {}, warn() {}, error() {} },
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    document: {
      getElementById: (id) => (id === 'page-music' ? page : null),
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {},
      readyState: 'complete',
    },
    setTimeout: () => {}, // suppress deferred inject/bootstrap during load
    Array,
    Object,
    String,
  };
  vm.createContext(sb);
  vm.runInContext(v14Src, sb);
  return { sb, win, store, page };
}

const t = runner('Music playlist-only gallery view');

// ── 1. default mode ──────────────────────────────────────────────────────
{
  const { win } = makeSandbox(null);
  t.ok('exposes musicGetViewMode', typeof win.musicGetViewMode === 'function');
  t.ok('exposes musicSetViewMode', typeof win.musicSetViewMode === 'function');
  t.ok('default mode is full', win.musicGetViewMode() === 'full', win.musicGetViewMode());
}

// ── 2. switch to gallery ─────────────────────────────────────────────────
{
  const { win, store, page } = makeSandbox(null);
  win.musicSetViewMode('gallery');
  t.ok('mode persisted as gallery', store['music_view_mode_v1'] === 'gallery', store['music_view_mode_v1']);
  t.ok('getViewMode returns gallery', win.musicGetViewMode() === 'gallery');
  t.ok('page gets music-view-gallery class', page.classList.contains('music-view-gallery'));
}

// ── 3. switch back to full ───────────────────────────────────────────────
{
  const { win, store, page } = makeSandbox('gallery');
  win.musicSetViewMode('full');
  t.ok('mode persisted as full', store['music_view_mode_v1'] === 'full', store['music_view_mode_v1']);
  t.ok('class removed', page.classList.contains('music-view-gallery') === false);
}

// ── 4. unknown value normalized ──────────────────────────────────────────
{
  const { win, store, page } = makeSandbox(null);
  win.musicSetViewMode('whatever');
  t.ok('unknown normalized to full', store['music_view_mode_v1'] === 'full', store['music_view_mode_v1']);
  t.ok('no gallery class for unknown', page.classList.contains('music-view-gallery') === false);
}

// ── 5. restore stored gallery ────────────────────────────────────────────
{
  const { win } = makeSandbox('gallery');
  t.ok('stored gallery restored', win.musicGetViewMode() === 'gallery');
}

t.done();
