'use strict';
/* 구독 결정(계속/해지) 로직 고정.
   - moneyAddDaysKey: 날짜 키 ± n일.
   - moneySubRenewals(subs, today, win, keepStore): 곧 결정이 필요한 구독 추림.
     · 무료체험 종료 임박 → 'trial'
     · 다가오는 결제 → 'due' (keepStore로 '계속' 눌러 숨김 가능)
     · 다음 결제 전 해지 예정 → 'scheduledCancel'
     · canceled/ended/paused는 제외. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'function moneyAddDaysKey(k,n){', '\n/* ── 구독 결정 액션');

const sb = { window: {}, console: { warn() {} }, Date, Math, String, Array, Number, isNaN };
vm.createContext(sb);
vm.runInContext(block, sb);

const t = runner('구독 · 계속/해지 결정');
const T = '2026-08-25';
const R = (subs, keep) => sb.moneySubRenewals(subs, T, 7, keep || {});

// ── moneyAddDaysKey ─────────────────────────────────────────────────────────
{
  t.ok('하루 전', sb.moneyAddDaysKey('2026-08-28', -1) === '2026-08-27');
  t.ok('월 넘김', sb.moneyAddDaysKey('2026-08-31', 1) === '2026-09-01');
}

// ── due(다가오는 결제) ──────────────────────────────────────────────────────
{
  const subs = [
    { id: 'a', name: '넷플릭스', nextDate: '2026-08-28', amount: 13500, currency: 'KRW', status: 'active' }, // D-3
    { id: 'b', name: '먼결제', nextDate: '2026-09-20', amount: 9900, status: 'active' }, // 창 밖
  ];
  const r = R(subs);
  t.ok('창 안 결제만', r.length === 1 && r[0].sub.id === 'a' && r[0].mode === 'due', JSON.stringify(r.map(x => x.mode)));
  t.ok('D-3 계산', r[0].days === 3, r[0].days);
  // '계속' 누르면(keepStore) 숨겨짐
  const r2 = R(subs, { 'keep:a:2026-08-28': 1 });
  t.ok('계속 누르면 숨김', r2.length === 0, JSON.stringify(r2));
  // 다음 주기(nextDate 바뀜)면 keep이 안 먹혀 다시 뜸
  const subs2 = [{ id: 'a', name: '넷플릭스', nextDate: '2026-08-26', amount: 1, status: 'active' }];
  t.ok('다음 주기엔 다시 결정', R(subs2, { 'keep:a:2026-08-28': 1 }).length === 1);
}

// ── trial(무료체험) ─────────────────────────────────────────────────────────
{
  const subs = [{ id: 'c', name: '디즈니', trialEnd: '2026-08-27', nextDate: '2026-09-27', amount: 9900, status: 'active' }];
  const r = R(subs);
  t.ok('무료체험 우선', r.length === 1 && r[0].mode === 'trial' && r[0].days === 2, JSON.stringify(r));
  t.ok('무료체험도 계속 누르면 숨김', R(subs, { 'keep:c:2026-08-27': 1 }).length === 0);
}

// ── scheduledCancel(해지 예정) ──────────────────────────────────────────────
{
  const subs = [{ id: 'd', name: '유튜브', nextDate: '2026-08-30', cancelDate: '2026-08-29', amount: 14900, status: 'active' }];
  const r = R(subs);
  t.ok('해지 예정 모드', r.length === 1 && r[0].mode === 'scheduledCancel', JSON.stringify(r));
  t.ok('해지 예정 D-4', r[0].days === 4, r[0].days);
  // 해지 예정이 다음 결제보다 뒤면(=결제 후) 그냥 결제 안내로 뜬다
  const subs2 = [{ id: 'e', name: '스포티', nextDate: '2026-08-28', cancelDate: '2026-12-01', amount: 10900, status: 'active' }];
  t.ok('결제 후 해지 예정 → due', R(subs2)[0].mode === 'due');
}

// ── 상태 제외 ────────────────────────────────────────────────────────────────
{
  const subs = [
    { id: 'x', nextDate: '2026-08-26', amount: 1, status: 'canceled' },
    { id: 'y', nextDate: '2026-08-26', amount: 1, status: 'ended' },
    { id: 'z', nextDate: '2026-08-26', amount: 1, status: 'paused' },
  ];
  t.ok('canceled/ended/paused 제외', R(subs).length === 0);
}

// ── 정렬(가까운 것 먼저) ─────────────────────────────────────────────────────
{
  const subs = [
    { id: 'f1', nextDate: '2026-08-30', amount: 1, status: 'active' }, // D-5
    { id: 'f2', nextDate: '2026-08-26', amount: 1, status: 'active' }, // D-1
  ];
  const r = R(subs);
  t.ok('가까운 결제 먼저', r[0].sub.id === 'f2' && r[1].sub.id === 'f1', JSON.stringify(r.map(x => x.sub.id)));
}

t.done();
