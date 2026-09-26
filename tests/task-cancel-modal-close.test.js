'use strict';
/* 계획 취소 → 다른 할일 드래그 시 취소가 되돌려지던 (로컬) 버그.
   원인: 할일 모달은 열 때 taskModalSnapshot(수정 이전 상태)을 찍고, 닫을 때
   tasks[idx]=taskModalSnapshot으로 '커밋 안 된 편집'을 되돌린다(Escape/취소 UX).
   그런데 모달의 '계획 취소' 버튼은 setTaskCanceled로 이미 커밋+저장한 뒤 그냥
   tasksCloseModal()을 불러서, 닫기가 취소 이전 스냅샷을 되돌려 써 취소가 무효화됐다.
   화면엔 setTaskCanceled의 renderPlanner로 잠깐 취소가 보였다가, 다음 렌더(다른 할일
   드래그)에서 되돌려진 in-memory tasks를 읽어 취소가 사라졌다.
   수정: 삭제 버튼처럼, 계획 취소도 닫기 전에 taskModalSnapshot=null로 비운다. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('계획 취소: 모달 닫기 스냅샷 되돌림 방지');

// ── 소스 배선: 계획 취소 버튼이 닫기 전에 스냅샷을 비운다 ──
t.ok('계획 취소 버튼: setTaskCanceled 후 스냅샷 null 후 닫기',
  /_cxlBtn\.onclick=function\(\)\{ setTaskCanceled\(task, !task\.canceled\); taskModalSnapshot=null; tasksCloseModal\(\); \};/.test(html));
t.ok('삭제 버튼도 커밋 동작이라 스냅샷 비움(패턴 회귀 확인)', /taskModalSnapshot=null;\s*if\(typeof noteGeneratedTaskDeleted/.test(html));

// ── 런타임: tasksCloseModal이 스냅샷이 있으면 되돌리고, 없으면 커밋을 유지 ──
const block = sliceBlock(html, 'function tasksCloseModal(){', 'function closeModal(){');
function mkCtx(){
  const ctx = {
    tasks: [{ id: 1, text: 'A', done: false, canceled: false }],
    editId: 1,
    taskModalSnapshot: null,
    taskModalDraft: null,
    taskModalEl: { classList: { remove(){} } },
    document: { getElementById(){ return null; } },
    renderList(){}, renderCal(){},
    String,
  };
  vm.createContext(ctx);
  return ctx;
}

// (버그 재현) 스냅샷이 남아 있으면 닫기가 취소를 되돌린다
let ctx = mkCtx();
ctx.taskModalSnapshot = JSON.parse(JSON.stringify(ctx.tasks[0])); // open 시점(un-canceled)
ctx.tasks[0].canceled = true; ctx.tasks[0].done = true;            // setTaskCanceled 커밋
vm.runInContext(block, ctx);
ctx.tasksCloseModal();
t.ok('스냅샷 안 비우면 → 취소 되돌려짐(버그 재현)', ctx.tasks[0].canceled === false);

// (수정 동작) 계획 취소 버튼처럼 스냅샷을 비우면 취소가 유지된다
ctx = mkCtx();
ctx.taskModalSnapshot = JSON.parse(JSON.stringify(ctx.tasks[0]));
ctx.tasks[0].canceled = true; ctx.tasks[0].done = true;
ctx.taskModalSnapshot = null; // ← 수정: 커밋된 취소이므로 스냅샷 제거
vm.runInContext(block, ctx);
ctx.tasksCloseModal();
t.ok('스냅샷 비우면 → 취소 유지(수정)', ctx.tasks[0].canceled === true && ctx.tasks[0].done === true);

t.done();
