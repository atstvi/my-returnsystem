'use strict';
/* 계획창 (1) 타임라인 클릭 생성 블록은 이름을 입력해야 추가된다 — 빈 Enter·ESC·blur면 버림.
          (2) 타임블록을 오른쪽 '인박스' 섹션에 놓으면 다시 '처리 필요' 인박스 항목으로 전환. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('계획창 초안 블록·인박스로 되돌리기');

// ── (1) 초안 ──
const create = sliceBlock(html, 'function _planCreateTask(sm,em){', '\nfunction _planBindGridCreate(grid){');
t.ok('생성 시 저장하지 않음(초안)', !/saveTaskData/.test(create.slice(0, create.indexOf('function _planDiscardDraft'))));
t.ok('빈 확정 → 버림', /if\(!v\)\{ _planDiscardDraft\(t\); renderPlanner\(\); return; \}/.test(html));
t.ok('ESC → 버림', /else if\(e\.key==='Escape'\)\{ committed=true; _planEditId=null; _planDiscardDraft\(t\); renderPlanner\(\); \}/.test(html));
t.ok('이름 있으면 저장', /live\.text=v; live\.updatedAt=Date\.now\(\); if\(typeof saveTaskData==='function'\)saveTaskData\(\);/.test(html));
(function(){
  const store = { task_items_v1: '[]' }; const removed = [];
  const ctx = { JSON, String, Date, Math, localStorage:{ getItem:k=>store[k]||null }, tasks:[],
    _planMinToDT:(m)=>({date:'2026-10-07',min:m}), _planHM:(m)=>String(m),
    returnRemoveTasks:(l)=>{ removed.push(l[0].id); ctx.tasks=ctx.tasks.filter(x=>l.indexOf(x)<0); return l.length; } };
  ctx._taskById = (id) => ctx.tasks.find(x => String(x.id) === String(id)) || null;
  vm.createContext(ctx); vm.runInContext(create, ctx);
  const d = ctx._planCreateTask(600, 660);
  t.ok('초안은 메모리에만', ctx.tasks.length === 1 && store.task_items_v1 === '[]');
  ctx._planDiscardDraft(d);
  t.ok('저장 안 된 초안 버리기 → 메모리에서 제거(삭제 기록 없음)', ctx.tasks.length === 0 && removed.length === 0);
  const d2 = ctx._planCreateTask(600, 660); store.task_items_v1 = JSON.stringify([{ id: d2.id }]); /* 다른 저장으로 이미 저장됨 */
  ctx._planDiscardDraft(d2);
  t.ok('이미 저장된 초안은 공용 삭제 경로(tombstone)', removed.length === 1 && ctx.tasks.length === 0);
})();

// ── (2) 인박스로 되돌리기 ──
const toInbox = sliceBlock(html, 'function _planTaskToInbox(t){', 'window._planTaskToInbox=_planTaskToInbox;');
function mk(tasks, inbox){
  const calls = { removed: [], savedInbox: 0, toasts: [] };
  const ctx = { String, Date, Math, Array, tasks, inboxItems: inbox,
    showToast: (m) => calls.toasts.push(m), saveInboxItems: () => { calls.savedInbox++; return true; },
    returnRemoveTasks: (l) => { calls.removed = calls.removed.concat(l.map(x => x.id)); ctx.tasks = ctx.tasks.filter(x => l.indexOf(x) < 0); return l.length; },
    isRepeatSourceTask: (x) => !!x._src, taskChildren: (id) => ctx.tasks.filter(x => String(x.parentId) === String(id)) };
  ctx._taskById = (id) => ctx.tasks.find(x => String(x.id) === String(id)) || null;
  vm.createContext(ctx); vm.runInContext(toInbox, ctx);
  return { ctx, calls };
}
{
  const e = mk([{ id: 2, inboxId:'555', text:'교수님께 메일 보내기', note:'인박스에서 계획' }], [{ id: 555, text:'교수님께 메일', unread:false, done:false }]);
  const ok = e.ctx._planTaskToInbox(e.ctx.tasks[0]);
  const it = e.ctx.inboxItems[0];
  t.ok('인박스에서 온 할일 → 원래 항목을 처리 필요로(중복 없음)', ok && e.ctx.inboxItems.length === 1 && it.unread === true && it.done === false);
  t.ok('계획 중 고친 제목 유지', it.text === '교수님께 메일 보내기');
  t.ok('할일은 공용 삭제 경로로 제거', e.calls.removed.join() === '2' && e.calls.savedInbox === 1);
}
{
  const e = mk([{ id: 1, text:'회의 준비', note:'안건 3개', projectId:'p1', imgs:['a'] }], []);
  e.ctx._planTaskToInbox(e.ctx.tasks[0]);
  const it = e.ctx.inboxItems[0];
  t.ok('일반 할일 → 새 처리 필요 항목(메모·프로젝트·이미지 유지)', it && it.unread && !it.done && it.text === '회의 준비\n안건 3개' && it.projectId === 'p1' && it.imgs.length === 1 && it.cat === 'task');
}
for (const [label, task, extra] of [
  ['시간표 수업 거절', { id:'tt_1', _isTt:true, text:'화학' }],
  ['반복 원본 거절', { id: 7, _src:true, text:'생일' }],
  ['하위 있는 할일 거절', { id: 8, text:'상위' }, { id: 9, parentId: 8, text:'하위' }],
  ['목표 대표 거절', { id: 'g', _planGoalRep:true }],
]) {
  const e = mk(extra ? [task, extra] : [task], []);
  const ok = e.ctx._planTaskToInbox(task);
  t.ok(label, ok === false && e.calls.removed.length === 0 && e.ctx.inboxItems.length === 0 && e.calls.toasts.length === 1);
}
t.ok('드래그 놓기 배선', /if\(moved&&overInbox\)\{ _planTaskToInbox\(t\); renderPlanner\(\); return; \}/.test(html) && /overInbox=_planInboxDropHover\(lx,ly\);/.test(html));
t.ok('인박스 섹션 표식', /' data-sec="inbox"'/.test(html));
t.ok('인박스에서 만든 할일은 출처 기억(inboxId)', (html.match(/inboxId:String\(it\.id\)/g) || []).length === 2);
t.done();
