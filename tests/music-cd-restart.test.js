'use strict';
/* Music tab — sidebar "CD" mini-player button restarts playback (음악 cd 눌러서
   작은 창 키면 음악이 처음부터 다시 시작하는 문제. 미니창은 현재 재생 중인 곡을
   확인하는 now-playing 위젯 역할을 해야 함).

   Symptom: clicking the floating CD button next to the music tab (which is
   supposed to just open/close a "now playing" mini player, like a music
   app's now-playing widget) instead restarted the currently playing song
   from 0:00.

   Root cause: there are THREE generations of this sidebar CD button (Music
   UX v9/v10/v11), each created via setTimeout and replacing the previous
   one. v11 runs last (400ms) and removes/recreates the button that's
   actually live in the DOM, with its OWN click handler. All three handlers'
   "is anything playing yet?" check used `musicCurrent.playlistId`, but
   musicPlaySong() (single-song playback, not via a playlist) always resets
   musicCurrent.playlistId to ''. So while an individually-played song was
   playing, the check `!musicCurrent.playlistId` was always true, and every
   CD click called musicRecommend()+musicPlayPlaylist()/musicPlaySong()
   again - reloading/restarting the player from the beginning. A prior fix
   only patched the v9 handler, whose button gets replaced by v10 then v11
   before the user ever sees it - so the bug remained on the live (v11)
   button.

   Fix: v10 and v11's handlers now check `musicQueue` (non-empty for both
   playlist and single-song playback - the same signal musicPlayPause
   already uses) instead of musicCurrent.playlistId.

   Tests (against the live v11 button):
   1. Song already in musicQueue (single-song playback) → CD click does NOT
      call musicPlayPlaylist/musicPlaySong (no restart).
   2. Nothing queued (musicQueue empty) → CD click DOES start the
      recommended song.
   3. CD click toggles the expanded "now playing" panel open/closed and
      refreshes the now-playing display (musicUpdateMini) on open. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();

const startMarker = "/* ── Music UX v11: fix sidebar CD hover (stale _cdBtn closure bug) ───── */\n(function(){\n'use strict';\n\nsetTimeout(function(){";
const endMarker = "\n})();\n/* ── end Music UX v11 JS ─────────────────────────────────────────────── */";
const body = sliceBlock(html, startMarker, endMarker);
// Re-wrap just the setTimeout callback body as an immediately-invoked function,
// using a synchronous setTimeout stub so it runs during vm.runInContext.
const v11Src = "setTimeout(function(){" + body.slice(startMarker.length);

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

function makeEl(tag) {
  const listeners = {};
  return {
    tagName: tag,
    id: '',
    className: '',
    classList: makeClassList(),
    style: {},
    dataset: {},
    attrs: {},
    children: [],
    listeners,
    addEventListener(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
    appendChild(c) { this.children.push(c); return c; },
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return this.attrs[k]; },
    getBoundingClientRect() { return { top: 0, height: 0, left: 0, width: 0 }; },
    contains() { return false; },
    set innerHTML(v) { this._innerHTML = v; },
    get innerHTML() { return this._innerHTML || ''; },
  };
}

function makeSandbox(opts) {
  const calls = { playPlaylist: [], playSong: [], updateMini: 0 };
  const mini = { classList: makeClassList(opts.miniClasses || ['active']) };
  const ep = { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
  const tabMusic = makeEl('div');
  const elements = {
    'music-sidebar-cd': null,
    'tab-music': tabMusic,
    'music-mini-player': mini,
    'music-ep-wrap': ep,
    'music-scd-face-el': null,
  };
  const body = makeEl('body');
  const sb = {
    console: { error() {}, warn() {}, log() {} },
    window: {},
    document: {
      getElementById: (id) => (id in elements ? elements[id] : null),
      createElement: (tag) => makeEl(tag),
      body,
    },
    setTimeout: (fn) => fn(),
    setInterval: () => {},
    clearTimeout: () => {},
    musicQueue: opts.musicQueue || [],
    musicCurrent: opts.musicCurrent || { playlistId: '', itemIndex: 0 },
    musicRecommend: () => opts.recommend || null,
    musicCurrentItem: () => null,
    musicPlayPlaylist: (id, idx) => calls.playPlaylist.push([id, idx]),
    musicPlaySong: (id) => calls.playSong.push(id),
    musicUpdateMini: () => { calls.updateMini++; },
  };
  vm.createContext(sb);
  vm.runInContext(v11Src, sb);
  const btn = body.children.find((c) => c.id === 'music-sidebar-cd');
  const handler = btn.listeners.click[0];
  return { sb, handler, mini, ep, calls };
}

const t = runner('Music sidebar CD button (v11, live) — now-playing mini player');

// ── 1. song playing individually (musicQueue set, playlistId='') → no restart ──
{
  const { handler, calls } = makeSandbox({
    musicQueue: [{ id: 'song1', title: '재생중' }],
    musicCurrent: { playlistId: '', itemIndex: 0 },
    recommend: { song: { id: 'song_reco' } },
  });
  handler({ stopPropagation() {} });
  t.ok('musicPlayPlaylist not called', calls.playPlaylist.length === 0, calls);
  t.ok('musicPlaySong not called (no restart)', calls.playSong.length === 0, calls);
}

// ── 2. nothing queued → CD click starts the recommended song ────────────────
{
  const { handler, calls } = makeSandbox({
    musicQueue: [],
    musicCurrent: { playlistId: '', itemIndex: 0 },
    recommend: { song: { id: 'song_reco' } },
  });
  handler({ stopPropagation() {} });
  t.ok('musicPlaySong called with recommendation', calls.playSong[0] === 'song_reco', calls);
}

// ── 3. CD click toggles the now-playing panel and refreshes its display ─────
{
  const { handler, mini, ep, calls } = makeSandbox({
    musicQueue: [{ id: 'song1' }],
    musicCurrent: { playlistId: '', itemIndex: 0 },
  });
  handler({ stopPropagation() {} });
  t.ok('first click opens now-playing panel', mini.classList.contains('music-ep-open'), mini);
  t.ok('aria-hidden set to false on open', ep.attrs['aria-hidden'] === 'false', ep.attrs);
  t.ok('musicUpdateMini called to refresh now-playing display', calls.updateMini === 1, calls);

  handler({ stopPropagation() {} });
  t.ok('second click closes now-playing panel', !mini.classList.contains('music-ep-open'), mini);
  t.ok('aria-hidden set to true on close', ep.attrs['aria-hidden'] === 'true', ep.attrs);
}

t.done();
