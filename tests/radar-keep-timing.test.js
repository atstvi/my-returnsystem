'use strict';
/* 마감 레이더 '당길 필요 없음' — 일부러 마감 직전에 잡아 둔 준비 할일(연결 패스처럼)을 자꾸
   당기라고 하던 문제. 예전엔 촉박(tight) 카드의 '필요 없음'이 skipped 맵에만 적히고 그 맵은
   '준비 없음'일 때만 읽혀서, 눌러도 아무 변화가 없었다. 이제 촉박 카드의 대안은 '당길 필요 없음'
   (keep): 그 준비 할일에 prepTimingOk='<준비날>><마감날>'을 남겨 촉박으로 보지 않는다.
   준비 날짜나 마감 날짜가 바뀌면 표시는 저절로 무효가 되어 다시 점검한다. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('마감 레이더 · 당길 필요 없음');

const ctx = { Math, String, Object, Array, Date, isNaN, parseInt };
vm.createContext(ctx);
vm.runInContext(sliceBlock(html, 'var RADAR_DEADLINE_RE=', 'window.returnDeadlineRadar=returnDeadlineRadar;'), ctx);

const TK = '2026-10-09';
const R = (tasks) => ctx.returnDeadlineRadar({ tasks, todayKey: TK });
const find = (r, title) => r.items.find((i) => i.title === title);
const mk = () => [{ id: 1, text: '시험', date: '2026-10-15', deadlineDate: '2026-10-15' }, { id: 2, text: '시험 공부', date: '2026-10-15', sourceTaskId: '1' }];

{
  const r = R(mk());
  const it = find(r, '시험');
  t.ok('직전 준비 → 촉박 + 대안은 "당길 필요 없음"(keep, 그 준비 할일)', it.state === 'tight' && it.alt.type === 'keep' && it.alt.tasks[0].id === 2);
}
{
  const ts = mk(); ts[1].prepTimingOk = ctx.radarTimingKey('2026-10-15', '2026-10-15');
  const r = R(ts), it = find(r, '시험');
  t.ok('당길 필요 없음 표시 → 촉박 아님(계획됨) · 당기기 제안 없음', it.state === 'planned' && !(it.fix && it.fix.type === 'pull'));
  t.ok('꼭 챙길 것/미리 챙길 것에서도 빠짐', !r.must.some((x) => x.title === '시험') && !r.soon.some((x) => x.title === '시험'));
  t.ok('메시지에 "직전으로 둠" + 되돌리기(다시 점검)', /직전으로 둠/.test(it.msg) && it.alt && it.alt.type === 'unkeep' && it.alt.tasks[0].id === 2);
  t.ok('작업 줄의 촉박 표시도 꺼짐(시간 격자·목록 칩이 같은 값을 씀)', it.work[0].tight === false && it.work[0].kept === true);
}
{
  const ts = mk(); ts[1].prepTimingOk = ctx.radarTimingKey('2026-10-15', '2026-10-15'); ts[1].date = '2026-10-14';
  /* 여유 2일: 10/14도 촉박 → 옮긴 날짜엔 표시가 안 맞아 다시 촉박 */
  t.ok('준비 날짜를 옮기면 표시 무효 → 다시 점검', find(ctx.returnDeadlineRadar({ tasks: ts, todayKey: TK, prefs: { prepMarginDays: 2 } }), '시험').state === 'tight');
  const t2 = mk(); t2[1].prepTimingOk = ctx.radarTimingKey('2026-10-15', '2026-10-15'); t2[0].deadlineDate = '2026-10-16'; t2[0].date = '2026-10-16'; t2[1].date = '2026-10-16';
  t.ok('마감 날짜가 바뀌어도 무효', find(R(t2), '시험').state === 'tight');
}
{
  const ts = mk(); ts[1].prepTimingOk = ctx.radarTimingKey('2026-10-08', '2026-10-15'); ts[1].date = '2026-10-08';
  t.ok('지난 날짜 미완료(밀림)는 표시와 무관하게 챙김', find(R(ts), '시험').state === 'behind');
}
{
  const ts = [{ id: 3, text: '세미나', catId: 'schedule', date: '2026-10-16' }, { id: 4, text: '연결 패스 챙기기', date: '2026-10-16', deadlineId: '3', sourceTaskId: '3' }];
  t.ok('일정 당일 준비도 같은 방식', find(R(ts), '세미나').alt.type === 'keep');
  ts[1].prepTimingOk = ctx.radarTimingKey('2026-10-16', '2026-10-16');
  t.ok('→ 표시하면 계획됨', find(R(ts), '세미나').state === 'planned');
}

/* 배선 */
t.ok('라벨: 당길 필요 없음 / 다시 점검', /case 'keep': return '당길 필요 없음';/.test(html) && /case 'unkeep': return '다시 점검';/.test(html));
t.ok('누르면 준비 할일에 표시 + updatedAt + 저장', /case 'keep':[\s\S]{0,200}l\.prepTimingOk=radarTimingKey\(l\.date,it\.due\); l\.updatedAt=Date\.now\(\);[\s\S]{0,80}saveTaskData\(\)/.test(html));
t.ok('다시 점검은 표시 지움', /case 'unkeep':[\s\S]{0,160}delete l\.prepTimingOk; l\.updatedAt=Date\.now\(\);/.test(html));
t.ok('나탭 "지금 할 일" 촉박 카드에도 당길 필요 없음 버튼', /g\.state==='tight'\?\['startNow','guardFix','guardAlt'\]/.test(html));

t.done();
