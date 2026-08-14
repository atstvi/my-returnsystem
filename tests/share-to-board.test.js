'use strict';
/* 링크 공유 → 자료 보드 저장. 다른 앱에서 링크를 공유해 이 웹앱을 고르거나
   ?url=…로 열면, 프로젝트·프레임을 지정해 그 구역 보드에 북마크로 넣는다.
   여기서는 순수 로직만 고정한다:
   - _boardFrames: 보드 아이템에서 프레임만 골라냄
   - _boardDropPos: 프레임 안(또는 기본) 새 카드 좌표 — 프레임 경계 안에 놓임
   - returnHandleSharedLink: url/text/title 어디에 오든 첫 http(s) URL을 뽑아
     openLinkCaptureDialog로 넘기고, 주소창을 정리함 */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
// 순수 배치 헬퍼만 (openLinkCaptureDialog 앞까지) — projects/DOM 의존 없이 로드된다.
const posBlock = sliceBlock(html, 'function _boardFrames(', 'function openLinkCaptureDialog(');
// 부팅 핸들러만 — openLinkCaptureDialog를 스텁으로 두고 URL 추출만 검증한다.
const handlerBlock = sliceBlock(html, 'function returnHandleSharedLink(', 'try{ window.addEventListener(');

let opened = null;
let replaced = null;
const sb = {
  console,
  // returnFirstUrl는 같은 슬라이스에 없으니 주입(index.html과 동일 정규식)
  returnFirstUrl: (text) => { const m = String(text || '').match(/https?:\/\/[^\s<>"')]+/i); return m ? m[0] : ''; },
  openLinkCaptureDialog: (url, title) => { opened = { url, title }; },
  URLSearchParams,
};
vm.createContext(sb);
vm.runInContext(posBlock, sb);
vm.runInContext(handlerBlock, sb);

const t = runner('share-to-board (링크 공유 저장)');

/* ── _boardFrames ── */
{
  const board = { items: [
    { id: 'a', type: 'note' },
    { id: 'f1', type: 'frame', label: '자료' },
    { id: 'b', type: 'bookmark' },
    { id: 'f2', type: 'frame', label: '아이디어' },
  ] };
  const fr = sb._boardFrames(board);
  t.ok('frames: picks only frame items', fr.length === 2 && fr[0].id === 'f1' && fr[1].id === 'f2', JSON.stringify(fr.map((x) => x.id)));
  t.ok('frames: null-safe', Array.isArray(sb._boardFrames(null)) && sb._boardFrames(null).length === 0);
}

/* ── _boardDropPos ── */
{
  // no frame → cascades from item count
  const board = { items: [{}, {}, {}] };
  const p0 = sb._boardDropPos(board, null);
  t.ok('drop: no frame cascades off item count', p0.x === 40 + 3 * 26 && p0.y === 40 + 3 * 24, JSON.stringify(p0));

  // within a frame, first card sits inside frame bounds
  const frame = { id: 'f', type: 'frame', x: 100, y: 100, w: 320, h: 260 };
  const b2 = { items: [frame] };
  const pIn = sb._boardDropPos(b2, frame);
  t.ok('drop: inside frame X-bounds', pIn.x >= frame.x && pIn.x < frame.x + frame.w, JSON.stringify(pIn));
  t.ok('drop: inside frame Y-bounds', pIn.y >= frame.y && pIn.y < frame.y + frame.h, JSON.stringify(pIn));

  // an existing card inside the frame shifts the next one down (no exact overlap)
  const b3 = { items: [frame, { type: 'bookmark', x: pIn.x, y: pIn.y }] };
  const pIn2 = sb._boardDropPos(b3, frame);
  t.ok('drop: second card cascades (no exact overlap)', pIn2.y > pIn.y, 'p1=' + JSON.stringify(pIn) + ' p2=' + JSON.stringify(pIn2));
}

/* ── returnHandleSharedLink: url extraction from every param slot ── */
function runHandler(search) {
  opened = null; replaced = null;
  sb.window = {
    location: { search, pathname: '/my-returnsystem/', hash: '' },
    history: { replaceState: (a, b, url) => { replaced = url; } },
    addEventListener: () => {},
  };
  sb.history = sb.window.history;
  sb.returnHandleSharedLink();
}

runHandler('?url=https%3A%2F%2Fx.com%2Fpost&title=New');
t.ok('handler: reads ?url= directly', opened && opened.url === 'https://x.com/post', JSON.stringify(opened));
t.ok('handler: passes title', opened && opened.title === 'New', opened && opened.title);
t.ok('handler: cleans address bar', replaced === '/my-returnsystem/', String(replaced));

runHandler('?text=' + encodeURIComponent('공유 메모 https://foo.com/a 봐'));
t.ok('handler: extracts url from text param', opened && opened.url === 'https://foo.com/a', JSON.stringify(opened));

runHandler('?title=' + encodeURIComponent('링크 https://bar.com/b'));
t.ok('handler: extracts url from title param', opened && opened.url === 'https://bar.com/b', JSON.stringify(opened));

runHandler('?url=example.com/x');
t.ok('handler: adds https:// scheme when missing', opened && opened.url === 'https://example.com/x', JSON.stringify(opened));

runHandler('?foo=bar');
t.ok('handler: no url → no dialog', opened === null, JSON.stringify(opened));

t.done();
