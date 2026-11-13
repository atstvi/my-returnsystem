'use strict';
/* 계획창 상위 할일 블록 = '그날 몫'.
   - 같은 상위라도 날짜가 다른 하위는 오늘 블록에 안 보인다(그 날짜 계획창에서 보임).
   - 오늘 하위를 다 끝내면 오늘 블록은 완료로 보인다(다른 날 하위가 남아도).
   - 블록 체크는 오늘 몫만 완료/해제 — 예전엔 상위를 완료로 바꿔 모든 날 하위가 한꺼번에 완료됐다.
   - 다른 날짜의 '시간 있는' 상위도 그날 하위가 있으면 그날 종일 줄에 칩으로(예전엔 어디에도 안 보임). */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('계획창 · 상위 할일은 그날 몫');

const ctx = { Date, Object, Array, String, Number, JSON, window: {}, tasks: [], saves: 0 };
vm.createContext(ctx);
vm.runInContext(sliceBlock(html, 'function _taskById(', 'function saveTaskData(){'), ctx);
vm.runInContext(sliceBlock(html, 'function taskCheckToggle(task){', "return task.done?'done':'undone';") + "return task.done?'done':'undone';\n}", ctx);
ctx.saveTaskData = () => { ctx.saves++; };

const D0 = '2026-11-13', D1 = '2026-11-14', DM = '2026-11-12';
const mk = () => {
  ctx.tasks = [
    { id: 700, text: '논문 수정', date: D0, timeStart: '10:00', done: false },
    { id: 701, text: '서론', date: D0, parentId: '700', done: true },
    { id: 702, text: '그림', date: D0, parentId: '700', done: false },
    { id: 703, text: '참고문헌', date: D1, parentId: '700', done: false },
    { id: 704, text: '어제 것', date: DM, parentId: '700', done: false },
  ];
  return ctx.tasks[0];
};
const st = () => ctx.tasks.slice(1).map((x) => (x.done ? 1 : 0)).join('');

{
  const p = mk();
  t.ok('오늘 블록엔 오늘 하위만', ctx.taskDayKids(p, D0).map((k) => k.text).join() === '서론,그림');
  t.ok('내일 블록엔 내일 하위만', ctx.taskDayKids(p, D1).map((k) => k.text).join() === '참고문헌');
  t.ok('오늘 몫이 남았으면 미완료로 보임', ctx.taskShownDoneOn(p, D0) === false);
  ctx.tasks[2].done = true;
  t.ok('오늘 몫을 다 끝내면 오늘은 완료로 보임(다른 날 하위가 남아도)', ctx.taskShownDoneOn(p, D0) === true && ctx.taskShownDoneOn(p, D1) === false && p.done === false);
}
{
  const p = mk();
  t.ok('체크 → 오늘 몫만 완료, 다른 날 하위는 그대로', ctx.taskDayToggle(p, D0) === 'done' && st() === '1100' && !p.done && ctx.saves > 0);
  t.ok('완료로 보이는 상태에서 다시 체크 → 오늘 몫만 해제', ctx.taskDayToggle(p, D0) === 'undone' && st() === '0000' && !p.done);
  t.ok('바꾼 하위만 updatedAt(동기화 LWW)', ctx.tasks[1].updatedAt > 0 && ctx.tasks[2].updatedAt > 0 && !ctx.tasks[3].updatedAt && !ctx.tasks[4].updatedAt);
}
{
  const p = mk(); p.done = true;
  ctx.tasks.forEach((x) => { x.done = true; });
  t.ok('이미 전체 완료면 평소처럼 상위 완료 해제', ctx.taskDayToggle(p, D0) === 'undone' && p.done === false);
  const q = { id: 800, text: '하위 없음', date: D0, done: false }; ctx.tasks = [q];
  t.ok('그날 하위가 없으면 평소 완료 토글', ctx.taskDayToggle(q, D0) === 'done' && q.done === true);
  const c = mk(); c.canceled = true;
  t.ok('계획 취소된 상위는 그날 완료로 보지 않음', (ctx.tasks[2].done = true) && ctx.taskShownDoneOn(c, D0) === false);
}

/* 배선 */
t.ok('계획창 블록: 그날 하위 · 그날 완료 · 체크는 그날 몫', /taskDayKids\(t,_dayKey\)/.test(html) && /var done=t\._planGoalRep \? _grDone : \(\(typeof taskShownDoneOn==='function'\)\?taskShownDoneOn\(t,_dayKey\)/.test(html) && /if\(typeof taskDayToggle==='function'\)taskDayToggle\(t,_dayKey\); else if\(typeof taskCheckToggle==='function'\)taskCheckToggle\(t\); renderPlanner\(\);/.test(html));
t.ok('블록 메뉴 완료/취소도 그날 몫', /if\(a==='done'\)\{ if\(typeof taskDayToggle==='function'\)taskDayToggle\(t,_dayKey\);/.test(html));
t.ok('여러 날 보기 블록도 그날 완료', /taskShownDoneOn\(t,key\)/.test(html));
t.ok('다른 날짜의 시간 있는 상위도 그날 하위가 있으면 종일 줄 칩', /if\(!_untimed\(p\)&&p\.date===_planDate\)return false;/.test(html) && !/if\(!_untimed\(p\)\|\|_isSchedLike\(p\)\|\|_nested\(p\)\)return false;/.test(html));

t.done();
