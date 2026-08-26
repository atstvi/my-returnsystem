'use strict';
/* 머니 분야(카테고리) 편집 로직 고정.
   - moneyCatsLoad: 저장본이 유효하면 사용, 없거나 한쪽 타입이 비면 기본값으로 폴백.
   - moneyCat/moneyCatsByType: 동적 목록을 읽고, 없는 id는 안전 폴백. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, "var MONEY_CATS_KEY='money_cats_v1';", '\nvar moneyTx=');

function makeSandbox() {
  const store = {};
  const sb = {
    window: {}, console: { warn() {} },
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    setReturnStorageItem: (k, v) => { store[k] = String(v); return true; },
    JSON, Array, String, Number, Object,
  };
  vm.createContext(sb);
  vm.runInContext(block, sb);
  return { sb, store };
}

const t = runner('머니 · 분야 편집');

// ── 기본값 폴백 ───────────────────────────────────────────────────────────────
{
  const { sb } = makeSandbox();
  sb.moneyCatsLoad();
  t.ok('저장본 없으면 기본값', sb.MONEY_CATS.length === sb.MONEY_CATS_DEFAULT.length);
  t.ok('식비 기본 포함', sb.moneyCatsByType('out').some((c) => c.id === '식비'));
  t.ok('급여 수입 포함', sb.moneyCatsByType('in').some((c) => c.id === '급여'));
}

// ── 유효한 사용자 목록 로드 ───────────────────────────────────────────────────
{
  const { sb, store } = makeSandbox();
  store['money_cats_v1'] = JSON.stringify([
    { id: '밥값', type: 'out', color: 'var(--pal-1)', emoji: '🍚', custom: true },
    { id: '헬스', type: 'out', color: 'var(--pal-3)', emoji: '🏋️', custom: true },
    { id: '월급', type: 'in', color: 'var(--pal-8)', emoji: '💰' },
  ]);
  sb.moneyCatsLoad();
  t.ok('사용자 목록 사용', sb.MONEY_CATS.length === 3);
  t.ok('커스텀 지출 로드', sb.moneyCatsByType('out').map((c) => c.id).join(',') === '밥값,헬스');
  t.ok('moneyCat 조회', sb.moneyCat('헬스').emoji === '🏋️');
  t.ok('없는 id는 안전 폴백', sb.moneyCat('없는분야').id === '없는분야' && sb.moneyCat('없는분야').type === 'out');
}

// ── 한쪽 타입만 있으면(폼 깨짐 방지) 기본값 폴백 ──────────────────────────────
{
  const { sb, store } = makeSandbox();
  store['money_cats_v1'] = JSON.stringify([{ id: '밥값', type: 'out', emoji: '🍚' }]); // 수입 없음
  sb.moneyCatsLoad();
  t.ok('수입 타입 없으면 기본값 폴백', sb.MONEY_CATS.length === sb.MONEY_CATS_DEFAULT.length);
}

// ── 잘못된 항목 필터 ─────────────────────────────────────────────────────────
{
  const { sb, store } = makeSandbox();
  store['money_cats_v1'] = JSON.stringify([
    { id: '밥값', type: 'out' }, { id: '', type: 'out' }, { type: 'in' },
    { id: '월급', type: 'in' }, { id: '이상', type: 'xxx' },
  ]);
  sb.moneyCatsLoad();
  const ids = sb.MONEY_CATS.map((c) => c.id);
  t.ok('빈 id·타입불량 제거', ids.indexOf('') < 0 && ids.indexOf('이상') < 0, JSON.stringify(ids));
  t.ok('유효 항목만 남음', ids.join(',') === '밥값,월급', ids.join(','));
  t.ok('색·이모지 기본 채움', sb.moneyCat('밥값').color === 'var(--pal-15)' && sb.moneyCat('밥값').emoji === '📦');
}

t.done();
