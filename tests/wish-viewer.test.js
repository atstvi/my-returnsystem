'use strict';
/* 위시리스트: 카드를 누르면 편집창이 아니라 '보기 창'(인스타 게시물 느낌)이 뜬다.
   - 사진 캐러셀(스와이프·버튼·←/→), 누르면 전체 화면. 이름·가격·별점·장단점·메모·링크.
   - 편집은 보기 창의 '편집' 버튼(저장·취소 후 보기 창으로 돌아옴). 카드의 '편집' 버튼은 그대로 편집창.
   - ⋯는 공용 메뉴(rdsActionSheet): 편집/상태/비교/구매처/삭제. Esc는 위에 뜬 창부터 닫는다. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('위시리스트 보기 창');

/* 장단점 줄 나누기(글머리 기호 제거) */
const ctx = { String };
vm.createContext(ctx);
vm.runInContext(sliceBlock(html, 'function wishLines(t){', 'function wishOpenViewer('), ctx);
t.ok('장단점: 줄 단위 + 글머리(-·•) 제거 + 빈 줄 버림',
  JSON.stringify(ctx.wishLines('노캔 최고\n\n- 배터리 30시간\n• 가벼움 \n  ')) === JSON.stringify(['노캔 최고', '배터리 30시간', '가벼움']));
t.ok('장단점: 비어 있으면 빈 목록', ctx.wishLines('').length === 0 && ctx.wishLines(null).length === 0);

/* 배선 */
const bind = sliceBlock(html, 'function wishBindBoard(root){', 'function wishResolveOne(');
t.ok('카드 누르면 보기 창', /\[data-wishcard\][\s\S]*?wishOpenViewer\(wishById\(card\.getAttribute\('data-wishcard'\)\)\)/.test(bind));
t.ok('카드 편집 버튼은 그대로 편집창', /\[data-wishedit\][\s\S]*?wishOpenEditor\(wishById\(b\.getAttribute\('data-wishedit'\)\)\)/.test(bind));

const vw = sliceBlock(html, 'function wishOpenViewer(w, opts){', 'function wishTogglePick(id){');
t.ok('사진 캐러셀: 스크롤 스냅 트랙 + 1/N + 점 + 이전/다음', /wv-track/.test(vw) && /wv-count/.test(vw) && /wv-dots/.test(vw) && /wv-prev/.test(vw) && /wv-next/.test(vw));
t.ok('사진 누르면 전체 화면', /addEventListener\('click',function\(\)\{ wishLightbox\(imgs\[i\]\); \}\)/.test(vw));
t.ok('←/→: 사진 먼저, 끝이면 이전/다음 항목', /ArrowRight[\s\S]*?go\(idx\+1\); else step\(1\)/.test(vw) && /ArrowLeft[\s\S]*?go\(idx-1\); else step\(-1\)/.test(vw));
t.ok('Esc: 위에 뜬 창(전체 화면·메뉴)이 있으면 양보', /rds-sheet\.on,\.rds-menu\.on/.test(vw) && /tops\[tops\.length-1\]!==ov/.test(vw));
t.ok('편집 → 닫힌 뒤 보기 창으로 복귀(삭제됐으면 안 함)', /_wishEditorAfterClose=reopen; wishOpenEditor\(wishById\(w\.id\)\)/.test(vw) && /if\(cur2&&!cur2\.deletedAt\)wishOpenViewer/.test(vw));
t.ok('⋯ 메뉴는 공용 rdsActionSheet(편집·상태·비교·구매처·삭제)', /rdsActionSheet\(\{ title:w\.title/.test(vw) && /label:'편집'/.test(vw) && /label:'상태 바꾸기…'/.test(vw) && /label:'구매처 열기'/.test(vw) && /label:'삭제', danger:true, onClick:function\(\)\{ close\(\); wishDelete\(w\.id\); \}/.test(vw));
t.ok('상태 바꾸면 updatedAt + 저장(동기화 LWW)', /x\.status=s2\.key; x\.updatedAt=Date\.now\(\); wishSave\(\);/.test(vw));
t.ok('글은 전부 이스케이프', /wishEsc\(w\.title\|\|'무제'\)/.test(vw) && /wishEsc\(w\.note\)/.test(vw) && /wishEsc\(l\.url\)/.test(vw));

const ed = sliceBlock(html, 'function wishOpenEditor(', 'function wishDelete(');
t.ok('편집창: 닫힐 때 보기 창 복귀 훅(한 번만)', /var _afterClose=_wishEditorAfterClose; _wishEditorAfterClose=null;/.test(ed) && /function close\(\)\{ov\.remove\(\); if\(_afterClose\)setTimeout\(_afterClose,0\);\}/.test(ed));

const lb = sliceBlock(html, 'function wishLightbox(im){', '/* ── 위시 보기 창');
t.ok('전체 화면 사진도 Esc로 닫힘', /e\.key==='Escape'/.test(lb) && /removeEventListener\('keydown',onKey,true\)/.test(lb));

/* CSS: 데스크톱 두 칸, 폰·태블릿 한 줄 */
t.ok('데스크톱(≥1024) 사진|내용 두 칸', /@media \(min-width:1024px\)\{\s*\.wish-vw\{[^}]*grid-template-areas:"media head" "media body" "media foot"/.test(html));
t.ok('터치에서 상태 칩 44px 누름 영역', /@media \(pointer:coarse\)\{ \.wv-status\{position:relative\} \.wv-status::after\{[^}]*height:var\(--tap\)/.test(html));

t.done();
