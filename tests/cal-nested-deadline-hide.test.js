'use strict';
/* 하위 할일(부모가 있는 것)은 달력에서 상위 아래로 접혀 개별 pill이 안 보인다.
   같은 이유로 하위 할일은 달력에서
   (1) 자기 '마감' 칩도 안 그리고
   (2) 자기 마감 연결(화살표)도 안 그린다.
   → 상위 할일의 마감/연결만 남아, 하위항목이 '연결 필요 대상'처럼 잘못 인식돼
     마감 칩·화살표가 중복되던 문제를 없앤다. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('달력: 하위 할일 마감 칩·연결 제외');

// ── 소스 배선 ──
// (1) dlTasks(마감 칩) 필터에 nested 제외가 들어있다
t.ok('마감 칩 필터가 nested 제외',
  /var dlTasks=\(dlDay\[dkey\]\|\|\[\]\)\.filter\(function\(t\)\{return [\s\S]*?&& !\(typeof taskIsNested==='function'&&taskIsNested\(t\)\) &&[\s\S]*?\}\);/.test(html));

// (2) renderDlCanvas 연결 수집에서 nested 스킵
t.ok('연결(화살표) 수집이 nested 스킵',
  /if\(\(!task\.deadlineId&&!task\.deadlineDate\)\|\|!task\.date\)return;\s*if\(task\.done\)return;[\s\S]*?if\(typeof taskIsNested==='function'&&taskIsNested\(task\)\)return;/.test(html));

// pill 접힘(기존 동작)도 유지 — _calCollapseGoals가 nested 제외
t.ok('pill(_calCollapseGoals)도 nested 제외 유지',
  /if\(typeof taskIsNested==='function'&&taskIsNested\(t\)\)return;/.test(html));

// ── 런타임: 연결 수집 필터를 슬라이스해 nested가 빠지는지 확인 ──
// renderDlCanvas 안의 '연결 수집' 루프만 분리 실행(수집 배열만 검증).
const block = sliceBlock(html,
  '  var sameRowConns=[],crossRowConns=[];',
  '  /* ── Lane assignment');
function collect(taskList){
  const ctx = {
    tasks: taskList,
    taskIsNested: function(x){ return !!(x&&x.parentId); },
    dlState: function(){ return 'safe'; },
    taskDaysBetweenKeys: function(){ return 3; },
    cellBox: function(){ return {left:0,right:10,top:0,bottom:10}; },
    String, Math, Date,
  };
  vm.createContext(ctx);
  vm.runInContext(block, ctx);
  return ctx.sameRowConns.concat(ctx.crossRowConns).map(function(c){return c.task.id;});
}
var P={id:1, date:'2026-10-01', deadlineDate:'2026-10-10'};
var C={id:2, parentId:1, date:'2026-10-05', deadlineDate:'2026-10-10', deadlineId:'1'};
var conns=collect([P,C]);
t.ok('연결 수집: 상위(1)만 포함', conns.indexOf(1)>=0, conns);
t.ok('연결 수집: 하위(2)는 제외', conns.indexOf(2)<0, conns);

t.done();
