'use strict';
/* Music tab — sidebar "CD" mini-player button restarts playback (음악 cd 눌러서
   작은 창 키면 음악이 처음부터 다시 시작하는 문제).

   Symptom: clicking the floating CD button next to the music tab (which is
   supposed to just open/close the mini player showing what's currently
   playing, like a music app's now-playing widget) instead restarted the
   currently playing song from 0:00.

   Root cause: the click handler's "is anything playing yet?" check used
   `musicCurrent.playlistId`, but `musicPlaySong()` (single-song playback,
   not from a playlist) always resets `musicCurrent.playlistId` to `''`.
   So while an individually-played song was playing, the check
   `!musicCurrent.playlistId` was always true, and the handler called
   musicRecommend()+musicPlayPlaylist()/musicPlaySong() again on every click
   - reloading/restarting the player from the beginning.

   Fix: check `musicQueue` (non-empty for both playlist and single-song
   playback, same signal musicPlayPause already uses) instead.

   Tests:
   1. Song already in musicQueue (single-song playback) → CD click does NOT
      call musicPlayPlaylist/musicPlaySong (no restart).
   2. Nothing queued (musicQueue empty) → CD click DOES start the
      recommended song/playlist.
   3. CD click toggles the expanded mini-player panel open/closed. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();

const startMarker = "/* Click: toggle mini player open/close */\n  _cdBtn.addEventListener('click',function(e){";
const endMarker = "\n  });\n}\n";
const raw = sliceBlock(html, startMarker, endMarker);
const fnStart = raw.indexOf('function(e){');
const handlerSrc = '(' + raw.slice(fnStart) + '\n})';

function makeClassList(initial) {
  const set = new Set(initial || []);
  return {
    contains: (c) => set.has(c),
    add: (c) => set.add(c),
    remove: (c) => set.delete(c),
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

function makeSandbox(opts) {
  const calls = { playPlaylist: [], playSong: [], updateMini: 0 };
  const mini = { classList: makeClassList(opts.miniClasses || ['active']) };
  const ep = { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
  const sb = {
    console: { error() {}, warn() {}, log() {} },
    document: {
      getElementById: (id) => {
        if (id === 'music-mini-player') return mini;
        if (id === 'music-ep-wrap') return ep;
        return null;
      },
    },
    musicQueue: opts.musicQueue || [],
    musicCurrent: opts.musicCurrent || { playlistId: '', itemIndex: 0 },
    musicRecommend: () => opts.recommend || null,
    musicPlayPlaylist: (id, idx) => calls.playPlaylist.push([id, idx]),
    musicPlaySong: (id) => calls.playSong.push(id),
    musicUpdateMini: () => { calls.updateMini++; },
  };
  vm.createContext(sb);
  const handler = vm.runInContext(handlerSrc, sb);
  return { sb, handler, mini, ep, calls };
}

const t = runner('Music sidebar CD button — does not restart already-playing song');

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

// ── 3. CD click toggles the expanded panel open/closed ───────────────────────
{
  const { handler, mini, ep } = makeSandbox({
    musicQueue: [{ id: 'song1' }],
    musicCurrent: { playlistId: '', itemIndex: 0 },
  });
  handler({ stopPropagation() {} });
  t.ok('first click opens expanded panel', mini.classList.contains('music-ep-open'), mini);
  t.ok('aria-hidden set to false on open', ep.attrs['aria-hidden'] === 'false', ep.attrs);

  handler({ stopPropagation() {} });
  t.ok('second click closes expanded panel', !mini.classList.contains('music-ep-open'), mini);
  t.ok('aria-hidden set to true on close', ep.attrs['aria-hidden'] === 'true', ep.attrs);
}

t.done();
