'use strict';
/* 타이머 '오늘' 집중 타임라인 + 완료 시 집중 기록 제안.
   - 기록이 없어도 타임라인을 보여 준다(예전엔 빈 안내만 떠서 끌어서 추가할 곳이 없었다).
   - 빈 시간: 마우스는 끌기/클릭, 터치는 길게 눌러 끌기/탭 → 기록 추가 창(시작·길이 채움).
   - 할일을 완료하면 '집중 기록으로 [추가]' 제안 — 공용 완료 경로(taskCheckToggle·taskDayToggle)에서
     띄운다. 예전엔 할일 목록 체크박스에만 붙어 있어 스와이프·메뉴·홈·계획창으로 완료하면 안 떴다. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('집중 타임라인 추가 · 완료 시 기록 제안');

/* 위치 → 시각/길이 */
const rctx = { Math };
vm.createContext(rctx);
vm.runInContext(sliceBlock(html, 'function _ftTimelineRange(y0,y1,pxPerMin,tap){', 'function _ftWireTimelineDrag(track){'), rctx);
const ppm = 56 / 60;
const R = (y0, y1, tap) => JSON.stringify(rctx._ftTimelineRange(y0, y1, ppm, tap));
t.ok('탭: 15분 단위로 내림 + 30분', R((9 * 60 + 37) * ppm, (9 * 60 + 37) * ppm, true) === JSON.stringify({ startMin: 9 * 60 + 30, durMin: 30 }));
t.ok('끌기: 5분 단위 시작·길이', R((14 * 60 + 2) * ppm, (15 * 60 + 13) * ppm, false) === JSON.stringify({ startMin: 14 * 60, durMin: 70 }));
t.ok('위로 끌어도 같은 범위', R((15 * 60 + 13) * ppm, (14 * 60 + 2) * ppm, false) === R((14 * 60 + 2) * ppm, (15 * 60 + 13) * ppm, false));
t.ok('아주 짧게 끌면 최소 5분', JSON.parse(R(600 * ppm, 601 * ppm, false)).durMin === 5);
t.ok('자정을 넘지 않음', (() => { const r = JSON.parse(R(1430 * ppm, 1500 * ppm, false)); return r.startMin + r.durMin <= 1440; })());
t.ok('맨 끝 탭도 하루 안', (() => { const r = JSON.parse(R(1439 * ppm, 1439 * ppm, true)); return r.startMin + r.durMin <= 1440 && r.durMin > 0; })());

/* 완료 → 제안 (공용 경로) */
const ctx = { Date, Object, Array, String, Number, JSON, window: {}, tasks: [], offers: [] };
vm.createContext(ctx);
vm.runInContext(sliceBlock(html, 'function _taskById(', 'function saveTaskData(){'), ctx);
vm.runInContext(sliceBlock(html, 'function taskCheckToggle(task){', "return task.done?'done':'undone';") + "return task.done?'done':'undone';\n}", ctx);
ctx.saveTaskData = () => {};
ctx.focusTimerOfferRecord = (task) => { ctx.offers.push(task.id); };
{
  const a = { id: 1, text: '보고서', done: false }; ctx.tasks = [a];
  ctx.taskCheckToggle(a);
  t.ok('완료하면 제안', ctx.offers.join() === '1');
  ctx.taskCheckToggle(a);
  t.ok('완료 해제는 제안 안 함', ctx.offers.join() === '1');
  const c = { id: 2, text: '취소됨', done: true, canceled: true }; ctx.tasks.push(c);
  ctx.setTaskCanceled = () => {};
  ctx.taskCheckToggle(c);
  t.ok('계획 취소 되돌리기는 제안 안 함', ctx.offers.join() === '1');
}
{
  ctx.offers = [];
  const D = '2026-11-22';
  ctx.tasks = [{ id: 10, text: '상위', date: D, done: false }, { id: 11, text: '하위', date: D, parentId: '10', done: false }];
  ctx.taskDayToggle(ctx.tasks[0], D);
  t.ok('계획창 그날 몫 완료도 제안(상위 기준)', ctx.offers.join() === '10');
  ctx.taskDayToggle(ctx.tasks[0], D);
  t.ok('그날 몫 해제는 제안 안 함', ctx.offers.join() === '10');
}
t.ok('홈 체크는 중복 제안 없음(공용 경로에 맡김)', !/renderHomeTasks\(\); if\(_r==='done'&&typeof focusTimerOfferRecord/.test(html));
t.ok('제안 자체는 기록 없는 할일만', /if\(focusTimerTaskHasRecord\(task\.id\)\)return;/.test(sliceBlock(html, 'function focusTimerOfferRecord(task){', 'function focusOfferToast(')));

/* 오늘 패널: 기록 없어도 타임라인 */
const today = sliceBlock(html, 'function focusTodayHtml(){', 'function _ftTimelineRange(');
t.ok('빈 상태에서 일찍 반환하지 않음(타임라인 그대로)', !/if\(!agg\.count\)\{\s*var empty=/.test(today) && /var timeline=hint\+'<div class="ftu-tl ftu-pane-body"/.test(today));
t.ok('기록 없으면 지금 시각 근처로 스크롤 + 현재 시각 선', /agg\.count\?[^:]+:Math\.max\(0,Math\.min\(23,_nowD\.getHours\(\)-2\)\)/.test(today) && /ftu-tl-now/.test(today));
t.ok('기록 목록이 비면 안내', /ftu-rec-empty/.test(today));

/* 제스처 배선 */
const drag = sliceBlock(html, 'function _ftWireTimelineDrag(track){', 'function wireFocusToday(root){');
t.ok('터치: 길게 누르면 범위 지정(그 전엔 스크롤)', /e\.pointerType==='touch'/.test(drag) && /LONG_MS=380/.test(drag) && /MOVE_TOL/.test(drag));
t.ok('터치: 길게 누른 뒤엔 스크롤 대신 끌기', /addEventListener\('touchmove',function\(e\)\{[\s\S]*?e\.preventDefault\(\);/.test(drag) && /\{passive:false\}/.test(drag));
t.ok('터치 탭·마우스 클릭도 추가(30분)', /open\(_ftTimelineRange\(s0\.y0,s0\.y0,pxPerMin,true\)\)/.test(drag) && /open\(_ftTimelineRange\(s0\.y0,y,pxPerMin,!drag\)\)/.test(drag));
t.ok('블록 위는 제외(공용 메뉴)', /if\(e\.target\.closest\('\.ftu-tl-block'\)\)return;/.test(drag));

t.done();
