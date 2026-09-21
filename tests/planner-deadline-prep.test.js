'use strict';
/* 데이 플래너 트레이 — '다가오는 마감'에서 이미 연결된 준비 할일이 있으면 새로 만들지
   않고(중복 방지) 그 준비 할일을 마감으로부터 며칠 전에 계획돼 있는지와 함께 보여주고,
   그 준비 할일을 오늘로 끌어 옮길 수 있게 한다. 준비 할일이 없을 때만 끌어서 새로 만든다. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('플래너 마감 준비 연결');

// ── 순수 로직: _planPrepFor / _planPickPrep ──
const block = sliceBlock(html, 'function _planPrepFor(dt){', 'function returnUnlinkedSchedules(){');
const ctx = { tasks: [] };
vm.createContext(ctx);
vm.runInContext(block, ctx);

ctx.tasks = [
  {id:1, text:'발표자료', deadlineDate:'2026-09-25'},                                  // 목표
  {id:2, text:'초안', date:'2026-09-23', deadlineId:'1', sourceTaskId:'1'},            // 연결 준비(정방향)
  {id:3, text:'리허설', date:'2026-09-22', _ruleSourceId:'1'},                          // 규칙 생성 준비
  {id:4, text:'무관 준비', date:'2026-09-20', sourceTaskId:'999', done:true},           // 완료 → 제외
  {id:5, text:'다른목표'}
];

const preps1 = ctx._planPrepFor({id:1});
t.ok('_planPrepFor: 정/규칙 연결 준비 수집', preps1.length===2 && preps1.some(x=>x.id===2) && preps1.some(x=>x.id===3));
t.ok('_planPrepFor: 완료 준비 제외', !preps1.some(x=>x.id===4));
t.ok('_planPrepFor: 무관 목표는 준비 없음', ctx._planPrepFor({id:5}).length===0);
t.ok('_planPickPrep: 날짜 이른 것 우선', ctx._planPickPrep(preps1).id===3); // 9/22 < 9/23
t.ok('_planPickPrep: 빈 배열 null', ctx._planPickPrep([])===null);
(function(){
  var undated=[{id:9,text:'x'}];
  t.ok('_planPickPrep: 날짜 없으면 첫 항목', ctx._planPickPrep(undated).id===9);
})();

// ── 소스 배선 ──
t.ok('준비 할일은 목표 마감 목록에서 제외', /var pref=String\(t\.sourceTaskId\|\|t\._ruleSourceId\|\|''\);\s*if\(pref && allT\.some\(function\(o\)\{return o&&String\(o\.id\)===pref&&String\(o\.id\)!==String\(t\.id\)/.test(html));
t.ok('두 줄 트레이 아이템 헬퍼(item2)', /function item2\(kind,id,ic,text,badge,sub,bc,subLink\)\{[\s\S]*?class="plan-tray-item two"/.test(html));
t.ok('연결 준비 있으면 그 준비를 드래그 대상(kind=task)', /return item2\('task',pp\.id,'🚩'/.test(html));
t.ok('마감으로부터 며칠 전인지 계산해 표시', /var pb=Math\.round\(\(new Date\(dl\.deadlineDate\+'T00:00'\)-new Date\(pp\.date\+'T00:00'\)\)\/86400000\);/.test(html) && /마감 '\+pb\+'일 전/.test(html));
t.ok('오늘 아니면 오늘로 끌기 안내', /오늘로 끌기/.test(html));
t.ok('연결 준비 없으면 끌어서 생성(kind=deadline)', /return item2\('deadline',dl\.id,'🚩',dl\.text\|\|'마감',dlBadge,'준비 할일 없음 — 끌어서 만들기'/.test(html));
t.ok('마감 섹션이 deadlineRow 사용', /deadlines\.map\(deadlineRow\)\.join\(''\)/.test(html));
t.ok('여러 준비면 +N 표기', /var more=\(preps\.length>1\?\(' \+'\+\(preps\.length-1\)\):''\);/.test(html));

t.done();
