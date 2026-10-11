'use strict';
/* 오늘 상황 '오늘 계획 짜기' — 추천 순서대로 남은·밀린 할 일을 오늘 빈 시간에 차례로 배치.
   계약: 추천 순서 유지 · 일정(이동·준비물 시간 포함)·이미 시간 잡힌 일은 피함 · 하루 마감 넘으면 '못 넣은 것' ·
   앞날짜/일정/하위/완료는 대상 아님 · 사용자가 뺀 것은 건너뜀 · 반영은 한 번에 저장. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('오늘 계획 짜기(자동 배치)');

const src = sliceBlock(html, 'function homeAutoPlanDay(o){', 'window.homeAutoPlanDay=homeAutoPlanDay;');
const ctx = { Math, String, Array, Object, isNaN, parseInt }; vm.createContext(ctx); vm.runInContext(src, ctx);
const TK = '2026-10-11';
const hm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');

const tasks = [
  { id: 'ev', text: '팀 회의', catId: 'schedule', date: TK, timeStart: '11:00', timeEnd: '12:00', travelMin: 20, prepItems: [{ text: '노트북' }] },
  { id: 'fx', text: '이미 잡힌 일', date: TK, timeStart: '13:00', timeEnd: '14:00' },
  { id: 'miss', text: '아침에 못 한 일', date: TK, timeStart: '08:00', timeEnd: '08:30' },
  { id: 'past', text: '어제 밀린 일', date: '2026-10-10' },
  { id: 'u1', text: '시간 미정 보통', date: TK },
  { id: 'u2', text: '시간 미정 중요', date: TK, priority: 'high' },
  { id: 'fut', text: '내일 할 일', date: '2026-10-12' },
  { id: 'dn', text: '끝난 일', date: TK, done: true },
  { id: 'kid', text: '하위 할일', date: TK },
  { id: 'cur', text: '지금 하는 일', date: TK, timeStart: '09:30', timeEnd: '10:00' },
];
const base = {
  tasks, todayKey: TK, nowMin: 9 * 60 + 41, prefs: { dayEnd: '22:00' },
  isNested: x => x.id === 'kid',
  cands: [{ kind: 'current', task: tasks[9] }, { kind: 'missed', task: tasks[2] }, { kind: 'untimed', task: tasks[4] }],
  missed: [{ task: tasks[2], kind: 'today' }, { task: tasks[3], kind: 'past' }],
};
const r = ctx.homeAutoPlanDay(base);
const ids = r.placed.map(p => p.task.id);
t.ok('시작은 지금(5분 올림)', r.start === 9 * 60 + 45, r.start);
t.ok('추천 순서 유지: 놓친 일 → 추천 후보 → 밀린 일 → 남은 오늘 할 일(중요 먼저)', JSON.stringify(ids) === JSON.stringify(['miss', 'u1', 'past', 'u2']), ids);
t.ok('지금 하는 일(10:00까지)이 끝난 뒤부터', r.placed[0].s === 10 * 60 && r.placed[0].e === 10 * 60 + 30, hm(r.placed[0].s));
t.ok('일정 앞 이동 20분+준비물 5분은 비움(10:35까지) → 다음 일은 회의 뒤', r.placed[1].s === 12 * 60, hm(r.placed[1].s));
t.ok('이미 잡힌 13–14시는 피함', r.placed[2].s === 14 * 60 && r.placed[3].s === 14 * 60 + 35, r.placed.map(p => hm(p.s)).join(','));
t.ok('기본 길이 30분 · 원래 길이 유지', r.placed[2].e - r.placed[2].s === 30 && r.placed[0].e - r.placed[0].s === 30);
{ const m45 = Object.assign({}, tasks[2], { timeEnd: '08:45' });
  const r45 = ctx.homeAutoPlanDay(Object.assign({}, base, { tasks: tasks.map(x => x.id === 'miss' ? m45 : x), cands: [{ kind: 'missed', task: m45 }], missed: [] }));
  t.ok('45분짜리는 회의 전 35분 틈에 안 넣고 회의 뒤로(원래 길이 유지)', r45.placed[0].s === 12 * 60 && r45.placed[0].e === 12 * 60 + 45); }
t.ok('앞날짜·완료·하위·일정은 대상 아님', !['fut', 'dn', 'kid', 'ev', 'fx', 'cur'].some(i => ids.includes(i)) && r.count === 4);
t.ok('고정 목록에 일정·잡힌 일', r.fixed.map(f => f.task.id).join() === 'cur,ev,fx');
t.ok('출처 표시', r.placed.map(p => p.src).join() === 'missed,today,past,today');

// 하루 마감 넘으면 못 넣은 것 — 앞 순위가 밀리지 않음
const late = ctx.homeAutoPlanDay(Object.assign({}, base, { nowMin: 21 * 60 + 10 }));
t.ok('밤에는 남은 시간만큼만', late.placed.map(p => p.task.id).join() === 'miss' && late.over.length === 3, late.placed.map(p => p.task.id));
t.ok('짧은 일이 틈에 들어가도 순서는 뒤로만', late.placed.every((p, i, a) => !i || p.s >= a[i - 1].e));

// 사용자가 뺀 것은 건너뛰고 다음 것이 앞당겨짐
const exr = ctx.homeAutoPlanDay(Object.assign({}, base, { exclude: { miss: 1 } }));
t.ok('뺀 것은 건너뜀', exr.excluded.length === 1 && exr.placed[0].task.id === 'u1' && exr.placed[0].s === 10 * 60);

// 꼭 챙길 것 — 준비 없음(state none)은 할 일이 없으니 제외, 밀린 준비는 맨 앞
const prep = { id: 'prep', text: '발표 준비', date: '2026-10-09' };
const g = ctx.homeAutoPlanDay(Object.assign({}, base, { tasks: tasks.concat([prep]),
  cands: [{ kind: 'guard', task: prep, guard: { state: 'behind' } }].concat(base.cands),
  must: [{ state: 'none', target: tasks[6] }] }));
t.ok('밀린 준비가 1순위', g.placed[0].task.id === 'prep' && g.placed[0].src === 'must');
t.ok('준비 없음 항목은 배치 안 함(앞날짜 대상)', !g.placed.some(p => p.task.id === 'fut'));

// 반영: 한 번에 저장 + 날짜 변경 표시
{
  const a = html.indexOf('function _homeAutoPlanApply(');
  const seg = html.slice(a, a + 1400);
  t.ok('반영 함수 존재', a > 0);
  t.ok('날짜 바뀌면 markTaskDateManualChange', /markTaskDateManualChange\(t,k\)/.test(seg));
  t.ok('생성 할일은 userModifiedDate', /isGeneratedTask\(t\)\)t\.userModifiedDate=true/.test(seg));
  t.ok('저장은 한 번', (seg.match(/saveTaskData\(\)/g) || []).length === 1);
  t.ok('오늘 상황에 버튼', html.indexOf('id="sit-autoplan"') > 0 && html.indexOf('_homeAutoPlanOpen(plan, ex.radar)') > 0);
}

t.done();
