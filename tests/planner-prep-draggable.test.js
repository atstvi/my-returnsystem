'use strict';
/* 계획창(1일) 종일 줄: '준비 할일'(연결 준비)은 목표 카테고리(예: schedule)를
   물려받아도 고정 일정 칩(클릭 전용)이 아니라, 다른 할일처럼 끌어서 시간 배치할 수
   있는 untimed 칩으로 취급한다.

   버그: homeMakeLinkedTask가 준비 할일의 catId를 대상(마감/일정)에서 물려받아
   (catId:target.catId), 대상이 일정(schedule)이면 준비 할일도 catId='schedule'이 돼
   종일 줄에서 _adSched(고정 일정, 드래그 불가)로 분류됐다.

   수정: _isSchedLike(t) = (schedule|_isTt|allDay) && !_taskIsLinkPrep(t).
   → 준비 할일은 _adSched에서 빠지고 _adUntimed(드래그 가능)로 들어간다. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('계획창: 준비 할일 드래그 가능(종일 줄)');

// ── 소스 배선 ──
t.ok('_isSchedLike가 준비 할일 제외',
  /var _isSchedLike=function\(t\)\{ return \(t\.catId==='schedule'\|\|t\._isTt\|\|t\.allDay\) && !\(typeof _taskIsLinkPrep==='function'&&_taskIsLinkPrep\(t\)\); \};/.test(html));
t.ok('_adSched가 _isSchedLike 사용',
  /var _adSched=dayTasks\.filter\(function\(t\)\{return !\(\/\^\\d\{1,2\}:\\d\{2\}\$\/\.test\(String\(t\.timeStart\|\|''\)\)\) && _isSchedLike\(t\);\}\);/.test(html));
t.ok('_adUntimed가 _isSchedLike로 제외',
  /var _adUntimed=dayTasks\.filter\(function\(t\)\{return t&&!t\.done&&!t\._travelOnly && !\(\/\^\\d\{1,2\}:\\d\{2\}\$\/\.test\(String\(t\.timeStart\|\|''\)\)\) && !_isSchedLike\(t\);\}\);/.test(html));

// ── 런타임: _taskIsLinkPrep로 준비/일반/일정 구분 ──
const block = sliceBlock(html, 'function _taskIsLinkPrep(t){', 'function dlOnlyFilter(list){');
function mkPredicate(taskList){
  const ctx = { tasks: taskList, String, Array };
  vm.createContext(ctx);
  vm.runInContext(block, ctx);
  // 소스와 동일한 _isSchedLike 정의를 재현해 분류 검증
  ctx._isSchedLike = function(t){ return (t.catId==='schedule'||t._isTt||t.allDay) && !(typeof ctx._taskIsLinkPrep==='function'&&ctx._taskIsLinkPrep(t)); };
  return ctx;
}
var quiz = { id:500, text:'화학 퀴즈', catId:'schedule', date:'2026-07-01', deadlineDate:'2026-07-01' };
var prep = { id:501, text:'준비: 화학 퀴즈', catId:'schedule', date:'2026-07-01', deadlineId:'500', sourceTaskId:'500' };
var floor= { id:502, text:'바닥청소', catId:'etc', date:'2026-07-01' };
const ctx = mkPredicate([quiz, prep, floor]);

t.ok('준비 할일은 _taskIsLinkPrep 참', ctx._taskIsLinkPrep(prep)===true);
t.ok('일정 자체는 _taskIsLinkPrep 거짓', ctx._taskIsLinkPrep(quiz)===false);

// 종일 줄 분류(=_isSchedLike): 필터는 !_isSchedLike(t)로 쓰이므로 truthy/falsy만 본다
// (일정만 truthy=고정, 준비/일반은 falsy=드래그). 일반 할일은 undefined(falsy)일 수 있음.
t.ok('일정(화학 퀴즈)은 고정 칩(_adSched)', !!ctx._isSchedLike(quiz)===true);
t.ok('준비 할일은 드래그 칩(untimed)', !ctx._isSchedLike(prep));
t.ok('일반 할일은 드래그 칩(untimed)', !ctx._isSchedLike(floor));

t.done();
