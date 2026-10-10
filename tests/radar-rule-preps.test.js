'use strict';
/* 활성 규칙(키워드)이 할일 이름을 보고 만든 준비 할일이 마감 레이더에서 빠지던 문제.
   (1) 시간표 수업(예: '화학 실험')에 연결된 준비 → 수업이 레이더 대상이 아니라 무시됨
   (2) 반복 할일 회차(예: 매주 '물리 과제 제출')는 키워드 규칙 원본에서 빠져 준비 자체가 안 생김
   계약: 수업은 준비가 연결돼 있으면 대상. 반복 회차는 결정적 키(repeat:<규칙>:<날짜>)로 연결해
   기기마다 회차 id가 달라도 같은 준비 하나. 회차가 사라지면 준비도 정리. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('레이더: 활성 규칙 준비(수업·반복 회차)');

const rb = sliceBlock(html, 'var RADAR_DEADLINE_RE=', 'window.returnDeadlineRadar=returnDeadlineRadar;');
const ctx = { Math, String, Object, Array, Date, isNaN, parseInt }; vm.createContext(ctx); vm.runInContext(rb, ctx);
const TK = '2026-10-10';
const rules = [{ id:'k1', triggerType:'keyword', matchText:'실험', taskText:'실험 예비보고서', offsetDays:2 },
               { id:'k2', triggerType:'keyword', matchText:'제출', taskText:'제출 준비', offsetDays:2 }];
const r = ctx.returnDeadlineRadar({ todayKey: TK, rules, repeatItems:[{ id:'r1', freq:'weekly', weekdays:'4', text:'물리 과제 제출' }], tasks: [
  { id:'tt_a', text:'화학 실험', catId:'uni', date:'2026-10-14', timeStart:'09:00', _isTt:true, sourceType:'timetable' },
  { id:'tt_b', text:'영어', catId:'uni', date:'2026-10-14', timeStart:'13:00', _isTt:true, sourceType:'timetable' },
  { id:'p1', text:'실험 예비보고서', date:'2026-10-12', _ruleGen:true, _ruleId:'k1', sourceTaskId:'tt_a', deadlineId:'tt_a', deadlineDate:'2026-10-14' },
  { id:'gen_X', text:'물리 과제 제출', date:'2026-10-15', _repeatId:'r1', scheduleKey:'repeat:r1:2026-10-15' },
  { id:'p2', text:'제출 준비', date:'2026-10-13', _ruleGen:true, _ruleId:'k2', sourceTaskId:'repeat:r1:2026-10-15', deadlineId:'gen_OTHER', deadlineDate:'2026-10-15' },
]});
const by = n => r.items.find(i => i.title === n);
t.ok('준비가 연결된 시간표 수업은 레이더 대상(일정)', by('화학 실험') && by('화학 실험').kind === 'schedule' && by('화학 실험').state === 'planned' && by('화학 실험').work[0].task.id === 'p1');
t.ok('준비 없는 수업은 레이더에 안 나옴(소음 X)', !by('영어'));
t.ok('반복 회차 준비는 결정적 키로 회차에 연결(회차 id가 달라도)', by('물리 과제 제출') && by('물리 과제 제출').state === 'planned' && by('물리 과제 제출').work[0].task.id === 'p2');
t.ok('활성 규칙 ⚙ 표시', by('화학 실험').ruleTag === '“실험” → 2일 전 준비' && by('물리 과제 제출').ruleTag === '“제출” → 2일 전 준비');
t.ok('준비 할일 자체는 대상 아님', !by('실험 예비보고서') && !by('제출 준비'));

t.ok('생성: 키워드 규칙이 반복 회차(예상 회차)도 원본으로 — 결정적 키', /if\(!re\|\|re\.type!=='repeat'\|\|!re\.task\)return;/.test(html) && /var expR=buildRuleExpected\(rule,dueR,occTask,re\.scheduleKey\);/.test(html));
t.ok('재조정: repeat: 원본은 회차가 남아 있을 때만 유지', /if\(sourceTaskId\.indexOf\('repeat:'\)===0\)\{\n        var occ=\(tasks\|\|\[\]\)\.find\(function\(x\)\{ return x&&!x\._travelOnly&&generatedTaskKey\(x\)===sourceTaskId; \}\);\n        if\(!occ\)return null;/.test(html));
t.ok('규칙이 만든 할일은 원본에서 제외(연쇄 방지 — 반복 회차만 추가)', /function generatedSourceTasks\(\)\{\n  return \(tasks\|\|\[\]\)\.filter\(function\(t\)\{return t&&!isGeneratedTask\(t\)&&!t\._travelOnly;\}\);/.test(html));
t.done();
