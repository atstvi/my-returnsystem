'use strict';
/* Music tab — "플레이리스트 관리" is a centered modal (Music UX v3 JS).

   musicShowManagePanel() builds the playlist-edit panel
   (#music-manage-pl-panel) and now mounts it as a centered modal: the panel
   is wrapped in a .music-modal-backdrop scrim (#music-manage-backdrop) that
   is appended to document.body, and clicking the backdrop (or Esc) closes it
   via musicCloseEditPanel(). It used to be inserted inline before the
   playlist grid in the right column; the modal is roomier and focused.

   Tests:
   1. The panel is wrapped in a backdrop appended to document.body (not
      inserted into the shell / playlist column).
   2. The panel (#music-manage-pl-panel, .music-modal) is a child of the
      backdrop.
   3. _musicEditPanel is set to the backdrop, so musicCloseEditPanel() removes
      the whole modal.
   4. Clicking the backdrop itself closes the modal (musicCloseEditPanel). */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const startMarker = 'function musicShowManagePanel(id){';
const endMarker = '\n\n/* ── 5. Cleaner playlist card';
const src = sliceBlock(html, startMarker, endMarker);

function makeClassList() {
  const set = new Set();
  return {
    contains: (c) => set.has(c),
    add: (...cs) => cs.forEach((c) => set.add(c)),
    remove: (...cs) => cs.forEach((c) => set.delete(c)),
    toggle: (c, f) => { if (f === undefined) { if (set.has(c)) { set.delete(c); return false; } set.add(c); return true; } if (f) set.add(c); else set.delete(c); return f; },
  };
}

function makeEl(tag) {
  return {
    tagName: tag,
    className: '',
    id: '',
    _innerHTML: '',
    children: [],
    style: {},
    dataset: {},
    classList: makeClassList(),
    _listeners: {},
    set innerHTML(v) { this._innerHTML = v; },
    get innerHTML() { return this._innerHTML; },
    appendChild(c) { this.children.push(c); return c; },
    querySelector() { return makeEl('div'); },
    querySelectorAll() { return []; },
    addEventListener(ev, fn) { (this._listeners[ev] = this._listeners[ev] || []).push(fn); },
    remove() { this._removed = true; },
    scrollIntoView() {},
    focus() {},
  };
}

function makeSandbox() {
  const appended = [];
  const docListeners = {};
  let closeCalls = 0;

  const pl = { id: 'pl1', title: 'Mix', songIds: ['s1', 's2'] };
  const songs = {
    s1: { id: 's1', title: 'Song A', thumbnail: '' },
    s2: { id: 's2', title: 'Song B', thumbnail: '' },
  };

  const sb = {
    console: { log() {}, warn() {}, error() {} },
    window: {},
    document: {
      createElement: (tag) => makeEl(tag),
      body: { appendChild(el) { appended.push(el); return el; } },
      getElementById: () => null,
      querySelector: () => null,
      addEventListener: (ev, fn) => { (docListeners[ev] = docListeners[ev] || []).push(fn); },
    },
    musicPlaylistById: (id) => (id === pl.id ? pl : null),
    musicSongById: (id) => songs[id] || null,
    musicEsc: (s) => String(s == null ? '' : s),
    musicCloseEditPanel: () => { closeCalls++; },
    musicClosePickerPanel: () => {},
    musicPresetChipsHtml: () => '',
    musicBindPresetChips: () => {},
    musicReadPresetChips: () => [],
    musicSplitTags: (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean),
    musicAddSongToPlaylistPrompt: () => {},
    musicMovePlaylistSong: () => {},
    musicRemoveSongFromPlaylist: () => {},
    musicSave: () => {},
    musicRender: () => {},
    showToast: () => {},
    confirm: () => true,
  };
  vm.createContext(sb);
  vm.runInContext(src, sb);
  return { sb, appended, docListeners, get closeCalls() { return closeCalls; } };
}

const t = runner('Music playlist-manage modal mounting');

{
  const env = makeSandbox();
  const closesBefore = env.closeCalls; // the initial musicCloseEditPanel() at fn start
  env.sb.musicShowManagePanel('pl1');

  t.ok('one node appended to body', env.appended.length === 1, env.appended.length);
  const back = env.appended[0];
  t.ok('appended node is the modal backdrop', back && back.className === 'music-modal-backdrop' && back.id === 'music-manage-backdrop', back && back.className);
  const panel = back && back.children[0];
  t.ok('panel is inside the backdrop', !!panel && panel.id === 'music-manage-pl-panel', panel && panel.id);
  t.ok('panel carries the music-modal class', !!panel && /music-modal/.test(panel.className), panel && panel.className);
  t.ok('_musicEditPanel set to the backdrop', env.sb._musicEditPanel === back);

  // backdrop click closes the modal
  const clickFns = (back && back._listeners.click) || [];
  t.ok('backdrop has a click handler', clickFns.length === 1, clickFns.length);
  const before = env.closeCalls;
  clickFns[0]({ target: back });
  t.ok('clicking the backdrop calls musicCloseEditPanel', env.closeCalls === before + 1, env.closeCalls);

  // clicking inside (target = panel) does NOT close
  const before2 = env.closeCalls;
  clickFns[0]({ target: panel });
  t.ok('clicking inside the modal does not close it', env.closeCalls === before2, env.closeCalls);

  t.ok('Esc keydown handler registered on document', (env.docListeners.keydown || []).length >= 1, (env.docListeners.keydown || []).length);
  void closesBefore;
}

t.done();
