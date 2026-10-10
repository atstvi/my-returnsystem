'use strict';
/* 상단 빠른 입력 Ctrl/Cmd+V 사진 첨부 — Inbox→인박스 사진, Task→할일 메모 사진(task.imgs),
   Log→프로젝트 로그 사진(log.imgs). 압축 → MediaStore 참조. 문서 전체 붙여넣기(인박스로 이동)보다
   먼저 가로채 페이지가 바뀌지 않게. 글자 붙여넣기는 그대로. */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('빠른 입력 사진 붙여넣기');

t.ok('입력칸 paste → 사진이면 가로채 대기열에(전파 차단)', /cinp\.addEventListener\('paste', function\(e\)\{ if\(typeof captureHandlePaste==='function'\)captureHandlePaste\(e\); \}\);/.test(html) && /e\.preventDefault\(\); e\.stopPropagation\(\); \/\* 문서 전체 붙여넣기\(인박스로 이동\) 막기 \*\//.test(html));
t.ok('글자만 붙여넣기는 건드리지 않음', /if\(!files\.length\)return false; \/\* 글자만 붙여넣기는 그대로 \*\//.test(html));
t.ok('압축 후 MediaStore 참조로 저장', /__compressDataUrl\(raw,1600,0\.82\)/.test(html) && /MediaStore\.put\(dataUrl,\{role:role,type:file\.type\}\)/.test(html));
t.ok('입력칸 앞 썸네일(빼기 가능)', /<span class="capture-thumbs" id="capture-thumbs" hidden><\/span>/.test(html) && /data-capimg="'\+i\+'"/.test(html));
t.ok('보낼 때 사진을 꺼내 대상에 첨부', /var _imgs = captureTakeImgs\(\); \/\* 붙여 둔 사진 — 대상에 첨부 \*\//.test(html));
t.ok('Task → 할일 메모 사진(task.imgs)', /tasks\.unshift\(\{id:Date\.now\(\),imgs:\(_imgs\.length\?_imgs:undefined\),text:_body,/.test(html) && /id:mainId, text:parsed\.text\|\|'새 할일', imgs:\(_capImgs\.length\?_capImgs:undefined\),/.test(html));
t.ok('Log → 프로젝트 로그 사진(log.imgs)', /quickAddLog\(text \|\| '사진', _imgs\);/.test(html) && /if \(imgs\.length\) _log\.imgs = imgs\.slice\(\);/.test(html));
t.ok('Inbox → 인박스 항목 사진(imgs)', /window\.ib2QuickCapture\(text, colId, _imgs\);/.test(html) && /var it=newItem\(text,colId\); if\(imgs\.length\)it\.imgs=imgs\.slice\(\);/.test(html));
t.ok('사진만 있어도 Enter/보내기로 담기', /if \(val\) homeCaptureAI\(val\); else homeCapture\(''\); \/\* 사진만 → 바로 첨부해 담기 \*\//.test(html) && /if \(!text && !captureHasImgs\(\)\) return;/.test(html));
t.done();
