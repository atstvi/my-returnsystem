'use strict';
/* 상위 할일의 '실제 완료'를 하위에 맞춘다(표시만이 아니라 done까지):
   - 하위를 모두 완료하면 상위도 실제 done=true.
   - 하위가 하나라도 미완료면 상위 done=false(양방향).
   - 상위 완료/해제 토글은 하위까지 전파(cascade) — syncParentCompletions와 짝.
   버그: 하위 완료 시 상위가 '보이기'만 완료였고 실제 취급은 미완료라, 상위를 따로
   눌러야 완료됐다. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('상위 할일 실제 완료 동기화(하위 반영)');

const block = sliceBlock(html, 'function _taskById(', 'function saveTaskData(){');
function mk(list){
  const ctx = { tasks:list, Date, String, Number };
  vm.createContext(ctx); vm.runInContext(block, ctx);
  return ctx;
}
function P(id,ex){ return Object.assign({id:id,text:'t'+id,done:false,updatedAt:0},ex||{}); }

// 1) 하위 모두 완료 → 상위 실제 done
{
  var ctx=mk([P(1),P(2,{parentId:1,done:true}),P(3,{parentId:1,done:false})]);
  ctx.syncParentCompletions();
  t.ok('1/2 완료 → 상위 미완료', ctx.tasks.find(x=>x.id===1).done===false);
  ctx.tasks.find(x=>x.id===3).done=true;
  ctx.syncParentCompletions();
  t.ok('2/2 완료 → 상위 실제 완료', ctx.tasks.find(x=>x.id===1).done===true);
}
// 2) 하위 하나 재오픈 → 상위 미완료(양방향)
{
  var ctx=mk([P(1,{done:true}),P(2,{parentId:1,done:true}),P(3,{parentId:1,done:true})]);
  ctx.tasks.find(x=>x.id===2).done=false;
  ctx.syncParentCompletions();
  t.ok('하위 재오픈 → 상위 미완료', ctx.tasks.find(x=>x.id===1).done===false);
}
// 3) cascade: 상위 완료 → 하위 모두 완료 / 해제 → 하위 모두 해제
{
  var ctx=mk([P(1),P(2,{parentId:1}),P(3,{parentId:1})]);
  var p=ctx.tasks.find(x=>x.id===1); p.done=true;
  ctx.taskCascadeDoneToChildren(p);
  t.ok('상위 완료 → 하위 전부 완료', ctx.tasks.find(x=>x.id===2).done===true && ctx.tasks.find(x=>x.id===3).done===true);
  p.done=false; ctx.taskCascadeDoneToChildren(p);
  t.ok('상위 해제 → 하위 전부 해제', ctx.tasks.find(x=>x.id===2).done===false && ctx.tasks.find(x=>x.id===3).done===false);
}
// 4) 손자까지 재귀 — 손자 완료로 자식·상위 모두 완료
{
  var ctx=mk([P(1),P(2,{parentId:1}),P(3,{parentId:2,done:true})]);
  ctx.syncParentCompletions();
  t.ok('손자 완료 → 자식·상위 모두 완료', ctx.tasks.find(x=>x.id===1).done===true && ctx.tasks.find(x=>x.id===2).done===true);
}
// 5) 취소된 상위는 안 건드림(canceled 불변식)
{
  var ctx=mk([P(1,{done:true,canceled:true}),P(2,{parentId:1,done:false})]);
  ctx.syncParentCompletions();
  t.ok('취소된 상위는 done 유지(불변식)', ctx.tasks.find(x=>x.id===1).done===true);
}

// ── 소스 배선 ──
t.ok('saveTaskData가 syncParentCompletions 호출', /syncDeadlineCompletions\(\);\s*if\(typeof syncParentCompletions==='function'\)syncParentCompletions\(\);/.test(html));
t.ok('toggleDone에 cascade', /task\.done=!task\.done;\s*task\.updatedAt=Date\.now\(\);\s*if\(typeof taskCascadeDoneToChildren==='function'\)taskCascadeDoneToChildren\(task\);/.test(html));
t.ok('taskCheckToggle에 cascade', /task\.done=!task\.done; task\.updatedAt=Date\.now\(\);\s*if\(typeof taskCascadeDoneToChildren==='function'\)taskCascadeDoneToChildren\(task\);/.test(html));
t.ok('모달 체크에 cascade', /mc\.onclick=function\(\)\{task\.done=!task\.done;if\(typeof taskCascadeDoneToChildren==='function'\)taskCascadeDoneToChildren\(task\);/.test(html));

t.done();
