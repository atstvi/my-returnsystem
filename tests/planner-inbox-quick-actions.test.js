'use strict';
/* 계획창 인박스 정리 메뉴: (1) 처리 필요 해제·완료·삭제 빠른 처리
   (2) 프로젝트 목표로 넣으면 '지금' 시간 — 목표 대표 블록 위치를 미완료 멤버 기준으로 잡아
       완료한 이른 시각 멤버 때문에 엉뚱한 시각에 보이던 문제 수정. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('계획창 인박스 빠른 처리·목표 지금 배치');

const triage = sliceBlock(html, 'function _planInboxTriage(id){', '\nfunction _planSchedule(kind,pid,sm){');
t.ok('빠른 처리 버튼 3개', /id="pt-unneed"[\s\S]*?처리 필요 해제/.test(triage) && /id="pt-done"[\s\S]*?완료/.test(triage) && /id="pt-del"[\s\S]*?삭제/.test(triage));
t.ok('처리 필요 해제: unread만 끔(항목 유지)', /#pt-unneed'\)\.addEventListener\('click',function\(\)\{ it\.unread=false; it\.updatedAt=Date\.now\(\); if\(typeof saveInboxItems==='function'\)saveInboxItems\(\);/.test(triage));
t.ok('완료: done + unread 해제', /#pt-done'\)\.addEventListener\('click',function\(\)\{ it\.done=true; it\.unread=false;/.test(triage));
t.ok('삭제: 확인 후 제거 + 저장(autoTombstone)', /openConfirmDialog\('인박스 항목 삭제'/.test(triage) && /inboxItems=inboxItems\.filter\(function\(x\)\{ return String\(x\.id\)!==String\(it\.id\); \}\);\s*if\(typeof saveInboxItems==='function'\)saveInboxItems\(\);/.test(triage));
t.ok('목표 할일은 지금 시간 슬롯', /var slot=_nowSlot\(\);\s*var extra=\{ catId:'project', projectId:String\(p\.id\), date:_planToday\(\), timeStart:slot\.ts, timeEnd:slot\.te \};/.test(triage));

// 목표 대표 위치: 미완료 멤버 기준
const repBlock = sliceBlock(html, 'function _planGoalReps(START,END){', '\nfunction _planShiftDay(n){');
const all = [
  { id: 1, goalId:'g1', date:'2026-10-07', timeStart:'00:10', timeEnd:'00:40', done:true },
  { id: 2, goalId:'g1', date:'2026-10-07', timeStart:'14:00', timeEnd:'15:00', done:false },
];
const ctx = { String, Math, tasks: all, _planDate:'2026-10-07',
  findGoal: () => ({ goal:{ title:'문헌 조사' }, project:{ id:'p1' } }),
  taskEffectiveDone: (x) => !!x.done,
  _planMins: (hm) => { const [h,m] = hm.split(':').map(Number); return h*60+m; } };
vm.createContext(ctx); vm.runInContext(repBlock, ctx);
const reps = ctx._planGoalReps(0, 24);
t.ok('미완료 멤버(14:00) 기준 위치 — 완료한 00:10이 끌어올리지 않음', reps.length === 1 && reps[0].sm === 14*60, reps[0] && reps[0].sm);
all[1].done = true;
const reps2 = ctx._planGoalReps(0, 24);
t.ok('다 완료면 전체 기준(블록은 완료로 남음)', reps2.length === 1 && reps2[0].sm === 10);
t.done();
