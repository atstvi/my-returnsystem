'use strict';
/* '마감일 할일'(요일 규칙·대상이 날짜인 할일 등 date===deadlineDate로 커플된 항목)
   편집창에서 '날짜'만 바꾸면 마감일도 함께 옮겨져 달력 '마감' 칩이 따라오게 한다.

   버그: 편집창엔 날짜·마감일 입력칸이 따로 있어, 날짜만 바꾸면 마감일 칸엔 옛 날짜가
   남아 그대로 되쓰여진다 → date는 옮겨가도 deadlineDate는 옛 날짜에 남아 달력의
   '마감' 칩이 안 움직인다("편집창엔 바뀌었는데 달력엔 그대로").

   규칙(_writeTaskFromModal):
   - 편집 전 date===deadlineDate(커플)였고, 마감일을 따로 손대지 않은 채(=여전히 옛
     날짜) 날짜만 옮겼다면 → 마감일도 새 날짜로 함께 옮긴다.
   - date≠deadlineDate(예: 연결 마감 준비 할일)면 커플 안 함 → 각자 유지.
   - 마감일 칸을 실제로 다른 값으로 바꿨으면(≠옛 날짜) 그 값 유지, 날짜만 옮김. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner("'마감일 할일' 날짜 변경 시 마감일 커플링");

const block = sliceBlock(html, 'function _writeTaskFromModal(task,fields){', 'function _setModalNotifSel(nl){');
function write(task, fields){
  const ctx = {
    Date, Object, parseInt, String,
    markTaskDateManualChange: function(){},
    _modalPrioTouched: false,
  };
  vm.createContext(ctx);
  vm.runInContext(block, ctx);
  ctx._writeTaskFromModal(task, fields);
  return task;
}
function baseFields(over){
  return Object.assign({
    text:'t', note:'', priority:'mid', deadlineTime:'', catId:'uni',
    timeStart:'', timeEnd:'', travelMin:0, isSpecial:false
  }, over||{});
}

// 1) date===deadlineDate 커플: 날짜만 6→13 → 마감일도 13으로 따라온다
{
  var task = { id:1, date:'2026-10-06', deadlineDate:'2026-10-06' };
  write(task, baseFields({ date:'2026-10-13', deadlineDate:'2026-10-06' }));
  t.ok('커플 항목: 날짜 옮기면 마감일도 함께', task.date==='2026-10-13' && task.deadlineDate==='2026-10-13', JSON.stringify({d:task.date,dl:task.deadlineDate}));
}

// 2) date≠deadlineDate(연결 준비 할일): 커플 안 함 → 각자 유지
{
  var task2 = { id:2, date:'2026-10-07', deadlineDate:'2026-10-10' };
  write(task2, baseFields({ date:'2026-10-05', deadlineDate:'2026-10-10' }));
  t.ok('비커플 항목: 날짜만 옮기고 마감일 유지', task2.date==='2026-10-05' && task2.deadlineDate==='2026-10-10', JSON.stringify({d:task2.date,dl:task2.deadlineDate}));
}

// 3) 마감일을 실제로 따로 바꿨으면(≠옛 날짜): 그 값 유지, 날짜는 그대로
{
  var task3 = { id:3, date:'2026-10-06', deadlineDate:'2026-10-06' };
  write(task3, baseFields({ date:'2026-10-06', deadlineDate:'2026-10-12' }));
  t.ok('마감일만 바꾸면 마감일 이동·날짜 유지', task3.date==='2026-10-06' && task3.deadlineDate==='2026-10-12', JSON.stringify({d:task3.date,dl:task3.deadlineDate}));
}

// 4) 마감일 없는 일반 할일: 날짜만 옮기고 마감일 안 생김
{
  var task4 = { id:4, date:'2026-10-06', deadlineDate:'' };
  write(task4, baseFields({ date:'2026-10-13', deadlineDate:'' }));
  t.ok('마감일 없으면 그대로 빈 값', task4.date==='2026-10-13' && !task4.deadlineDate, JSON.stringify({d:task4.date,dl:task4.deadlineDate}));
}

// 5) 커플 + 날짜/마감일 둘 다 같은 새 값으로: 정상 이동
{
  var task5 = { id:5, date:'2026-10-06', deadlineDate:'2026-10-06' };
  write(task5, baseFields({ date:'2026-10-20', deadlineDate:'2026-10-20' }));
  t.ok('둘 다 새 날짜면 그대로 이동', task5.date==='2026-10-20' && task5.deadlineDate==='2026-10-20', JSON.stringify({d:task5.date,dl:task5.deadlineDate}));
}

// ── 소스 배선: 커플링 가드가 _writeTaskFromModal에 있는지 ──
t.ok('_writeTaskFromModal에 커플링 로직', /if\(fields\.deadlineDate && _oldTaskDate && fields\.deadlineDate===_oldTaskDate && fields\.date && fields\.date!==_oldTaskDate\)\{[\s\S]*?deadlineDate:fields\.date/.test(html));

t.done();
