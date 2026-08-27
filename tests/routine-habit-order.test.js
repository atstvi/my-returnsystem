'use strict';
/* 습관 순서 통일 — '오늘의 루틴'(묶음) 순서를 표준으로 삼아 보관함·히트맵이 따르게.
   - routineHabitRank: 묶음 순회 → habitIds 순으로 rank 부여(중복 제거).
   - routineOrderedHabits: 주어진 habit 목록을 그 순서로 정렬(묶음에 없는 건 뒤로, 안정). */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'function routineHabitRank(){', '\nfunction routineArchivedHabits(');

function sb(bundles, habits) {
  const ctx = { routineBundles: bundles, routineHabits: habits };
  vm.createContext(ctx);
  vm.runInContext(block, ctx);
  return ctx;
}

const t = runner('습관 순서 통일');

// 오늘의 루틴 순서: 묶음X(c,a) → 묶음Y(b). d는 무소속.
const bundles = [
  { id: 'bx', habitIds: ['h_c', 'h_a'] },
  { id: 'by', habitIds: ['h_b'] },
];
const habits = [
  { id: 'h_a', title: '알파' }, { id: 'h_b', title: '베타' },
  { id: 'h_c', title: '감마' }, { id: 'h_d', title: '델타' },
];

{
  const c = sb(bundles, habits);
  const rank = c.routineHabitRank();
  t.ok('rank: 감마=0', rank['h_c'] === 0, JSON.stringify(rank));
  t.ok('rank: 알파=1', rank['h_a'] === 1);
  t.ok('rank: 베타=2', rank['h_b'] === 2);
  t.ok('rank: 무소속 없음', rank['h_d'] == null);

  const ordered = c.routineOrderedHabits(habits).map((h) => h.id);
  t.ok('오늘의 루틴 순서로 정렬', ordered.join(',') === 'h_c,h_a,h_b,h_d', ordered.join(','));
}

// 부분 목록(보관함 필터)도 같은 순서
{
  const c = sb(bundles, habits);
  const ordered = c.routineOrderedHabits([habits[0], habits[1], habits[2]]).map((h) => h.id);
  t.ok('부분 목록도 묶음 순서', ordered.join(',') === 'h_c,h_a,h_b', ordered.join(','));
}

// 묶음이 없으면 원래 순서 유지(안정)
{
  const c = sb([], habits);
  const ordered = c.routineOrderedHabits(habits).map((h) => h.id);
  t.ok('묶음 없으면 원래 순서', ordered.join(',') === 'h_a,h_b,h_c,h_d', ordered.join(','));
}

t.done();
