'use strict';
/* 반복 '원본'(생일·기념일 등) 규칙 유실 시 삭제 대신 복원(self-heal).
   회귀 배경: repeat_items_v1은 union-merge가 아니라 클라우드 덮어쓰기라, 스테일
   클라우드가 규칙 행을 지우면 repairGeneratedTasks가 규칙 없는 반복 할일을 통째로
   삭제했다("생일 추가한 게 다 없어짐"). 의도적 삭제(deleteHomeRepeat)는 non-done
   원본의 _repeatId까지 지우므로, _repeatId가 'ri_task_'+id로 남아있는 것은 '삭제'가
   아니라 '규칙 유실' → 원본은 지우지 말고 규칙을 task에서 복원해야 한다. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(
  html,
  'function repeatTaskIsHealableSource(t){',
  'window.repeatRuleFromSourceTask=repeatRuleFromSourceTask;'
);
const ctx = { Date, taskTodayKeyLocal: () => '2026-09-07', window: {} };
vm.createContext(ctx);
vm.runInContext(block, ctx);
const isSrc = ctx.repeatTaskIsHealableSource;
const fromTask = ctx.repeatRuleFromSourceTask;

const t = runner('반복 원본 규칙 유실 복원');

// ── 원본 판별: _repeatId === 'ri_task_'+id 인 것만 복원 대상 ──
t.ok('원본(ri_task_+자기id) → 복원 대상',
  isSrc({ id: 42, _repeatId: 'ri_task_42', _repeat: { kind: 'yearly' } }) === true);
t.ok('생성본(occurrence: _repeatId=다른 task 규칙) → 복원 대상 아님',
  isSrc({ id: 999.123, _repeatId: 'ri_task_42', occurrenceDate: '2027-03-15', _repeat: { kind: 'yearly' } }) === false);
t.ok('반복 아닌 일반 할일 → 대상 아님',
  isSrc({ id: 7, _repeatId: '', _repeat: false }) === false);
t.ok('_repeatId 없음(의도적 삭제로 _repeatId 제거된 상태) → 대상 아님',
  isSrc({ id: 42, _repeat: { kind: 'yearly' } }) === false);

// ── 규칙 재구성: syncTaskRepeatItem과 같은 형태 ──
const bday = {
  id: 42, text: '엄마 생일', catId: 'etc', priority: '',
  date: '2026-03-15', timeStart: '', timeEnd: '',
  _repeatId: 'ri_task_42',
  _repeat: { kind: 'yearly', month: 3, monthDay: 15 }
};
const rule = fromTask(bday);
t.ok('규칙 id = ri_task_+id', rule.id === 'ri_task_42');
t.ok('freq = yearly', rule.freq === 'yearly');
t.ok('text 보존', rule.text === '엄마 생일');
t.ok('월/일 앵커 보존', rule.month === 3 && rule.monthDay === 15);
t.ok('startDate = task.date', rule.startDate === '2026-03-15');

// 음력 생일 앵커도 보존
const lunar = fromTask({ id: 5, text: '할머니 생신', date: '2026-01-20',
  _repeatId: 'ri_task_5', _repeat: { kind: 'yearly', lunar: true, lunarMonth: 1, lunarDay: 1 } });
t.ok('음력 앵커 보존', lunar.lunar === 1 && lunar.lunarMonth === 1 && lunar.lunarDay === 1);

// monthDay 미지정이면 task.date의 일(day)로
const noAnchor = fromTask({ id: 8, text: '기념일', date: '2026-07-09',
  _repeatId: 'ri_task_8', _repeat: { kind: 'yearly' } });
t.ok('monthDay 기본값 = task.date의 일', noAnchor.monthDay === 9);

// ── 실제 실행 경로 배선 ──
// 예전 단언은 '실행되지 않는' 옛 repairGeneratedTasks 본문(나중에 reconcileGeneratedTasks
// 래퍼로 덮어써짐)만 정규식으로 확인해, 치유가 실제로는 한 번도 돌지 않는데도 통과했다
// (규칙 유실 시 생일 원본이 삭제됨 — Playwright로 재현). 이제 live 경로를 런타임으로 검증한다.
t.ok('reconcileGeneratedTasks가 먼저 치유를 호출', /function reconcileGeneratedTasks\(opts\)\{\s*opts=opts\|\|\{\};\s*if\(typeof tasks==='undefined'\|\|!Array\.isArray\(tasks\)\)return 0;\s*try\{ healMissingRepeatRules\(\); \}catch\(_e\)\{\}/.test(html));
t.ok('repairGeneratedTasks는 reconcile 래퍼(옛 본문 없음)', /repairGeneratedTasks=function\(opts\)\{return reconcileGeneratedTasks\(/.test(html) && !/function repairGeneratedTasks\(opts\)\{/.test(html));
(function(){
  const healBlock = sliceBlock(html, 'function healMissingRepeatRules(){', '\nfunction reconcileGeneratedTasks(opts){');
  let stored = [];
  const tombs = {};
  const hctx = {
    String, JSON,
    repeatTaskIsHealableSource: ctx.repeatTaskIsHealableSource,
    repeatRuleFromSourceTask: ctx.repeatRuleFromSourceTask,
    loadRepeatItems: () => stored.slice(),
    setReturnStorageItem: (k, v) => { if (k === 'repeat_items_v1') stored = JSON.parse(v); return true; },
    returnTombstoneIsActive: (eid) => !!tombs[eid],
    generatedRepairLog: () => {},
    tasks: [
      { id: 42, text:'엄마 생일', date:'2026-11-15', _repeatId:'ri_task_42', _repeat:{kind:'yearly',month:11,monthDay:15} }, // 규칙 유실 → 복원
      { id: 43, text:'완료 원본', date:'2026-01-01', done:true, _repeatId:'ri_task_43', _repeat:{kind:'yearly'} },        // 완료 → 복원 안 함
      { id: 44, text:'지운 원본', date:'2026-02-01', _repeatId:'ri_task_44', _repeat:{kind:'yearly'} },                   // tombstone → 복원 안 함
      { id: 45.5, text:'생성본', date:'2027-11-15', _repeatId:'ri_task_42', occurrenceDate:'2027-11-15' },               // 생성본 → 대상 아님
    ],
  };
  tombs['t_44'] = true;
  vm.createContext(hctx); vm.runInContext(healBlock, hctx);
  const n = hctx.healMissingRepeatRules();
  const ids = stored.map(r => r.id).join(',');
  t.ok('규칙 유실된 미완료 원본만 복원', n === 1 && ids === 'ri_task_42', ids);
  t.ok('있는 규칙은 중복 복원 안 함', hctx.healMissingRepeatRules() === 0 && stored.length === 1);
})();

t.done();
