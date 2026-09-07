'use strict';
/* 계획 취소(Todoist류 '안 하기로 함') — 할일을 삭제하지 않고 '해결됨(미완료로 닫음)'.
   설계: canceled=true와 함께 done=true로 둬서, 기존의 모든 '미완료·밀림·마감 알림'
   로직(!t.done)이 자동으로 취소된 할일을 제외한다(수십 곳을 안 건드림). 표시(취소선·
   🚫 배지)와 토글 의미만 다르고, 되돌리면 미완료 계획으로 복귀. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const t = runner('계획 취소(안 하기로 함)');

// ── setTaskCanceled / toggle 로직(순수) ──
const block = sliceBlock(html, 'function taskIsCanceled(t){', 'window.taskIsCanceled=taskIsCanceled;');
const ctx = { Date, saveTaskData(){}, renderList(){}, renderCal(){}, renderHomeTasks(){}, window: {} };
vm.createContext(ctx);
vm.runInContext(block, ctx);
const { taskIsCanceled, setTaskCanceled, toggleTaskCanceled } = ctx;

var task = { id: 1, text: '스터디', done: false };
setTaskCanceled(task, true);
t.ok('취소하면 canceled=true', task.canceled === true);
t.ok('취소는 done=true로 닫음(모든 !t.done 로직이 자동 제외)', task.done === true);
t.ok('canceledAt 기록', typeof task.canceledAt === 'number' && task.canceledAt > 0);
t.ok('taskIsCanceled 참', taskIsCanceled(task) === true);

setTaskCanceled(task, false);
t.ok('되돌리면 canceled=false', task.canceled === false);
t.ok('되돌리면 done=false(다시 미완료 계획)', task.done === false);
t.ok('되돌리면 canceledAt 제거', !task.canceledAt);

toggleTaskCanceled(task);
t.ok('toggle로 취소', task.canceled === true && task.done === true);
toggleTaskCanceled(task);
t.ok('toggle로 복귀', task.canceled === false && task.done === false);

// ── 소스 배선 ──
// 모달 버튼
t.ok('모달에 계획 취소 버튼', /id="modal-cancelplan-btn"/.test(html));
t.ok('모달 버튼이 상태에 따라 라벨/동작 토글', /_cxlBtn\.onclick=function\(\)\{ setTaskCanceled\(task, !task\.canceled\); tasksCloseModal\(\); \}/.test(html));
// 행 렌더: canceled 클래스 + 배지 + 체크 복원
t.ok('행에 canceled 클래스', /\(task\.canceled\?' canceled':''\)/.test(html));
t.ok('취소 행은 done 클래스 대신 canceled', /task\.done&&!task\.canceled\?' done':''/.test(html));
t.ok('🚫 취소됨 배지', /if\(task\.canceled\)mkBadge\('b-canceled','🚫 취소됨'\);/.test(html));
t.ok('취소된 할일 체크 클릭은 되돌리기', /if\(task\.canceled\)\{setTaskCanceled\(task,false\);return;\}toggleDone/.test(html));
// 복제는 취소 상태 안 물려줌
t.ok('복제 시 canceled 해제', /delete copy\.canceled; delete copy\.canceledAt;/.test(html));
// 완료 정리에서 취소 항목 제외
t.ok('완료 정리가 취소 항목 보존', /items\.filter\(function\(t\)\{ return !t\.done \|\| t\.canceled; \}\)/.test(html));
// CSS
t.ok('취소 행 스타일(취소선+흐림)', /\.task-item\.canceled\{opacity/.test(html));
t.ok('취소 체크 대각선 표시', /\.task-check\.canceled::after/.test(html));

t.done();
