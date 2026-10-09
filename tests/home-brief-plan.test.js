'use strict';
/* 나 탭 '오늘 상황' = 비서 브리핑. 생각하기 귀찮을 때 '지금 무엇을 할지'를 하나로 정해 주고,
   못 하고 지나간 일까지 종합해 명료하게 알려 준다. 판단 엔진(homeBriefPlan)을 상황별로 고정. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('오늘 상황 비서 브리핑 판단');
const block = sliceBlock(html, 'function _krJosa(w,a,b){', 'window.homeBriefPlan=homeBriefPlan;');
const ctx = { Math, String, parseInt, Array }; vm.createContext(ctx); vm.runInContext(block, ctx);
const TK = '2026-10-09', M = (h, m) => h*60 + (m||0);
function plan(tasks, extra){ return ctx.homeBriefPlan(Object.assign({ tasks, todayKey: TK, weekAgoKey:'2026-10-02', daysAgo: d => (new Date(TK) - new Date(d)) / 86400000 }, extra||{})); }

// 1) 곧 출발해야 하는 일정 + 준비물 → 지금 = 준비물 챙기기(위급), 이유에 출발 시각
{
  const p = plan([
    { id:1, text:'보고서', date:TK, timeStart:'10:00', timeEnd:'12:00' },
    { id:2, text:'팀 회의', catId:'schedule', date:TK, timeStart:'15:00', timeEnd:'16:00', travelMin:20, prepItems:[{text:'노트북'},{text:'자료',done:true}] },
  ], { nowMin: M(14,20) });
  t.ok('지금 = 회의 준비물 챙기기', p.now.kind === 'prep' && p.now.tone === 'danger' && /팀 회의 준비물/.test(p.now.title), JSON.stringify(p.now));
  t.ok('이유에 출발 시각(14:40)', /14:40 출발/.test(p.now.reason), p.now.reason);
  t.ok('놓친 일에 보고서', p.missed.some(m => m.task.id === 1));
  t.ok('헤드라인이 놓친 일 + 다음 일정 종합', /“보고서”를 아직 못 했어요\. 15:00 팀 회의까지 40분 \(이동 20분\)\./.test(p.headline), p.headline);
  t.ok('출발까지 여유 없으면 놓친 일을 지금 하라고 권하지 않음', !p.alts.some(a => a.kind === 'missed'));
  t.ok('지금 하기로 옮길 때 끝 시각 상한 = 출발 준비 시각(14:35)', p.nextLeaveMin === M(14,35), p.nextLeaveMin);
}
// 2) 다음 일정까지 빈 시간이 넉넉하면 → 놓친 일을 지금 하자고 제안(유연한 판단)
{
  const p = plan([
    { id:1, text:'메일 답장', date:TK, timeStart:'09:00', timeEnd:'09:30' },
    { id:2, text:'세미나', catId:'schedule', date:TK, timeStart:'16:00', timeEnd:'17:00' },
  ], { nowMin: M(13) });
  t.ok('빈 시간 → 놓친 일 지금 하기', p.now.kind === 'missed' && p.now.task.id === 1 && /09:00에 하려던 일 · 다음 일정 전까지 2시간 50분 비어요/.test(p.now.reason), JSON.stringify(p.now));
  t.ok('행동: 지금 하기 / 오늘 중에', p.now.actions.join() === 'startNow,later');
}
// 3) 지금 계획된 일이 진행 중 → 타이머·완료
{
  const p = plan([{ id:1, text:'영어 공부', date:TK, timeStart:'14:00', timeEnd:'15:00' }], { nowMin: M(14,30) });
  t.ok('지금 계획된 일', p.now.kind === 'current' && p.now.actions.join() === 'timer,done' && /30분 남음/.test(p.now.reason));
  t.ok('헤드라인: 지금은 ~ 시간', /지금은 “영어 공부” 시간이에요/.test(p.headline), p.headline);
}
// 4) 오늘 마감 → 위급, 오래 묵은(8일+) 마감은 1순위 안 뺏음
{
  const p = plan([{ id:1, text:'과제', date:TK }], { nowMin: M(11), deadlines:[{ task:{id:1,text:'과제'}, days:0 }, { task:{id:9,text:'옛 마감'}, days:-30 }] });
  t.ok('오늘 마감 → 지금', p.now.kind === 'deadline' && p.now.task.id === 1 && p.now.eyebrow === '오늘 마감');
  t.ok('30일 지난 마감은 후보 아님', !p.alts.some(a => a.task && a.task.id === 9));
}
// 5) 에너지 낮고 급한 일 없으면 충전 먼저, 급하면 아님
{
  const p = plan([{ id:1, text:'정리', date:TK }], { nowMin: M(15), energyLow: true });
  t.ok('에너지 낮음 → 충전 먼저', p.now.kind === 'rest' && p.now.title === '잠깐 충전하기');
  const p2 = plan([{ id:1, text:'공부', date:TK, timeStart:'15:00', timeEnd:'16:00' }], { nowMin: M(15,10), energyLow: true });
  t.ok('진행 중인 일이 있으면 충전보다 그 일', p2.now.kind === 'current');
}
// 6) 다음 일정이 코앞(빈 시간 <20분)이고 급한 준비 없음 → 새 일 벌리지 말고 숨 고르기
{
  const p = plan([{ id:2, text:'미팅', catId:'schedule', date:TK, timeStart:'15:20', timeEnd:'16:00' }, { id:3, text:'빨래', date:TK }], { nowMin: M(15,5) });
  t.ok('곧 시작 → 잠깐 숨 고르기', p.now.kind === 'wait' && /15분 뒤/.test(p.now.reason));
}
// 7) 밀린 일(어제)·반복 회차 제외·일정은 '놓친 일' 아님
{
  const p = plan([
    { id:1, text:'장보기', date:'2026-10-08' },
    { id:2, text:'물 마시기', date:'2026-10-08', _repeatId:'ri', occurrenceDate:'2026-10-08' },
    { id:3, text:'지난 수업', catId:'schedule', date:TK, timeStart:'09:00', timeEnd:'10:00' },
    { id:4, text:'열흘 전 일', date:'2026-09-29' },
  ], { nowMin: M(12) });
  const ids = p.missed.map(m => m.task.id).join();
  t.ok('어제 못 한 일은 놓친 일(어제)', ids === '1' && p.missed[0].when === '어제', ids);
  t.ok('헤드라인: 밀린 일', /최근 밀린 할일이 1개/.test(p.headline), p.headline);
}
// 8) 아무것도 없으면 쉬어도 됨 / 다 했으면 칭찬
{
  const p = plan([], { nowMin: M(20) });
  t.ok('할 일 없음 → 쉬어도 돼요', p.now.title === '지금은 쉬어도 돼요' && p.state === 'rest');
  const p2 = plan([{ id:1, text:'a', date:TK, done:true }], { nowMin: M(20) });
  t.ok('다 끝냄 → 칭찬', /다 끝냈어요/.test(p2.headline));
}
// 9) 후보 중복 없음 + 상태
{
  const p = plan([{ id:1, text:'보고서', date:TK, timeStart:'09:00', timeEnd:'10:00', deadlineDate:'2026-10-10' }], { nowMin: M(13), deadlines:[{ task:{id:1,text:'보고서'}, days:1 }], inboxNeed:[{},{}], routineDueCount:2 });
  const ids = [p.now].concat(p.alts).filter(c => c.task).map(c => c.task.id);
  t.ok('같은 할일이 후보에 두 번 안 나옴', new Set(ids).size === ids.length, ids.join());
  t.ok('인박스·습관도 후보', p.alts.some(a => a.kind === 'inbox') && p.alts.some(a => a.kind === 'routine'));
  t.ok('상태 focus', p.state === 'focus');
}
// 10) 배선
t.ok('renderHomeSituation이 브리핑 엔진·렌더 사용', /var plan = homeBriefPlan\(\{/.test(html) && /_homeBriefRender\(card, plan, \{/.test(html));
t.ok('카드 마크업: 지금 할 일·놓친 일·이따가·그 밖에', /id="sit-now"/.test(html) && /id="sit-missed"/.test(html) && /aria-label="이따가"/.test(html) && /class="sit-signals" aria-label="그 밖에"/.test(html));
t.ok('옛 다가오는 할일 목록 제거', !/id="sit-upcoming"/.test(html));
t.ok('지금 하기·놓친 일 지금: 다음 일정 전 상한 적용', (html.match(/_briefMoveTask\(t, TK, nm, plan\.nextLeaveMin\);/g)||[]).length === 2);
t.done();
