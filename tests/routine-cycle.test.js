'use strict';
/* 루틴 완료 칸 = 창(상태 메뉴) 없이 탭만으로 상태 순환:
   없음 → 완료 → 건너뜀 → 쉼 → 없음. 길게 누르면 기존 메뉴로 직접 선택도 가능.
   루틴 탭(.rt-check)과 홈 빠른 습관(state-pick) 모두 같은 순환을 쓴다. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('루틴 완료 칸 순환');

// ── 순수 로직: routineCycleState ──
const block = sliceBlock(html, "var ROUTINE_STATE_CYCLE=['','done','skip','rest'];", 'routineStateButtonsHtml=function(state){');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(block, ctx);
t.ok('없음 → 완료', ctx.routineCycleState('')==='done');
t.ok('완료 → 건너뜀', ctx.routineCycleState('done')==='skip');
t.ok('건너뜀 → 쉼', ctx.routineCycleState('skip')==='rest');
t.ok('쉼 → 없음(순환 복귀)', ctx.routineCycleState('rest')==='');
t.ok('알 수 없는 값은 완료부터', ctx.routineCycleState('???')==='done');
t.ok('undefined도 완료부터', ctx.routineCycleState(undefined)==='done');

// ── 소스 배선 ──
t.ok('루틴 탭 완료 탭이 순환 사용(토글 아님)', /var cur=lg\[id\]\.state\|\|'';var next=routineCycleState\(cur\);rtApplyCompletionLock\(id,lg\[id\],next\);/.test(html));
t.ok('완료 칸 aria-label에 순환 안내', /data-routine-check aria-label="탭하면 상태 순환: 완료 → 건너뜀 → 쉼 → 없음 \(길게 눌러 메뉴\)"/.test(html));
t.ok('길게 누르면 상태 메뉴(직접 선택) 유지', /lpTimer=setTimeout\(function\(\)\{longFired=true;lpTimer=null;openStateMenu\(\);\},420\);/.test(html));
t.ok('데스크톱 우클릭도 상태 메뉴(모바일 롱프레스와 동일)', /btn\.addEventListener\('contextmenu',function\(e\)\{e\.preventDefault\(\);openStateMenu\(\);\}\);/.test(html));
t.ok('홈 빠른 습관도 같은 순환 사용', /var _next=\(typeof routineCycleState==='function'\)\?routineCycleState\(today\[id\]\.state\|\|''\):/.test(html));

t.done();
