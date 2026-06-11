'use strict';
/* Music tab — "플레이리스트 관리" panel placement (Music UX v3 JS).

   musicShowManagePanel() builds the inline playlist-manage panel
   (#music-manage-pl-panel) and used to anchor it relative to
   #music-add-panel, which lives in the LEFT column (.music-v9-left, the
   song list). That made the manage panel render below the song list
   instead of next to the playlist it manages.

   The fix anchors the panel to #music-playlist-grid's enclosing
   .music-panel (in the RIGHT column, .music-v9-right) and inserts the
   manage panel immediately before it via insertBefore, so it appears as
   the right column's first child, right above the playlist grid.

   Tests:
   1. When #music-playlist-grid exists, the manage panel is inserted via
      its parent's insertBefore(panel, playlistGridPanel) — i.e. as the
      first child of the right column, NOT anchored to #music-add-panel.
   2. _musicEditPanel is set to the new panel.
   3. When #music-playlist-grid (or its enclosing .music-panel) is
      missing, the panel falls back to shell.prepend(panel). */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const startMarker = 'function musicShowManagePanel(id){';
const endMarker = '\n\n/* ── 5. Cleaner playlist card';
const src = sliceBlock(html, startMarker, endMarker);

function makeEl(tag) {
  return {
    tagName: tag,
    className: '',
    id: '',
    _innerHTML: '',
    set innerHTML(v) { this._innerHTML = v; },
    get innerHTML() { return this._innerHTML; },
    querySelector() { return makeEl('div'); },
    querySelectorAll() { return []; },
    addEventListener() {},
    appendChild() {},
    remove() {},
    scrollIntoView() {},
  };
}

function makeSandbox(opts) {
  opts = opts || {};
  const shell = { _prepended: [], prepend(node) { this._prepended.push(node); } };
  const rightCol = { _insertBeforeCalls: [], insertBefore(newNode, ref) { this._insertBeforeCalls.push({ newNode, ref }); } };
  const plGridPanel = { className: 'music-panel', parentNode: rightCol };
  const plGridEl = { id: 'music-playlist-grid', closest: () => plGridPanel };
  const addPanelEl = { id: 'music-add-panel', _afterCalls: 0, after() { this._afterCalls++; } };

  const hasGrid = opts.hasGrid !== false;

  const pl = { id: 'pl1', title: 'Mix', songIds: ['s1', 's2'] };
  const songs = {
    s1: { id: 's1', title: 'Song A', thumbnail: '' },
    s2: { id: 's2', title: 'Song B', thumbnail: '' },
  };

  const sb = {
    console: { log() {}, warn() {}, error() {} },
    document: {
      querySelector: (sel) => (sel === '#page-music .music-shell' ? shell : null),
      getElementById: (id) => {
        if (id === 'music-playlist-grid') return hasGrid ? plGridEl : null;
        if (id === 'music-add-panel') return addPanelEl;
        return null;
      },
      createElement: (tag) => makeEl(tag),
    },
    musicPlaylistById: (id) => (id === pl.id ? pl : null),
    musicSongById: (id) => songs[id] || null,
    musicEsc: (s) => String(s == null ? '' : s),
    musicCloseEditPanel: () => {},
    musicClosePickerPanel: () => {},
    musicPresetChipsHtml: () => '',
    musicBindPresetChips: () => {},
    musicReadPresetChips: () => [],
    musicSplitTags: (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean),
    musicSave: () => {},
    musicRender: () => {},
    showToast: () => {},
    confirm: () => true,
  };
  vm.createContext(sb);
  vm.runInContext(src, sb);
  return { sb, shell, rightCol, plGridPanel, addPanelEl };
}

const t = runner('Music playlist-manage panel placement');

// ── 1 & 2. anchored to the playlist-grid panel (right column) ───────────
{
  const { sb, rightCol, addPanelEl, plGridPanel } = makeSandbox();
  sb.musicShowManagePanel('pl1');

  t.ok('inserted via right column insertBefore', rightCol._insertBeforeCalls.length === 1, rightCol._insertBeforeCalls);
  const call = rightCol._insertBeforeCalls[0];
  t.ok('inserted before the playlist-grid panel', call && call.ref === plGridPanel);
  t.ok('panel is the manage panel', call && call.newNode && call.newNode.id === 'music-manage-pl-panel', call && call.newNode);
  t.ok('not anchored to #music-add-panel', addPanelEl._afterCalls === 0);
  t.ok('_musicEditPanel set to the new panel', sb._musicEditPanel === call.newNode);
}

// ── 3. fallback to shell.prepend when playlist-grid panel missing ──────
{
  const { sb, shell, rightCol } = makeSandbox({ hasGrid: false });
  sb.musicShowManagePanel('pl1');

  t.ok('right column insertBefore not used', rightCol._insertBeforeCalls.length === 0);
  t.ok('falls back to shell.prepend', shell._prepended.length === 1 && shell._prepended[0].id === 'music-manage-pl-panel', shell._prepended);
}

t.done();
