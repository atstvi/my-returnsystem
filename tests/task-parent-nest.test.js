'use strict';
/* 상·하위 할일(부모/자식) 모델 — task.parentId 로 진짜 할일끼리의 종속관계를
   만든다. 하위 할일은 최상위 목록/달력에서 숨고 상위 할일 아래에 렌더된다.

   taskSetParent 의 안전장치를 고정한다:
   - 자기 자신을 부모로 지정 금지
   - 순환(자기 자식을 부모로) 방지
   - 한 단계만 — 부모가 되는 할일을 다시 하위로 넣으면 그 자식들은 새 부모로 승격
   - 하위로 넣으면 goalId(목표 그룹)와 상호배타로 비워짐
   - parentId 를 비우면 종속 해제 */

const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'function _taskById(', 'function syncDeadlineCompletions(');

function makeCtx(taskList) {
  const sb = {
    tasks: taskList,
    Date: Date,
    taskEffectiveDone: (t) => !!(t && t.done),
  };
  const ctx = vm.createContext(sb);
  vm.runInContext(block, ctx);
  return ctx;
}
function T(id, extra){ return Object.assign({ id:id, text:'t'+id, done:false, updatedAt:0 }, extra||{}); }

const r = runner('task parent/child nesting — taskSetParent');

/* 1. 기본 종속 + goalId 상호배타 */
{
  const A=T(1), B=T(2,{goalId:'g9'});
  const ctx=makeCtx([A,B]);
  const ok=vm.runInContext('taskSetParent(_taskById(2),1)',ctx);
  r.ok('setParent returns true', ok===true, ok);
  r.ok('B.parentId === A', String(B.parentId)==='1', B.parentId);
  r.ok('B.goalId cleared (mutually exclusive)', B.goalId==='', JSON.stringify(B.goalId));
  r.ok('taskChildren(1) = [B]', vm.runInContext('taskChildren(1).length',ctx)===1, 'len');
  r.ok('taskIsNested(B) true', vm.runInContext('taskIsNested(_taskById(2))',ctx)===true, 'nested');
  r.ok('taskIsNested(A) false', vm.runInContext('taskIsNested(_taskById(1))',ctx)===false, 'A not nested');
}

/* 2. 자기 자신 금지 */
{
  const A=T(1);
  const ctx=makeCtx([A]);
  const ok=vm.runInContext('taskSetParent(_taskById(1),1)',ctx);
  r.ok('self-parent rejected', ok===false && A.parentId==null, 'ok='+ok+' pid='+A.parentId);
}

/* 3. 순환 방지 — B가 A의 자식일 때 A를 B 아래로 넣기 시도 → 거부 */
{
  const A=T(1), B=T(2);
  const ctx=makeCtx([A,B]);
  vm.runInContext('taskSetParent(_taskById(2),1)',ctx); // B under A
  const ok=vm.runInContext('taskSetParent(_taskById(1),2)',ctx); // try A under B
  r.ok('cycle rejected', ok===false, 'ok='+ok);
  r.ok('A stays top-level', A.parentId==null, 'A.parentId='+A.parentId);
}

/* 4. 한 단계 유지 — 부모(A, 자식 B)를 C 아래로 넣으면 B도 C로 승격 */
{
  const A=T(1), B=T(2), C=T(3);
  const ctx=makeCtx([A,B,C]);
  vm.runInContext('taskSetParent(_taskById(2),1)',ctx); // B under A
  vm.runInContext('taskSetParent(_taskById(1),3)',ctx); // A under C → B promoted to C
  r.ok('A under C', String(A.parentId)==='3', A.parentId);
  r.ok('B promoted to C (no 2-level)', String(B.parentId)==='3', B.parentId);
  r.ok('taskChildren(C) has A and B', vm.runInContext('taskChildren(3).length',ctx)===2, 'len');
  r.ok('taskChildren(A) empty', vm.runInContext('taskChildren(1).length',ctx)===0, 'A kids');
}

/* 5. 대상이 이미 자식이면 그 위(부모)로 붙어 한 단계 유지 */
{
  const A=T(1), B=T(2), X=T(9);
  const ctx=makeCtx([A,B,X]);
  vm.runInContext('taskSetParent(_taskById(2),1)',ctx);   // B under A
  vm.runInContext('taskSetParent(_taskById(9),2)',ctx);   // X onto B(자식) → X under A
  r.ok('drop onto a child re-targets its parent', String(X.parentId)==='1', X.parentId);
}

/* 6. 종속 해제 */
{
  const A=T(1), B=T(2);
  const ctx=makeCtx([A,B]);
  vm.runInContext('taskSetParent(_taskById(2),1)',ctx);
  vm.runInContext('taskSetParent(_taskById(2),null)',ctx);
  r.ok('unnest clears parentId', B.parentId==null, 'pid='+B.parentId);
  r.ok('taskIsNested false after unnest', vm.runInContext('taskIsNested(_taskById(2))',ctx)===false, 'nested');
}

/* 7. taskChildrenDone 집계 */
{
  const A=T(1), B=T(2,{done:true}), C=T(3);
  const ctx=makeCtx([A,B,C]);
  vm.runInContext('taskSetParent(_taskById(2),1)',ctx);
  vm.runInContext('taskSetParent(_taskById(3),1)',ctx);
  const stat=vm.runInContext('taskChildrenDone(1)',ctx);
  r.ok('children done count 1/2', stat.done===1 && stat.total===2, JSON.stringify(stat));
}

r.done();
