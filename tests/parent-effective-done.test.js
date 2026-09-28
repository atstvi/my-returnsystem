'use strict';
/* 상위 할일 완료 판정 — 하위 할일(parentId)이 있으면 모두 완료 시 상위도 완료로 본다.
   달력·계획창에서도 목록의 '그날 완료'와 통일되게 상위가 완료로 보이게 하기 위함.
   - taskEffectiveDone(parent): 하위가 있으면 전부 완료여야 완료(재귀), 없으면 기존
     deadlineId 준비 완료 규칙.
   - taskDayQuotaDone(parent,date): 그날 하위(그 날짜의 하위)가 하나라도 있고 전부 완료. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('상위 할일 완료 판정(하위 반영)');

// taskChildren ~ taskDayQuotaDone 까지 한 덩어리로 슬라이스
const block = sliceBlock(html, 'function taskChildren(id){', 'function saveTaskData(){');
function mk(list){
  const ctx = { tasks:list, String, Date };
  vm.createContext(ctx);
  vm.runInContext(block, ctx);
  return ctx;
}

// 1) 하위 모두 완료 → 상위 완료
{
  var P={id:1,text:'P',date:'2026-10-05',deadlineDate:'2026-10-10',done:false};
  var A={id:2,parentId:1,date:'2026-10-05',done:true};
  var ctx=mk([P,A]);
  t.ok('하위 1개 완료 → 상위 완료', ctx.taskEffectiveDone(P)===true);
}
// 2) 하위 일부 미완료 → 상위 미완료
{
  var P={id:1,date:'2026-10-05',deadlineDate:'2026-10-10',done:false};
  var A={id:2,parentId:1,date:'2026-10-05',done:true};
  var B={id:3,parentId:1,date:'2026-10-08',done:false};
  var ctx=mk([P,A,B]);
  t.ok('하위 1/2 완료 → 상위 미완료', ctx.taskEffectiveDone(P)===false);
  t.ok('그날(10-05) 하위 완료 → 그날 완료', ctx.taskDayQuotaDone(P,'2026-10-05')===true);
  t.ok('그날(10-08) 하위 미완료 → 그날 미완료', ctx.taskDayQuotaDone(P,'2026-10-08')===false);
  t.ok('하위 없는 날(10-06) → 그날 완료 아님', ctx.taskDayQuotaDone(P,'2026-10-06')===false);
}
// 3) 하위 없는 할일: 기존 deadlineId 준비 규칙 유지
{
  var G={id:1,text:'마감',date:'2026-10-01',deadlineDate:'2026-10-10',done:false};
  var prep={id:2,text:'준비',date:'2026-10-05',deadlineId:'1',done:true};
  var ctx=mk([G,prep]);
  t.ok('하위 없고 연결 준비 완료 → 완료', ctx.taskEffectiveDone(G)===true);
}
// 4) 본인 done이면 그대로 완료
{
  var P={id:1,done:true};
  var ctx=mk([P]);
  t.ok('본인 done → 완료', ctx.taskEffectiveDone(P)===true);
}
// 5) 손자까지 재귀 — 하위의 하위가 미완료면 미완료
{
  var P={id:1,done:false};
  var C={id:2,parentId:1,done:false};
  var GC={id:3,parentId:2,done:false};
  var ctx=mk([P,C,GC]);
  t.ok('손자 미완료 → 상위 미완료', ctx.taskEffectiveDone(P)===false);
  GC.done=true;
  t.ok('손자 완료 → 자식 완료 → 상위 완료', ctx.taskEffectiveDone(P)===true);
}

// ── 소스 배선: 달력 pill done 클래스 ──
t.ok('달력 pill이 완료/그날완료면 done 클래스',
  /var _pillDone=\(typeof taskEffectiveDone==='function'\?taskEffectiveDone\(t\):!!t\.done\)\|\|\(typeof taskDayQuotaDone==='function'&&taskDayQuotaDone\(t,dkey\)\);[\s\S]*?\+\(_pillDone\?' done':''\)/.test(html));
t.ok('달력 pill done CSS', /\.cal-event-pill\.done\{opacity:\.5;text-decoration:line-through\}/.test(html));

t.done();
