'use strict';
/* 자료 보드 image items — cross-device render decision (STAGE 5b follow-up).

   The board used to store only pasted image URLs. Device uploads now store a
   `return-media:<id>` ref whose bytes live in IndexedDB + Firebase Storage. For
   that to appear on a SECOND device, projectBoardItemHtml must not blindly drop
   the ref into <img src> (a browser can't load "return-media:…"). This suite
   pins the render decision:

   - a displayable URL (http/data/blob) → direct <img src>, no async marker
   - a ref resolvable synchronously (this device / synced url-map) → direct <img>
   - a ref NOT yet resolvable → an async placeholder <img data-bd-media="…"> that
     projectBoardResolveMedia fills in later (Storage URL on device B)
   - empty/loading src → a friendly placeholder, never a broken <img>
*/
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'function projectBoardItemHtml(it){', '\nfunction projectBoardHtml(');

function render(it, mediaStore) {
  const sb = {
    // real predicate from the app
    isReturnDisplayableImageUrl: (u) => /^data:image|^blob:|^https?:/.test(String(u || '')),
    // minimal escaper (refs/urls under test have no HTML-special chars)
    projectEsc: (v) => String(v == null ? '' : v),
    MediaStore: mediaStore,
  };
  vm.createContext(sb);
  vm.runInContext(block + '\nthis.__out = projectBoardItemHtml(' + JSON.stringify(it) + ');', sb);
  return sb.__out;
}

const refStore = (syncResult) => ({
  isRef: (v) => /^return-media:/.test(String(v || '')),
  resolveSync: () => syncResult || '',
});

const t = runner('projectBoardItemHtml — image cross-device render');

// ── 1. https URL → direct img, no async marker ───────────────────────────────
{
  const out = render({ id: 'a', type: 'image', src: 'https://x/p.jpg', title: 'c' }, refStore(''));
  t.ok('https → direct <img src>', out.includes('src="https://x/p.jpg"'));
  t.ok('https → no data-bd-media marker', !out.includes('data-bd-media'));
}

// ── 2. data: URL → direct img ────────────────────────────────────────────────
{
  const out = render({ id: 'b', type: 'image', src: 'data:image/png;base64,AAAA' }, refStore(''));
  t.ok('data: → direct <img src>', out.includes('src="data:image/png;base64,AAAA"'));
  t.ok('data: → no async marker', !out.includes('data-bd-media'));
}

// ── 3. ref resolvable synchronously → direct img with resolved url ───────────
{
  const out = render({ id: 'c', type: 'image', src: 'return-media:m_1' }, refStore('https://fb/store/m_1?token=z'));
  t.ok('sync-resolved ref → direct <img src> to resolved url', out.includes('src="https://fb/store/m_1?token=z"'));
  t.ok('sync-resolved ref → no async marker', !out.includes('data-bd-media'));
}

// ── 4. ref NOT yet resolvable → async placeholder for device-B fill ──────────
{
  const out = render({ id: 'd', type: 'image', src: 'return-media:m_2' }, refStore(''));
  t.ok('unresolved ref → async data-bd-media marker', out.includes('data-bd-media="return-media:m_2"'));
  t.ok('unresolved ref → shows 불러오는 중', out.includes('불러오는 중'));
  t.ok('unresolved ref → NOT a broken src="return-media:"', !/src="return-media:/.test(out));
}

// ── 5. empty + loading → friendly placeholder, no broken img ─────────────────
{
  const out = render({ id: 'e', type: 'image', src: '', _loading: true }, refStore(''));
  t.ok('loading → 업로드 중 placeholder', out.includes('업로드 중'));
  t.ok('loading → no <img> tag at all', !out.includes('<img'));
}

// ── 6. empty, not loading → 이미지 없음 placeholder ──────────────────────────
{
  const out = render({ id: 'f', type: 'image', src: '' }, refStore(''));
  t.ok('empty → 이미지 없음 placeholder', out.includes('이미지 없음'));
}

t.done();
