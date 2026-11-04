'use strict';
/* 할일을 완료하면 준비물(prepItems)도 모두 체크. 완료를 취소하면 '자동으로 체크한 것'(_autoDone)만
   되돌리고, 완료 전에 직접 체크해 둔 준비물은 그대로 둔다. 모든 완료 경로가 지나는
   taskCascadeDoneToChildren에 붙어 있어 목록·나탭·계획창·모달·여러 개 선택·알림 어디서 완료해도 같다. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('할일 완료 → 준비물도 완료');

const ctx = { Date, Object, Array, String, Number, JSON, window: {}, tasks: [] };
vm.createContext(ctx);
vm.runInContext(sliceBlock(html, 'function _taskById(', 'function saveTaskData(){'), ctx);
vm.runInContext(sliceBlock(html, 'function taskCheckToggle(task){', "return task.done?'done':'undone';") + "return task.done?'done':'undone';\n}", ctx);
ctx.saveTaskData = () => {};

const mk = () => ({ id: 1, text: '수업', done: false, updatedAt: 1, prepItems: [{ text: '노트북', done: true }, { text: '충전기', done: false }, { text: '교재', done: false }] });
const st = (x) => x.prepItems.map((p) => (p.done ? 1 : 0)).join('');
{
  const a = mk(); ctx.tasks = [a];
  t.ok('완료 → 준비물 모두 체크', ctx.taskCheckToggle(a) === 'done' && st(a) === '111' && a.updatedAt > 1);
  t.ok('자동으로 체크한 것만 표시', !a.prepItems[0]._autoDone && a.prepItems[1]._autoDone && a.prepItems[2]._autoDone);
  ctx.taskCheckToggle(a);
  t.ok('완료 취소 → 자동 체크만 되돌리고, 직접 체크한 노트북은 그대로', st(a) === '100' && !a.prepItems.some((p) => p._autoDone));
}
{
  const a = mk(); ctx.tasks = [a];
  ctx.taskCheckToggle(a); a.prepItems[1].done = true; delete a.prepItems[1]._autoDone; /* 직접 다시 누름(목록 체크와 같음) */
  ctx.taskCheckToggle(a);
  t.ok('완료 뒤 직접 만진 준비물은 완료 취소에도 유지', st(a) === '110');
}
{
  const p = { id: 1, text: '여행', done: false, prepItems: [] };
  const k = { id: 2, parentId: 1, text: '짐 싸기', done: false, prepItems: [{ text: '여권', done: false }] };
  ctx.tasks = [p, k];
  ctx.taskCheckToggle(p);
  t.ok('상위 완료 → 하위 할일의 준비물까지', k.done && k.prepItems[0].done);
}
{
  const c = mk(); c.canceled = true; c.done = true; ctx.tasks = [c];
  ctx.taskCascadeDoneToChildren(c);
  t.ok('계획 취소된 할일은 준비물을 건드리지 않음', st(c) === '100');
  const n = { id: 3, text: '준비물 없음', done: true };
  t.ok('준비물 없는 할일은 그대로', ctx.taskCascadeDoneToPrep(n) === false);
}

/* 다른 완료 경로도 같은 cascade를 지남 */
t.ok('모달 체크: cascade 후 준비물 요약 갱신', /mc\.onclick=function\(\)\{task\.done=!task\.done;if\(typeof taskCascadeDoneToChildren==='function'\)taskCascadeDoneToChildren\(task\);[^}]*setTaskPrepSummary\(task\.prepItems\|\|\[\]\);\};/.test(html));
t.ok('여러 개 선택 완료/취소도 cascade + updatedAt', /function bulkDone\(\)\{[^\n]*t\.updatedAt=Date\.now\(\);if\(typeof taskCascadeDoneToChildren==='function'\)taskCascadeDoneToChildren\(t\);/.test(html)
  && /function bulkUndone\(\)\{[^\n]*taskCascadeDoneToChildren\(t\)/.test(html));
t.ok('알림에서 완료도 cascade', /function notifItemDone[\s\S]{0,400}t\.done=true; t\.updatedAt=Date\.now\(\); if\(typeof taskCascadeDoneToChildren==='function'\)taskCascadeDoneToChildren\(t\);/.test(html));
t.ok('나탭 우선순위 매트릭스 체크는 공통 경로(taskCheckToggle)', /className = 'eisen-check'[\s\S]{0,400}if \(typeof taskCheckToggle === 'function'\) taskCheckToggle\(t\);/.test(html));
t.ok('준비물 직접 체크 시 자동 표시 지움(목록·나탭·작업대)', /pp\.done=!pp\.done; delete pp\._autoDone;/.test(html) && /pi\[idx\]\.done=!pi\[idx\]\.done; delete pi\[idx\]\._autoDone;/.test(html) && /it\.done=!it\.done; delete it\._autoDone;/.test(html));
t.ok('시간표 재조정도 자동 표시 유지', /if\(keep&&keep\._autoDone&&out\.done\)out\._autoDone=1;/.test(html));

t.done();
