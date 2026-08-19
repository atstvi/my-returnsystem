'use strict';
/* Music — title/artist auto-parse (musicParseTitleArtist).

   When a song is added from a YouTube link with the title/artist fields left
   blank, the app fills them by parsing the video's title (from oEmbed) and
   channel. musicParseTitleArtist is the pure heuristic behind that:
   - "Artist - Title" style splits on a dash/colon/pipe separator
   - common noise ((Official Video), [MV], "... Official Video", Lyrics, 가사)
     is stripped from the title
   - with no separator, the channel name is used as the artist fallback

   This pins that behavior so a refactor of the regex/split can't silently
   regress it. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const src = sliceBlock(
  html,
  'window.musicParseTitleArtist = function(rawTitle,author){',
  '\nwindow.musicAIEnrichSong = async function'
);

const sb = { window: {}, String, Array };
vm.createContext(sb);
vm.runInContext(src, sb);
const parse = sb.window.musicParseTitleArtist;

const t = runner('musicParseTitleArtist — title/artist heuristic');

t.ok('exposes a function', typeof parse === 'function');

// ── 1. "Artist - Title (Official MV)" → split + strip bracket noise ──────────
{
  const r = parse('IU - Love wins all (Official MV)', 'IU');
  t.ok('artist = IU', r.artist === 'IU', r.artist);
  t.ok('title = Love wins all', r.title === 'Love wins all', r.title);
}

// ── 2. em-dash separator also splits ────────────────────────────────────────
{
  const r = parse('NewJeans — Ditto', 'HYBE LABELS');
  t.ok('artist from split, not channel', r.artist === 'NewJeans', r.artist);
  t.ok('title = Ditto', r.title === 'Ditto', r.title);
}

// ── 3. no separator → channel used as artist, trailing noise stripped ───────
{
  const r = parse('Ditto Official Video', 'NewJeans');
  t.ok('artist falls back to channel', r.artist === 'NewJeans', r.artist);
  t.ok('trailing "Official Video" stripped', r.title === 'Ditto', r.title);
}

// ── 4. plain title, no author → title kept, artist empty ────────────────────
{
  const r = parse('lofi hip hop radio', '');
  t.ok('title kept', r.title === 'lofi hip hop radio', r.title);
  t.ok('artist empty', r.artist === '', JSON.stringify(r.artist));
}

// ── 5. empty input is safe ──────────────────────────────────────────────────
{
  const r = parse('', '');
  t.ok('empty title → empty string', r.title === '', JSON.stringify(r.title));
  t.ok('empty artist → empty string', r.artist === '', JSON.stringify(r.artist));
}

t.done();
