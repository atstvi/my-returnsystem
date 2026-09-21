'use strict';
/* 계획창(플래너) 여러 날 보기 — 할일탭 타임블록(TWV) 뷰를 대체.
   1일/2일/3일/1주 날 수 선택, >1이면 한눈에 보기(overview), 날짜/블록 탭 → 1일 편집 모드.
   할일탭 '계획' 버튼이 계획창을 전체화면으로 연다(항상 꽉차게 · '작게' 토글 버튼은 제거). */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('계획창 여러날 보기');

// ── _planColDates: 앵커부터 N개 날짜 ──
const block = sliceBlock(html, 'function _planColDates(){', 'function _planDayTimed(');
function _tpad(n){ return (n<10?'0':'')+n; }
const ctx = { Date, _planDate:'2026-09-20', _planDays:3, dk:function(d){ return d.getFullYear()+'-'+_tpad(d.getMonth()+1)+'-'+_tpad(d.getDate()); } };
vm.createContext(ctx);
vm.runInContext(block, ctx);
(function(){
  var cols=ctx._planColDates();
  t.ok('3일 = 앵커부터 3개', cols.length===3 && ctx.dk(cols[0])==='2026-09-20' && ctx.dk(cols[2])==='2026-09-22');
})();
ctx._planDays=1;
t.ok('1일 = 앵커 1개', ctx._planColDates().length===1);
ctx._planDays=7;
t.ok('1주 = 7개', ctx._planColDates().length===7 && ctx.dk(ctx._planColDates()[6])==='2026-09-26');

// ── 소스 배선 ──
t.ok('날 수 상태 + 작게 상태 변수', /var _planDays=1;/.test(html) && /var _planCompact=false;/.test(html));
t.ok('_planSetDays 클램프[1,2,3,7]+저장', /function _planSetDays\(n\)\{ n=\(\[1,2,3,7\]\.indexOf\(Number\(n\)\)>=0\)\?Number\(n\):1; _planDays=n; _planSetPrefs\(\{days:n\}\); renderPlanner\(\); \}/.test(html));
t.ok('prefs에 days 라운드트립', /if\(s\.days!=null\)_planDays=\(\[1,2,3,7\]\.indexOf\(Number\(s\.days\)\)>=0\?Number\(s\.days\):1\);/.test(html));
t.ok('renderPlanner가 >1이면 여러날 렌더로 분기', /function renderPlanner\(\)\{\s*_planRenderHead\(\);\s*if\(_planDays>1\)\{ _planRenderMulti\(\); return; \}/.test(html));
t.ok('헤더: 날 수 칩(1일/2일/3일/1주)', /\[\[1,'1일'\],\[2,'2일'\],\[3,'3일'\],\[7,'1주'\]\]\.map\(function\(o\)\{ return '<button type="button" class="plan-dpb'/.test(html));
t.ok('헤더: pl-multi/compact 클래스 토글', /shell\.classList\.toggle\('pl-multi',_planDays>1\);/.test(html) && /pg\.classList\.toggle\('plan-compact',!!_planCompact\);/.test(html));
t.ok('여러날 렌더 함수 존재', /function _planRenderMulti\(\)\{[\s\S]*?var cols=_planColDates\(\)/.test(html));
t.ok('날짜/열 헤더 탭 → 해당 날 1일 모드', /_planDate=k; _planSetDays\(1\);/.test(html));
t.ok('블록/칩 탭 → 할일 편집창', /var t=\(tasks\|\|\[\]\)\.find\(function\(x\)\{return String\(x\.id\)===String\(el\.getAttribute\('data-tid'\)\);\}\); if\(t&&typeof tasksOpenModal==='function'\)tasksOpenModal\(t\);/.test(html));
t.ok('네비 이동은 날 수만큼', /var step=n\*\(_planDays>1\?_planDays:1\);/.test(html));
t.ok("'작게' 토글 버튼 제거(안 쓰는 기능)", !/id="plan-size"/.test(html) && !/b\('plan-size'/.test(html));
t.ok('날 수 칩 위임 바인딩', /dp\.addEventListener\('click',function\(e\)\{ var btn=e\.target\.closest\('\[data-plan-days\]'\);/.test(html));

// ── 할일탭 '계획' 런처가 계획창 전체화면으로 (TWV 대체) ──
t.ok("할일탭 '계획' 버튼", /<button class="view-btn" data-view="planner"[^>]*>계획<\/button>/.test(html));
t.ok("'계획' 클릭 → 계획창 열기", /if\(btn\.dataset\.view==='planner'\)\{ _planReturnPage='tasks'; if\(typeof goPage==='function'\)goPage\('planner'\); return; \}/.test(html));

// ── TWV(할일탭 주간 타임블록 뷰) 완전 제거 ──
t.ok('TWV 요소 제거', !/id="task-week-view"/.test(html));
t.ok('TWV 렌더 함수 제거', !/function renderTaskWeekView/.test(html));
t.ok('TWV 뷰 CSS 제거', !/#task-week-view\{/.test(html) && !/\.twv-block\{/.test(html));
t.ok('TWV 상태 변수 제거', !/var _twvDays/.test(html) && !/var _twvAnchor/.test(html));
t.ok('공용 색 헬퍼는 유지(계획창이 사용)', /function twvCatColor\(/.test(html) && /function twvHexAlpha\(/.test(html) && /function twvTextColor\(/.test(html));

t.done();
