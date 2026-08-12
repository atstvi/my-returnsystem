'use strict';
/* 자료 보드 · 인박스의 링크 카드(북마크/임베드) 공통 헬퍼. 백엔드가 없어 제목·
   썸네일은 외부 메타데이터 API로 가져오되, 실패 시 파비콘+도메인으로 폴백한다.
   여기서는 순수 헬퍼(도메인/파비콘/유튜브 임베드/URL 추출/메타 매핑)와
   boardEnrichItem의 채우기 규칙을 index.html에서 떼어 와 고정한다. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'function boardUrlDomain(', 'function projectBoardItemHtml(');

const sb = {
  console,
  Promise,
  URL,
  encodeURIComponent,
  musicVideoId: (url) => { const m = String(url || '').match(/[?&]v=([\w-]{11})|youtu\.be\/([\w-]{11})/); return m ? (m[1] || m[2]) : ''; },
};
vm.createContext(sb);
vm.runInContext(block, sb);

const t = runner('board/inbox link cards — helpers');

/* ── boardUrlDomain ── */
t.ok('domain strips www', sb.boardUrlDomain('https://www.example.com/a/b?x=1') === 'example.com', sb.boardUrlDomain('https://www.example.com/a/b'));
t.ok('domain from bare host', sb.boardUrlDomain('notion.so/page') === 'notion.so', sb.boardUrlDomain('notion.so/page'));
t.ok('domain fallback for junk', typeof sb.boardUrlDomain('') === 'string');

/* ── boardFavicon ── */
t.ok('favicon uses google service + domain', /s2\/favicons\?domain=example\.com/.test(sb.boardFavicon('https://example.com/x')), sb.boardFavicon('https://example.com/x'));

/* ── boardYoutubeEmbed ── */
t.ok('youtube watch → embed url', sb.boardYoutubeEmbed('https://www.youtube.com/watch?v=abcdefghijk') === 'https://www.youtube.com/embed/abcdefghijk', sb.boardYoutubeEmbed('https://www.youtube.com/watch?v=abcdefghijk'));
t.ok('youtu.be → embed url', sb.boardYoutubeEmbed('https://youtu.be/abcdefghijk') === 'https://www.youtube.com/embed/abcdefghijk', sb.boardYoutubeEmbed('https://youtu.be/abcdefghijk'));
t.ok('non-youtube → empty', sb.boardYoutubeEmbed('https://example.com') === '', sb.boardYoutubeEmbed('https://example.com'));

/* ── returnFirstUrl ── */
t.ok('extracts url from text', sb.returnFirstUrl('메모 https://foo.com/bar 끝') === 'https://foo.com/bar', sb.returnFirstUrl('메모 https://foo.com/bar 끝'));
t.ok('no url → empty', sb.returnFirstUrl('그냥 메모') === '', sb.returnFirstUrl('그냥 메모'));

/* ── boardMapMeta ── */
{
  const m = sb.boardMapMeta({ title: ' T ', description: 'D', image: { url: 'http://i/x.png' }, logo: { url: 'http://l/f.png' }, publisher: 'Pub' });
  t.ok('maps title trimmed', m.title === 'T', m.title);
  t.ok('maps desc/image/logo/publisher', m.desc === 'D' && m.image === 'http://i/x.png' && m.logo === 'http://l/f.png' && m.publisher === 'Pub', JSON.stringify(m));
  const e = sb.boardMapMeta(null);
  t.ok('null-safe → empty fields', e.title === '' && e.image === '', JSON.stringify(e));
}

/* ── boardEnrichItem: fills fields, respects _titleEdited, toggles loading ── */
(async () => {
  // success path, no user title → fill title
  sb.boardFetchMeta = () => Promise.resolve({ title: 'Fetched', desc: 'D', image: 'IMG', logo: 'LOGO', publisher: 'P' });
  await new Promise((res) => {
    const it = { id: 'e1', url: 'https://x.com', _titleEdited: false };
    sb.boardEnrichItem(it, (ok) => {
      t.ok('enrich: fills title when not user-edited', it.title === 'Fetched', it.title);
      t.ok('enrich: fills image/desc/publisher', it.image === 'IMG' && it.desc === 'D' && it.publisher === 'P', JSON.stringify(it));
      t.ok('enrich: clears in-memory loading + ok true', !sb._boardMetaLoading['e1'] && ok === true, 'loading=' + sb._boardMetaLoading['e1'] + ' ok=' + ok);
      t.ok('enrich: does NOT persist a loading flag on the item', !('_metaLoading' in it) && !('_metaOk' in it), JSON.stringify(Object.keys(it)));
      res();
    });
  });

  // user-edited title must not be overwritten
  await new Promise((res) => {
    const it = { url: 'https://x.com', title: 'MINE', _titleEdited: true };
    sb.boardEnrichItem(it, () => { t.ok('enrich: keeps user title', it.title === 'MINE', it.title); res(); });
  });

  // failure path → meta null, loading cleared, ok false, no crash
  sb.boardFetchMeta = () => Promise.resolve(null);
  await new Promise((res) => {
    const it = { id: 'e2', url: 'https://x.com', _titleEdited: false };
    sb.boardEnrichItem(it, (ok) => { t.ok('enrich: failure clears loading, ok false', !sb._boardMetaLoading['e2'] && ok === false, 'loading=' + sb._boardMetaLoading['e2'] + ' ok=' + ok); res(); });
  });

  // no url → done(false), no fetch
  await new Promise((res) => {
    const it = { url: '' };
    sb.boardEnrichItem(it, (ok) => { t.ok('enrich: no url → ok false', ok === false, 'ok=' + ok); res(); });
  });

  t.done();
})();
