'use strict';
/* 취미 위시리스트 사진: 복사한 사진을 Ctrl/⌘+V로 바로 첨부(+ 사진 칸에 끌어다 놓기).
   - 편집창 어디에 포커스가 있든 받되, 클립보드에 이미지가 있을 때만 가로챔(글자만이면 입력칸에 그대로).
   - 받으면 전파를 멈춤 — 안 그러면 페이지 전역 붙여넣기 처리가 같은 사진을 인박스 입력칸에 담고
     인박스 탭으로 넘어갔다.
   - 창이 닫히면 스스로 해제. 기존 파일 선택과 같은 처리(wishPrepImageFile)를 쓴다. */
const { readIndex, sliceBlock, runner } = require('./lib');
const html = readIndex();
const t = runner('위시리스트 사진 붙여넣기');
const ed = sliceBlock(html, 'function wishOpenEditor(item){', '/* 추가 비용 + 합산 */');

t.ok('파일 선택·붙여넣기·끌어놓기가 같은 처리(이미지 파일만)', /function addImageFiles\(files\)\{\s*files=\(files\|\|\[\]\)\.filter\(function\(f\)\{ return f&&\/\^image\\\/\/\.test\(f\.type\|\|''\); \}\);[\s\S]{0,200}wishPrepImageFile\(files\[i\+\+\]/.test(ed) && /addImageFiles\(files\);\s*\}\);/.test(ed));
t.ok('문서 전체(캡처 단계)에서 받음 — 입력칸에 포커스가 있어도', /document\.addEventListener\('paste',onPaste,true\);/.test(ed));
t.ok('이미지 있을 때만 가로채고 전파 중단', /if\(addImageFiles\(files\)\)\{ e\.preventDefault\(\); e\.stopPropagation\(\); if\(e\.stopImmediatePropagation\)e\.stopImmediatePropagation\(\);/.test(ed));
t.ok('창이 닫히면 해제', /if\(!document\.body\.contains\(ov\)\)\{ document\.removeEventListener\('paste',onPaste,true\); return; \}/.test(ed));
t.ok('사진 칸에 끌어다 놓기', /thumbsBox\.addEventListener\('drop',function\(e\)\{[\s\S]{0,160}addImageFiles\(Array\.prototype\.slice\.call\(fs\)\)/.test(ed) && /\.wish-thumbs\.drop\{/.test(html));
t.ok('키보드 기기엔 안내(⌘V/Ctrl+V), 터치 기기엔 생략', /rdsIsTouch\(\)\)\?'':\(' · 복사한 사진은 '\+\(\/Mac\|iPhone\|iPad\/\.test/.test(ed));
t.done();
