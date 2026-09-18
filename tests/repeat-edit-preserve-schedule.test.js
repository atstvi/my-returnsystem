'use strict';
/* 반복 할일 편집에서 시간만 바꾸고 '모든 항목' 적용 시, 규칙의 스케줄(요일·기간·빈도)이
   통째로 날아가 → 규칙이 어긋나 → reconcile이 계획된 할일을 전부 지우던 버그의 회귀 방지.
   원인: 생성된 반복 항목의 task._repeat는 {kind}만 담고 있는데, syncTaskRepeatItem이
   그 얇은 _repeat로 규칙의 weekdays/startDate/endDate/monthDay/월/음력을 통째로 덮어써
   비워버렸음. 수정: _repeat에 값이 있을 때만 갱신하고 없으면 기존 규칙 값을 보존. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const t = runner('반복 편집 — 스케줄 보존');

const block = sliceBlock(html, 'function syncTaskRepeatItem(task){', 'function tasksOpenNewModal(seed){');

function makeCtx(store){
  var saved = null;
  var ctx = {
    TK: '2026-09-18',
    Date,
    parseInt,
    loadRepeatItems(){ return JSON.parse(JSON.stringify(store)); },
    saveRepeatItems(arr){ saved = arr; store = arr; },
    generateRepeatTasks(){ /* no-op */ },
    getSaved(){ return saved; }
  };
  vm.createContext(ctx);
  vm.runInContext(block, ctx);
  return ctx;
}

// 규칙: 주간(월/수/금), 시작·종료일 있음
function weeklyRule(){
  return [{ id:'rw', text:'헬스', catId:'health', priority:'', freq:'weekly',
    weekdays:'1,3,5', startDate:'2026-09-18', endDate:'2026-11-17',
    timeStart:'07:00', timeEnd:'08:00' }];
}

// (1) 얇은 _repeat({kind})로 시간만 바꿔 sync → 스케줄 전부 보존, 시간만 갱신
(function(){
  var ctx = makeCtx(weeklyRule());
  var occ = { id: 1, text:'헬스', catId:'health', date:'2026-09-21',
    timeStart:'09:00', timeEnd:'10:00', _repeatId:'rw', _repeat:{kind:'weekly'} };
  ctx.syncTaskRepeatItem(occ);
  var rule = ctx.getSaved().find(function(x){return x.id==='rw';});
  t.ok('요일 보존(1,3,5)', rule.weekdays === '1,3,5');
  t.ok('시작일 보존', rule.startDate === '2026-09-18');
  t.ok('종료일 보존', rule.endDate === '2026-11-17');
  t.ok('빈도 보존(weekly)', rule.freq === 'weekly');
  t.ok('시간은 갱신(09:00)', rule.timeStart === '09:00' && rule.timeEnd === '10:00');
  t.ok('제목·카테고리 갱신', rule.text === '헬스' && rule.catId === 'health');
})();

// (2) _repeat에 스케줄 값이 명시되면 그 값으로 갱신(보존이 변경을 막지 않음)
(function(){
  var ctx = makeCtx(weeklyRule());
  var occ = { id: 2, text:'헬스', catId:'health', date:'2026-09-22',
    timeStart:'07:00', timeEnd:'08:00', _repeatId:'rw',
    _repeat:{kind:'weekly', weekdays:[2,4], startDate:'2026-10-01'} };
  ctx.syncTaskRepeatItem(occ);
  var rule = ctx.getSaved().find(function(x){return x.id==='rw';});
  t.ok('명시된 요일로 변경(2,4)', rule.weekdays === '2,4');
  t.ok('명시된 시작일로 변경', rule.startDate === '2026-10-01');
})();

// ── 소스 배선: syncTaskRepeatItem이 보존형으로 바뀌었는지 ──
t.ok('freq 보존형', /item\.freq=rep\.kind\|\|item\.freq\|\|'daily';/.test(html));
t.ok('weekdays 보존형(값 있을 때만 갱신)', /if\(rep\.weekdays!==undefined && rep\.weekdays!==null\)\{[\s\S]*?\} else if\(item\.weekdays===undefined\)\{ item\.weekdays=''; \}/.test(html));
t.ok('endDate 보존형', /item\.endDate=rep\.until\|\|rep\.endDate\|\|item\.endDate\|\|'';/.test(html));

t.done();
