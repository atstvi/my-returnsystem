'use strict';
/* 마감 연결 인식 개선 + 달력 '마감만' 뷰 정리:
   1) _planLinkedFor: 정방향(할일→마감)뿐 아니라 역방향(마감.deadlineId→할일) 연결도 인식해
      '이미 연결됐는데 연결 할일 없음'으로 잘못 뜨는 문제 해결.
   2) 달력 마감만(dlOnly): 오로지 마감 칩만 보이게 — 연결 준비 할일은 숨기고
      (_taskIsLinkPrep), 할일/목표 pill(dayItems)도 숨기고, 숫자 배지도 없앤다(지저분함 제거). */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('마감 연결 인식·배지');

// ── _planLinkedFor: 정/역방향 연결 ──
const block = sliceBlock(html, 'function _planLinkedFor(dt, includeDone){', 'function _planPrepFor(dt){');
const ctx = { tasks: [], String: String };
vm.createContext(ctx);
vm.runInContext(block, ctx);
ctx.tasks = [
  {id:1, deadlineDate:'2026-09-25', deadlineId:'2'},      // 목표(역방향으로 2를 가리킴)
  {id:2, date:'2026-09-23'},                               // 역방향 연결 대상(할일)
  {id:3, deadlineDate:'2026-09-26'},                       // 목표(정방향 준비 있음)
  {id:4, date:'2026-09-24', sourceTaskId:'3'},             // 정방향 준비 for 3
  {id:5, deadlineDate:'2026-09-27'},                       // 연결 없음
  {id:6, date:'2026-09-20', sourceTaskId:'3', done:true}   // 3의 완료된 준비
];
t.ok('역방향(deadlineId) 연결 인식', ctx._planLinkedFor(ctx.tasks[0],false).some(function(x){return x.id===2;}));
t.ok('정방향(sourceTaskId) 연결 인식', ctx._planLinkedFor(ctx.tasks[2],false).some(function(x){return x.id===4;}));
t.ok('연결 없으면 빈 배열', ctx._planLinkedFor(ctx.tasks[4],false).length===0);
t.ok('includeDone=false는 완료 준비 제외', !ctx._planLinkedFor(ctx.tasks[2],false).some(function(x){return x.id===6;}));
t.ok('includeDone=true는 완료 준비 포함', ctx._planLinkedFor(ctx.tasks[2],true).some(function(x){return x.id===6;}));

// ── _taskIsLinkPrep / dlOnlyFilter ──
const block2 = sliceBlock(html, 'function _taskIsLinkPrep(t){', 'function taskMatchesSearch(t,q){');
const ctx2 = { tasks: [], String: String, Array: Array };
vm.createContext(ctx2);
vm.runInContext(block2, ctx2);
ctx2.tasks = [
  {id:1, deadlineDate:'2026-09-25'},                       // 목표
  {id:4, date:'2026-09-24', sourceTaskId:'1', deadlineDate:'2026-09-25'},  // 준비(마감일 물려받음)
  {id:9, date:'2026-09-24'}                                // 무관 할일
];
t.ok('_taskIsLinkPrep: sourceTaskId가 목표 가리키면 준비', ctx2._taskIsLinkPrep(ctx2.tasks[1])===true);
t.ok('_taskIsLinkPrep: 목표 자신은 준비 아님', ctx2._taskIsLinkPrep(ctx2.tasks[0])===false);
(function(){
  var filtered=ctx2.dlOnlyFilter(ctx2.tasks);
  t.ok('dlOnlyFilter: 목표는 남고 준비는 숨김', filtered.some(function(x){return x.id===1;}) && !filtered.some(function(x){return x.id===4;}));
})();

// ── 소스 배선 ──
t.ok('_planPrepFor는 _planLinkedFor(미완료)', /function _planPrepFor\(dt\)\{ return _planLinkedFor\(dt,false\); \}/.test(html));
t.ok('연결 있는데 미완료 준비 없으면 연결 완료 표시', /if\(_planLinkedFor\(dl,true\)\.length>0\)\{\s*return item2\('deadline',dl\.id,'🚩',dl\.text\|\|'마감',dlBadge,'✓ 연결 완료'/.test(html));
t.ok('마감은 미처리 개수에서 제외(마감일과 연결됨)', /remain=inbox\.length\+unlinked\.length\+overdue\.length;/.test(html) && !/\+dlNoPrep/.test(html));
t.ok('달력 마감칩: dlOnly면 준비 제외', /!\(dlOnly&&_taskIsLinkPrep\(t\)\)/.test(html));
t.ok('마감만 뷰: 할일/목표 pill(dayItems) 숨김', /dayItems\.forEach\(function\(it\)\{\s*if\(dlOnly\)return;/.test(html));
t.ok('숫자 배지 제거(_dlPrepDaysBefore 없음)', !/_dlPrepDaysBefore/.test(html));
t.ok('배지 CSS 제거', !/cal-dl-prep-badge/.test(html));

t.done();
