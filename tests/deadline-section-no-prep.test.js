'use strict';
/* 목록 '마감일' 섹션은 실제 마감 대상만 보여준다.
   - '준비 할일'(연결 준비)은 대상의 마감일을 물려받을 뿐 자기 마감이 아니므로 제외
     (마감일 섹션에 뜨면 실제 마감 할일과 중복돼 보임).
   - 하위 할일도 상위 아래로 묶이므로 개별로 안 넣는다.
   - 마감일이 그날이고 계획 날짜가 다른 '진짜 마감 대상'은 그대로 보인다. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner("목록 '마감일' 섹션: 준비 할일 제외");

const block = sliceBlock(html, 'function renderDueDateSection(container){', 'function renderByCategory(container,vt){');
function due(taskList, sel){
  var captured = [];
  const ctx = {
    tasks: taskList, selDate: sel, activeCat: 'all',
    _taskCatMatch: function(){ return true; },
    _taskById: function(id){ return taskList.find(function(x){return String(x.id)===String(id);})||null; },
    taskIsNested: function(x){ return !!(x&&x.parentId); },
    orderTaskSubset: function(l){ return l; },
    renderSection: function(container,title,items){ captured = items.map(function(x){return x.id;}); },
    String,
  };
  // 실제 _taskIsLinkPrep을 로드해 쓴다
  const prepBlock = sliceBlock(html, 'function _taskIsLinkPrep(t){', 'function dlOnlyFilter(list){');
  vm.createContext(ctx);
  vm.runInContext(prepBlock, ctx);
  vm.runInContext(block, ctx);
  ctx.renderDueDateSection({});
  return captured;
}

var DL='2026-10-10';
var real = { id:1, text:'과제 제출', catId:'uni', date:'2026-10-07', deadlineDate:DL };      // 진짜 마감 대상(다른 날 계획)
var prep = { id:2, text:'준비: 과제', catId:'uni', date:'2026-10-08', deadlineDate:DL, sourceTaskId:'1' }; // 준비 할일
var kid  = { id:3, text:'초안', catId:'uni', date:'2026-10-09', deadlineDate:DL, parentId:1 };  // 하위
var quizDay = { id:4, text:'화학 퀴즈', catId:'schedule', date:DL, deadlineDate:DL };            // date===sel → 원래도 제외

var got = due([real, prep, kid, quizDay], DL);
t.ok('진짜 마감 대상(1)은 마감일 섹션에 표시', got.indexOf(1)>=0, got);
t.ok('준비 할일(2)은 제외', got.indexOf(2)<0, got);
t.ok('하위 할일(3)은 제외', got.indexOf(3)<0, got);
t.ok('date===selDate(4)는 원래대로 제외', got.indexOf(4)<0, got);

// 대상(그날 마감·그날 계획)이 date===sel라 원래도 제외 + 그 준비도 제외 → 섹션 빔(중복 해소)
var prep4 = { id:5, text:'준비: 화학 퀴즈', catId:'schedule', date:'2026-10-08', deadlineDate:DL, sourceTaskId:'4' };
var got2 = due([quizDay, prep4], DL);
t.ok('대상+그 준비만 있으면 마감일 섹션 비어 있음(중복 해소)', got2.length===0, got2);

// ── 소스 배선 ──
t.ok('renderDueDateSection이 준비 할일 제외', /if\(typeof _taskIsLinkPrep==='function'&&_taskIsLinkPrep\(t\)\)return false;/.test(html));
t.ok('renderDueDateSection이 하위 할일 제외', /\/\* 하위 할일도 상위 아래로 묶여[\s\S]*?if\(typeof taskIsNested==='function'&&taskIsNested\(t\)\)return false;\s*return t\.deadlineDate===selDate&&t\.date!==selDate;/.test(html));

t.done();
