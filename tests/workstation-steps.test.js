'use strict';
/* 작업대 — 하위 할일(단계)을 순서대로: 진행 단계 · 다음 하위 할일로 바로 · 작업대에서 하위 할일 만들기 ·
   그 하위 할일 작업대 열기. 상위를 열면 그 하위들, 하위를 열면 형제들을 단계로(할일 목록 순서). */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('작업대 하위 할일(단계)');

const ctx = { String, Array, Object, Number, Date, JSON, TK: '2026-11-10', tasks: [], saves: 0 };
ctx._taskById = (id) => ctx.tasks.find((x) => String(x.id) === String(id)) || null;
ctx.taskChildren = (id) => ctx.tasks.filter((x) => x.parentId != null && String(x.parentId) === String(id));
ctx.taskParentOf = (x) => (x && x.parentId ? ctx._taskById(x.parentId) : null);
ctx.taskEffectiveDone = (x) => !!x.done;
ctx._wsPopSaveTasks = () => { ctx.saves++; };
vm.createContext(ctx);
vm.runInContext(sliceBlock(html, 'function _wsStepOwner(t){', '\n/* 작업대를 다른 할일로'), ctx);
vm.runInContext(sliceBlock(html, 'function _wsAddStep(owner, text){', '\nfunction _wsPopKey(e){'), ctx);
vm.runInContext(sliceBlock(html, 'function _wsStepsHtml(t, esc){', '\nfunction _wsPopRender(){'), ctx);
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

ctx.tasks.push({ id: 1, text: 'P', catId: 'work', date: '2026-11-12', projectId: 'pa' }, { id: 2, text: 'a', parentId: '1', done: true }, { id: 3, text: 'b', parentId: '1' }, { id: 9, text: 'other' }, { id: 4, text: 'c', parentId: '1' });
const P = ctx._taskById(1), B = ctx._taskById(3), C = ctx._taskById(4), O = ctx._taskById(9);
t.ok('상위를 열면 하위들이 단계, 하위를 열면 형제들이 단계', ctx._wsStepOwner(P) === P && ctx._wsStepOwner(B) === P && ctx._wsStepOwner(O) === null);
t.ok('다음 단계: 상위에선 첫 미완료, 하위에선 뒤쪽 첫 미완료', ctx._wsNextStep(P).id === 3 && ctx._wsNextStep(B).id === 4);
C.done = true; t.ok('뒤에 없으면 앞쪽 미완료, 다 끝나면 없음', ctx._wsNextStep(C).id === 3 && (B.done = true, ctx._wsNextStep(B) === null)); B.done = false; C.done = false;

let h = ctx._wsStepsHtml(B, esc);
t.ok('진행 단계 n/m + 진행 막대', /하위 할일 <span>1\/3<\/span>/.test(h) && /class="wsp-prog"[^>]*><i style="width:33%">/.test(h));
t.ok('지금 보는 단계 강조 · 순서 번호 · 누르면 그 작업대로', /class="wsp-step me"/.test(h) && /data-ws="sopen" data-id="4"/.test(h) && /<span class="wsp-sn">3<\/span>/.test(h));
t.ok('다음 버튼("다음: c →")', /class="wsp-next" data-ws="sopen" data-id="4">다음: <b>c<\/b> →/.test(h));
t.ok('상위에서 보면 "시작: …"', /시작: <b>b<\/b>/.test(ctx._wsStepsHtml(P, esc)));
const plain = ctx._wsStepsHtml(O, esc);
t.ok('하위 없는 할일은 입력 한 줄만(부산스럽지 않게)', /하위 할일로 나누기/.test(plain) && !/wsp-sec|wsp-prog|wsp-next/.test(plain));

const made = ctx._wsAddStep(P, '  d  ');
t.ok('작업대에서 하위 할일 추가: 마지막 단계로 · 상위 정보 물려받음 · 저장', made && made.parentId === '1' && made.text === 'd' && made.catId === 'work' && made.date === '2026-11-12' && made.projectId === 'pa' && ctx.taskChildren(1).slice(-1)[0] === made && ctx.saves === 1);
t.ok('빈 입력은 무시', ctx._wsAddStep(P, '   ') === null);

/* 배선 */
t.ok('창 구조: 상위 줄(↰ · n/m) + 단계 칸', /<div class="wsp-crumb" id="wsp-crumb"><\/div>/.test(html) && /<div class="wsp-steps" id="wsp-steps"><\/div>/.test(html) && /data-ws="sopen" data-id="'\+esc\(_par\.id\)\+'" title="상위 할일 작업대로">↰ /.test(html));
t.ok('단계 열기 · 체크', /else if\(a==='sopen'\)\{ _wsGoTask\(b\.getAttribute\('data-id'\)\); return; \}/.test(html) && /else if\(a==='sdone'\)\{[^\n]*taskCheckToggle\(sk\)/.test(html));
t.ok('스톱워치로 재던 중이면 기록하고 다음 할일로 이어서', /var carry=cur&&focusTimerState\.running&&String\(focusTimerState\.linkedTaskId\|\|''\)===String\(cur\.id\)&&focusTimerState\.mode==='stopwatch';/.test(html) && /if\(focusTimerElapsedMs\(\)>1000\)focusTimerLogSession\(focusTimerElapsedMs\(\)\);/.test(html));
t.ok('입력 중엔 다시 그리지 않음(글자 유지)', /if\(stEl&&!\(stInp&&d\.activeElement===stInp&&stInp\.value\)\)/.test(html));
t.done();
