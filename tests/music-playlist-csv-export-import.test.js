'use strict';
/* Music tab — playlist export/import as CSV (플레이리스트 html/csv/zip 내보내기/
   가져오기 기능).

   Format choice: CSV. This is a single-file app with no build step/bundler,
   so a ZIP export would need an external library (JSZip etc.) that can't be
   bundled. CSV needs zero dependencies, is trivial to serialize/parse
   correctly with plain JS, is human-editable, and round-trips through
   spreadsheet apps (Excel/Sheets) - the most "구현 안정적인" option of the
   three formats requested.

   What this adds (musicLibrary = {songs:[], playlists:[]}):
   - musicCsvEscape / musicSongsToCSV: serialize a playlist's songs to CSV
     (title, artist, youtubeUrl, startTime, endTime, volume, tags, mood,
     useCase, notes — tags joined with "|" since "," is the field separator).
   - musicParseCSV / musicCSVToSongs: RFC4180-ish parser (quoted fields,
     embedded commas/newlines, "" escaped quotes) back into song objects.
   - musicExportPlaylistCSV(plId): downloads <playlist title>.csv via Blob.
   - musicImportPlaylistCSV(plId) + musicHandlePlaylistImport(e): imports a
     CSV file. Rows with no recognizable YouTube video id are skipped. Songs
     are de-duplicated against the existing library by youtubeUrl. If plId
     is given, songs are appended to that playlist; otherwise a new playlist
     is created (titled from the file name).

   Tests:
   1. musicCsvEscape quotes fields containing commas/quotes/newlines.
   2. musicSongsToCSV/musicCSVToSongs round-trip a song's fields (incl. tags).
   3. musicExportPlaylistCSV downloads a CSV blob named after the playlist,
      containing all of its songs.
   4. musicHandlePlaylistImport (no target playlist) creates a new playlist
      from the CSV's valid rows, skipping rows without a YouTube id, and
      saves + re-renders.
   5. musicHandlePlaylistImport (existing target playlist) appends songs and
      de-duplicates against an already-known youtubeUrl. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const musicSrc = sliceBlock(html, "var MUSIC_KEY='music_playlists_v1';", "\nmusicDeletePlaylist=function(id){");

function makeSandbox(initialLibrary) {
  const store = {};
  if (initialLibrary) store[MUSIC_KEY_NAME] = JSON.stringify(initialLibrary);
  const toasts = [];
  let renderCalls = 0;
  const anchors = [];
  let lastBlob = null;

  function makeEl(tag) {
    if (tag === 'a') {
      const a = { tagName: 'a', _clicked: false, click() { this._clicked = true; }, remove() {} };
      anchors.push(a);
      return a;
    }
    return { tagName: tag, style: {}, dataset: {}, children: [], appendChild(c) { this.children.push(c); return c; } };
  }

  class FakeBlob {
    constructor(parts, opts) { this.parts = parts; this.opts = opts; }
    text() { return this.parts.join(''); }
  }

  // Real URL (needed by musicUrlObj/musicVideoId), plus the
  // createObjectURL/revokeObjectURL statics musicExportPlaylistCSV uses.
  class FakeURL extends URL {}
  FakeURL.createObjectURL = (b) => { lastBlob = b; return 'blob:mock'; };
  FakeURL.revokeObjectURL = () => {};

  const sb = {
    console: { error() {}, warn() {}, log() {} },
    window: {},
    document: {
      createElement: (tag) => makeEl(tag),
      body: { appendChild(el) { return el; } },
      getElementById: () => null,
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
    setTimeout: () => {},
    clearTimeout: () => {},
    Blob: FakeBlob,
    URL: FakeURL,
    Date,
    Math,
    JSON,
    String,
    Array,
    parseInt,
    RegExp,
  };
  vm.createContext(sb);
  vm.runInContext(musicSrc, sb);
  // The slice also contains an early `function musicRender(){...}` declaration
  // (later overridden in index.html, but outside this slice). Re-apply our
  // render-call-counting stub after the slice has hoisted its own version.
  sb.musicRender = () => { renderCalls++; };
  return {
    sb, store, toasts, anchors,
    get lastBlob() { return lastBlob; },
    get renderCalls() { return renderCalls; },
  };
}

const MUSIC_KEY_NAME = 'music_playlists_v1';

const t = runner('Music playlist CSV export/import');

// ── 1. musicCsvEscape ───────────────────────────────────────────────────
{
  const { sb } = makeSandbox(null);
  t.ok('plain value passes through', sb.musicCsvEscape('hello') === 'hello');
  t.ok('comma triggers quoting', sb.musicCsvEscape('a,b') === '"a,b"');
  t.ok('quotes are doubled and wrapped', sb.musicCsvEscape('say "hi"') === '"say ""hi"""');
  t.ok('newline triggers quoting', sb.musicCsvEscape('line1\nline2') === '"line1\nline2"');
  t.ok('null/undefined become empty string', sb.musicCsvEscape(null) === '' && sb.musicCsvEscape(undefined) === '');
}

// ── 2. musicSongsToCSV / musicCSVToSongs round-trip ─────────────────────
{
  const { sb } = makeSandbox(null);
  const songs = [{
    title: 'Song, "A"',
    artist: 'Artist\nX',
    youtubeUrl: 'https://youtu.be/AAAAAAAAAAA',
    startTime: 10, endTime: 90, volume: 80,
    tags: ['study', 'calm'],
    mood: 'calm', useCase: 'study', notes: 'note, with comma',
  }];
  const csv = sb.musicSongsToCSV(songs);
  t.ok('CSV starts with header', csv.split('\r\n')[0] === sb.MUSIC_CSV_COLUMNS.join(','), csv.split('\r\n')[0]);
  const back = sb.musicCSVToSongs(csv);
  t.ok('round-trip yields one song', back.length === 1, back);
  const s = back[0];
  t.ok('title round-trips (incl. quote/comma)', s.title === songs[0].title, s.title);
  t.ok('artist round-trips (incl. newline)', s.artist === songs[0].artist, s.artist);
  t.ok('youtubeUrl round-trips', s.youtubeUrl === songs[0].youtubeUrl, s.youtubeUrl);
  t.ok('startTime/endTime/volume round-trip', s.startTime === 10 && s.endTime === 90 && s.volume === 80, s);
  t.ok('tags round-trip as array', JSON.stringify(s.tags) === JSON.stringify(['study', 'calm']), s.tags);
  t.ok('notes round-trips (incl. comma)', s.notes === songs[0].notes, s.notes);
}

// ── 3. musicExportPlaylistCSV ───────────────────────────────────────────
{
  const library = {
    songs: [
      { id: 's1', title: 'Lofi Beats', artist: 'A', youtubeUrl: 'https://youtu.be/AAAAAAAAAAA', startTime: 0, endTime: 0, volume: 80, tags: ['calm'], mood: 'calm', useCase: 'study', notes: '' },
      { id: 's2', title: 'Focus Flow', artist: 'B', youtubeUrl: 'https://youtu.be/BBBBBBBBBBB', startTime: 0, endTime: 0, volume: 70, tags: ['focus'], mood: 'focus', useCase: 'study', notes: '' },
    ],
    playlists: [
      { id: 'pl1', title: 'Deep Work', coverImage: '', description: '', tags: [], mood: '', useCase: '', songIds: ['s1', 's2'], createdAt: 1, updatedAt: 1 },
    ],
  };
  const sandbox = makeSandbox(library);
  const { sb, anchors, toasts } = sandbox;
  sb.musicExportPlaylistCSV('pl1');
  t.ok('one anchor created and clicked', anchors.length === 1 && anchors[0]._clicked === true, anchors);
  t.ok('filename derived from playlist title', anchors[0].download === 'Deep Work.csv', anchors[0].download);
  t.ok('toast confirms 2 songs exported', toasts.some((m) => /2곡/.test(m)), toasts);
  const csvText = sandbox.lastBlob.text().replace(/^﻿/, '');
  const back = sb.musicCSVToSongs(csvText);
  t.ok('exported CSV contains both songs', back.length === 2 && back.map((s) => s.title).join(',') === 'Lofi Beats,Focus Flow', back);
}

// ── 4. musicHandlePlaylistImport — new playlist ─────────────────────────
{
  const library = { songs: [], playlists: [] };
  const sandbox = makeSandbox(library);
  const { sb, store, toasts } = sandbox;
  const csv = [
    'title,artist,youtubeUrl,startTime,endTime,volume,tags,mood,useCase,notes',
    'Song A,Artist A,https://youtu.be/AAAAAAAAAAA,0,0,80,study|calm,calm,study,',
    'Song B,Artist B,https://youtu.be/BBBBBBBBBBB,10,100,60,focus,focus,study,',
    'Bad Row,No URL,,0,0,80,,,,',
  ].join('\r\n');

  class FakeFileReader {
    readAsText(file) { this.onload({ target: { result: file._content } }); }
  }
  sb.FileReader = FakeFileReader;

  const ev = { target: { files: [{ name: 'StudyMix.csv', _content: csv }], value: 'x' } };
  sb.musicHandlePlaylistImport(ev);

  t.ok('event target value reset', ev.target.value === '', ev.target.value);
  t.ok('musicRender called', sandbox.renderCalls === 1, sandbox.renderCalls);
  const saved = JSON.parse(store[MUSIC_KEY_NAME]);
  t.ok('one new playlist created', saved.playlists.length === 1, saved.playlists);
  t.ok('playlist title from filename', saved.playlists[0].title === 'StudyMix', saved.playlists[0].title);
  t.ok('two valid songs added to library', saved.songs.length === 2, saved.songs);
  t.ok('playlist references both new songs', saved.playlists[0].songIds.length === 2, saved.playlists[0].songIds);
  t.ok('toast reports 2 imported, 1 skipped', toasts.some((m) => /2곡/.test(m) && /1곡 건너뜀/.test(m)), toasts);
}

// ── 5. musicHandlePlaylistImport — existing playlist, de-dup by youtubeUrl ─
{
  const library = {
    songs: [
      { id: 'existing1', title: 'Already Here', artist: '', youtubeUrl: 'https://youtu.be/AAAAAAAAAAA', startTime: 0, endTime: 0, volume: 80, tags: [], mood: '', useCase: '', notes: '', createdAt: 1, updatedAt: 1 },
    ],
    playlists: [
      { id: 'pl1', title: 'My Mix', coverImage: '', description: '', tags: [], mood: '', useCase: '', songIds: ['existing1'], createdAt: 1, updatedAt: 1 },
    ],
  };
  const { sb, store, toasts } = makeSandbox(library);
  class FakeFileReader {
    readAsText(file) { this.onload({ target: { result: file._content } }); }
  }
  sb.FileReader = FakeFileReader;

  const csv = [
    'title,artist,youtubeUrl,startTime,endTime,volume,tags,mood,useCase,notes',
    'Already Here,,https://youtu.be/AAAAAAAAAAA,0,0,80,,,,',
    'New Song,,https://youtu.be/CCCCCCCCCCC,0,0,80,,,,',
  ].join('\r\n');

  sb.musicImportPlaylistCSV('pl1');
  sb.musicHandlePlaylistImport({ target: { files: [{ name: 'extra.csv', _content: csv }], value: 'x' } });

  const saved = JSON.parse(store[MUSIC_KEY_NAME]);
  t.ok('no new playlist created (used existing target)', saved.playlists.length === 1, saved.playlists);
  t.ok('existing song not duplicated', saved.songs.filter((s) => s.youtubeUrl === 'https://youtu.be/AAAAAAAAAAA').length === 1, saved.songs);
  t.ok('one new song added', saved.songs.length === 2, saved.songs);
  t.ok('playlist now references both songs without duplicates', saved.playlists[0].songIds.length === 2, saved.playlists[0].songIds);
  t.ok('toast reports 2 imported', toasts.some((m) => /2곡/.test(m)), toasts);
}

t.done();
