'use strict';
/* DAY PLANNER — 드래그로 하루를 계획하는 전체 화면.
   왼쪽 타임라인: 빈 곳 드래그로 새 블록 생성, 블록 이동/리사이즈, 탭하면 편집.
   오른쪽 트레이: 인박스·다가오는 마감·시간 미정 할일을 끌어와 시간에 배치.
   시간 계산(_planHM/_planMins)·겹침 열 배치(_planLayout) 순수 로직을 검증. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('데이 플래너');

// ── 순수 로직: _planHM / _planMins / _planLayout ──
const block = sliceBlock(html, 'function _planHM(m){', 'function _planBlockEl(');
const ctx = { parseInt, String, Math, dk:function(){return '2026-09-19';}, TK:'2026-09-19' };
vm.createContext(ctx);
vm.runInContext(block, ctx);

t.ok('_planHM(90)=01:30', ctx._planHM(90)==='01:30');
t.ok('_planHM(0)=00:00', ctx._planHM(0)==='00:00');
t.ok('_planHM(1439)=23:59', ctx._planHM(1439)==='23:59');
t.ok('_planMins(09:30)=570', ctx._planMins('09:30')===570);
t.ok('_planMins(빈값)=0', ctx._planMins('')===0);

// 겹치지 않는 두 블록 → 각각 1열
(function(){
  var r=ctx._planLayout([{timeStart:'07:00',timeEnd:'08:00'},{timeStart:'10:00',timeEnd:'11:00'}]);
  t.ok('안 겹치면 cols=1', r.every(function(o){return o.cols===1;}));
})();
// 겹치는 두 블록 → 2열, 서로 다른 col
(function(){
  var r=ctx._planLayout([{timeStart:'10:00',timeEnd:'11:30'},{timeStart:'10:30',timeEnd:'12:00'}]);
  t.ok('겹치면 cols=2', r.every(function(o){return o.cols===2;}));
  t.ok('겹치면 col 분리', r[0].col!==r[1].col);
})();
// timeEnd 없으면 +60분 기본
(function(){
  var r=ctx._planLayout([{timeStart:'09:00'}]);
  t.ok('종료 없으면 60분', (r[0].em-r[0].sm)===60);
})();

// ── 소스 배선 ──
t.ok('플래너 페이지 마크업', /<div id="page-planner" class="page-container">/.test(html) && /id="plan-grid"/.test(html) && /id="plan-tray"/.test(html));
t.ok('goPage에 planner 등록', /planner:  function\(\)\{ try\{ _initPlanner\(\); \}/.test(html) && /alwaysReinit = \{[^}]*planner:1\}/.test(html));
t.ok('홈 타임블록에 계획 진입 버튼', /id="htb-plan-btn"/.test(html) && /getElementById\('htb-plan-btn'\)[\s\S]{0,120}goPage\('planner'\)/.test(html));
t.ok('더보기 메뉴에 계획', /onclick="mMore\('planner'\)"/.test(html));
t.ok('빈 곳 드래그로 새 블록 생성', /function _planBindGridCreate\(grid\)\{[\s\S]*?_planCreateTask\(s,en\)/.test(html) && /function _planCreateTask\(sm,em\)\{[\s\S]*?tasks\.unshift\(t\)/.test(html));
t.ok('블록 이동/리사이즈', /function _planBindBlock\(el,t,o,START,SLOT_H,rz\)\{[\s\S]*?t\.timeStart=_planHM\(o\.sm\)[\s\S]*?t\.timeEnd=_planHM\(o\.em\)/.test(html));
t.ok('트레이 드래그로 시간 배치', /function _planBindTrayDrag\(item\)\{[\s\S]*?_planSchedule\(kind,pid,m\)/.test(html));
t.ok('배치: task/inbox/deadline 각각 처리', /function _planSchedule\(kind,pid,sm\)\{[\s\S]*?kind==='task'[\s\S]*?kind==='inbox'[\s\S]*?kind==='deadline'/.test(html));
t.ok('인박스 배치 시 처리됨 표시', /it\.unread=false;/.test(html));
t.ok('마감 배치 시 연결 준비 할일', /deadlineId:String\(dt\.id\), ?sourceTaskId:String\(dt\.id\)/.test(html));
t.ok('생성/이동/트레이 색은 twv 대비 규칙', /twvHexAlpha\(hex, ?done\?0\.2:0\.92\)/.test(html) && /twvTextColor\(hex\)/.test(html));

/* ── 다듬기: 컨텍스트 메뉴·날짜 이동·길이 프리셋·시간대 밴드·모바일 롱프레스 ── */
t.ok('블록 컨텍스트 메뉴(완료·타이머·복제·삭제)', /function _planBlockMenu\(t, ?x, ?y\)\{[\s\S]*?data-act="done"[\s\S]*?data-act="timer"[\s\S]*?data-act="dup"[\s\S]*?data-act="del"/.test(html));
t.ok('길이 프리셋(30/60/120)', /data-dur="30"[\s\S]*?data-dur="60"[\s\S]*?data-dur="120"/.test(html) && /t\.timeEnd=_planHM\(Math\.min\(sm\+dur/.test(html));
t.ok('메뉴에서 어제/내일 이동', /data-act="prevday"[\s\S]*?data-act="nextday"/.test(html) && /function shiftDay\(n\)\{[\s\S]*?markTaskDateManualChange\(t,nd\)/.test(html));
t.ok('타이머 시작 연동', /focusTimerStartForTask\(t\.id\)/.test(html));
t.ok('삭제는 tombstone 경로', /noteGeneratedTaskDeleted\(t\)/.test(html));
t.ok('좌우 가장자리 드래그로 날짜 이동', /function setEdge\(clientX\)\{[\s\S]*?edge-prev[\s\S]*?edge-next/.test(html) && /if\(dayShift!==0\)\{[\s\S]*?markTaskDateManualChange\(t,nd\)/.test(html));
t.ok('우클릭은 contextmenu만(좌클릭 가드)', /if\(e\.button&&e\.button!==0\)return;/.test(html));
t.ok('모바일 롱프레스로 생성(터치 arming)', /var isTouch=\(e\.pointerType==='touch'\)/.test(html) && /armTimer=setTimeout\(function\(\)\{ if\(!moved\)\{ armed=true; makeGhost\(\);/.test(html));
t.ok('롱프레스로 블록 메뉴', /lp=setTimeout\(function\(\)\{ if\(!moved\)\{ menuOpened=true;[\s\S]*?_planBlockMenu\(t,/.test(html));
t.ok('시간대 밴드(아침/저녁/밤)', /'dawn'\][\s\S]*?'evening'\][\s\S]*?'night'\]/.test(html) && /\.plan-band\.dawn\{/.test(html));
t.ok('시간대 밴드/컨텍스트/엣지 CSS', /\.plan-ctxmenu\{/.test(html) && /\.plan-main\.edge-prev::before/.test(html));

t.done();
