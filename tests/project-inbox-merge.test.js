'use strict';
/* 프로젝트 상세 인박스: '처리할 인박스'와 '미분류 인박스' 두 칸 → 하나의 '인박스' 칸.
   미분류(아직 프로젝트 없는 항목)는 머리의 '미분류 N' 버튼을 눌렀을 때만 같은 칸 안에 펼쳐서
   → 담기 / 끌어다 놓기 / 모두 확인 완료로 처리한다. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('프로젝트 인박스 한 칸 + 미분류 펼치기');

const ctx = { String, Array, Object, Date, inboxItems: [] };
vm.createContext(ctx);
vm.runInContext(sliceBlock(html, 'var _pjDragInboxId=null;', 'function projectAssignInbox(p,it){'), ctx);
ctx.inboxItems.push({ id: 1, text: 'a', projectId: 'p' }, { id: 2, text: 'b' }, { id: 3, text: 'c', done: true }, { id: 4, text: 'd', pjDismiss: ['p'] }, { id: 5, text: 'e', pjDismiss: ['q'] });
t.ok('미분류 = 프로젝트 없음 · 안 끝남 · 이 프로젝트에서 확인 완료 안 함', ctx.projectUnfiledInboxItems({ id: 'p' }).map((x) => x.id).join() === '2,5');
t.ok('펼침 상태는 프로젝트마다(기본 접힘)', typeof ctx._pjUnfiledOpen === 'object' && !ctx._pjUnfiledOpen.p);

t.ok('두 칸 → 하나의 인박스 칸', /_sl\('inbox','인박스'\)/.test(html) && !/'처리할 인박스'/.test(html) && !/class="section-card pjd-unfiledcol"/.test(html) && !/'<div class="pjd-inboxrow">'/.test(html));
t.ok('미분류는 버튼(개수)으로만, 있을 때만 보임', /\(unfN\?'<button type="button" class="pji-unf-toggle'\+\(unfOpen\?' on':''\)\+'" id="pji-unf-toggle" aria-expanded="'\+unfOpen\+'"/.test(html) && /\(\(unfOpen&&unfN\)\?'<div class="pji-unf-panel" id="pji-unf-panel">/.test(html));
t.ok('버튼 = 펼치기/접기', /bind\('pji-unf-toggle',function\(\)\{ var k=String\(p\.id\); _pjUnfiledOpen\[k\]=!_pjUnfiledOpen\[k\]; renderProjects\(\); \}\);/.test(html));
t.ok('펼친 목록은 기존 처리 그대로(→ 담기 · 끌어다 놓기 · 모두 확인 완료)', /projectUnfiledInboxHtml\(p\)\+'<\/div>'/.test(html) && /data-assign=/.test(html) && /id="project-unfiled-dismissall"/.test(html) && /var _inboxDrop=detail\.querySelector\('#pjd-inboxcol'\);/.test(html));
t.ok('터치: 버튼 44px 터치 영역, 손잡이 숨김', /\.pji-assign::after,\.pji-unf-toggle::after\{content:'';position:absolute;left:0;right:0;top:50%;height:var\(--tap\)/.test(html) && /\.pji-grip\{display:none\}/.test(html));
t.done();
