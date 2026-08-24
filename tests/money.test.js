'use strict';
/* 머니(가계부) 순수 로직 고정.

   - moneyAdvanceCycle(date, cycle): 구독 다음 결제일 롤오버(월/년/주).
   - moneySummary(list, ym): 그 달의 수입/지출/순수익/분야합계.
   - moneyMonthlySeries(list, endYM, n): 최근 n개월 수입·지출 시리즈.
   - moneyParseSms(text, type): 결제 문자 → {amount, merchant, date, catId}.
   - moneyLooksPayment(text): 결제 문자처럼 보이는지. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'function moneyShiftYM(ym,delta){', '\nwindow.moneyParseSms=moneyParseSms;');

const sb = {
  window: {}, console: { warn() {} },
  moneyTodayKey: () => '2026-08-23',
  Date, Math, Number, String, Array, Object, parseInt, isNaN,
};
vm.createContext(sb);
vm.runInContext(block, sb);

const t = runner('머니 · 가계부 로직');

// ── moneyAdvanceCycle ───────────────────────────────────────────────────────
{
  t.ok('매월 +1개월', sb.moneyAdvanceCycle('2026-08-15', 'month') === '2026-09-15');
  t.ok('연말 넘김', sb.moneyAdvanceCycle('2026-12-10', 'month') === '2027-01-10');
  t.ok('매년 +1년', sb.moneyAdvanceCycle('2026-03-01', 'year') === '2027-03-01');
  t.ok('매주 +7일', sb.moneyAdvanceCycle('2026-08-30', 'week') === '2026-09-06');
}

// ── moneySummary ────────────────────────────────────────────────────────────
{
  const list = [
    { type: 'in',  amount: 3200000, catId: '급여', date: '2026-08-05' },
    { type: 'out', amount: 9800,    catId: '카페', date: '2026-08-23' },
    { type: 'out', amount: 45000,   catId: '쇼핑', date: '2026-08-22' },
    { type: 'out', amount: 12000,   catId: '카페', date: '2026-08-20' },
    { type: 'out', amount: 5000,    catId: '카페', date: '2026-07-31' }, // 다른 달 → 제외
    { type: 'out', amount: 99999,   catId: '식비', date: '2026-08-19', deleted: true }, // 삭제 → 제외
  ];
  const s = sb.moneySummary(list, '2026-08');
  t.ok('수입 합계', s.income === 3200000, s.income);
  t.ok('지출 합계(삭제·타월 제외)', s.expense === 66800, s.expense);
  t.ok('순수익 = 수입-지출', s.net === 3200000 - 66800, s.net);
  t.ok('분야합계 카페 = 21,800', s.byCat['카페'] === 21800, s.byCat['카페']);
  t.ok('수입은 분야합계에 안 들어감', s.byCat['급여'] === undefined);
}

// ── moneyMonthlySeries ──────────────────────────────────────────────────────
{
  const list = [
    { type: 'in', amount: 100, catId: '급여', date: '2026-08-01' },
    { type: 'out', amount: 40, catId: '식비', date: '2026-07-01' },
  ];
  const ser = sb.moneyMonthlySeries(list, '2026-08', 6);
  t.ok('6개월', ser.length === 6);
  t.ok('마지막이 이번 달', ser[5].ym === '2026-08' && ser[5].income === 100);
  t.ok('첫 달은 3월', ser[0].ym === '2026-03');
  t.ok('7월 지출 반영', ser[4].ym === '2026-07' && ser[4].expense === 40, JSON.stringify(ser[4]));
}

// ── moneyParseSms ───────────────────────────────────────────────────────────
{
  const sms = '[Web발신]\n신한카드(1234) 승인\n9,800원 일시불\n08/23 21:03\n스타벅스 코리아';
  const r = sb.moneyParseSms(sms, 'out');
  t.ok('금액 숫자로', r && r.amount === 9800, r && r.amount);
  t.ok('상점 추출', r && r.merchant === '스타벅스', r && r.merchant);
  t.ok('날짜 YYYY-MM-DD', /^\d{4}-08-23$/.test(r && r.date), r && r.date);
  t.ok('분야 카페', r && r.catId === '카페', r && r.catId);

  const rShop = sb.moneyParseSms('국민카드 승인 45,000원 08/22 쿠팡', 'out');
  t.ok('쿠팡 → 쇼핑', rShop && rShop.catId === '쇼핑', rShop && rShop.catId);

  const inc = sb.moneyParseSms('급여 입금 3,200,000원 08/25 (주)회사', 'in');
  t.ok('수입 금액', inc && inc.amount === 3200000, inc && inc.amount);
  t.ok('수입 분야 급여', inc && inc.catId === '급여', inc && inc.catId);

  t.ok('금액 없으면 null', sb.moneyParseSms('안녕하세요 오늘 점심 뭐먹지', 'out') === null);
}

// ── moneyLooksPayment ───────────────────────────────────────────────────────
{
  t.ok('결제 문자 인식', sb.moneyLooksPayment('신한카드 승인 9,800원') === true);
  t.ok('일반 문자 배제', sb.moneyLooksPayment('내일 3시에 만나요') === false);
}

t.done();
