'use strict';
/* 취미 위시리스트 순수 로직 고정.
   - wishFmtPrice / wishStars / wishStatusMeta: 표시 포맷.
   - wishCategories: 분야별 그룹·개수(삭제 제외).
   - wishSorted: 가격(통화 환산)·별점·이름 정렬.
   - wishKRW: 통화 → 대략 원화(정렬용). */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, "var WISH_KEY='hobby_wishlist_v1';", '\n/* ── 렌더 ── */');

const sb = {
  window: {}, console: { warn() {} },
  localStorage: { getItem: () => '[]', setItem() {}, removeItem() {} },
  Math, JSON, String, Number, Array, Object, parseInt, isNaN,
};
vm.createContext(sb);
vm.runInContext(block, sb);

const t = runner('위시리스트 · 로직');

// ── 포맷 ─────────────────────────────────────────────────────────────────────
{
  t.ok('원화 포맷', sb.wishFmtPrice(399000, 'KRW') === '₩399,000', sb.wishFmtPrice(399000, 'KRW'));
  t.ok('달러 포맷', sb.wishFmtPrice(129, 'USD') === '$129', sb.wishFmtPrice(129, 'USD'));
  t.ok('빈 가격 → 빈 문자열', sb.wishFmtPrice(null, 'KRW') === '' && sb.wishFmtPrice('', 'USD') === '');
  t.ok('별점 4', sb.wishStars(4) === '★★★★☆', sb.wishStars(4));
  t.ok('별점 0 → 빈', sb.wishStars(0) === '');
  t.ok('상태 메타', sb.wishStatusMeta('planned').label === '구매예정' && sb.wishStatusMeta('nope').label === '고민중');
}

// ── 분야 그룹 ────────────────────────────────────────────────────────────────
{
  sb.wishlist = [
    { id: 1, title: 'A', category: '전자기기', price: 100, currency: 'KRW', createdAt: 1 },
    { id: 2, title: 'B', category: '가구', price: 200, currency: 'KRW', createdAt: 2 },
    { id: 3, title: 'C', category: '전자기기', price: 50, currency: 'KRW', createdAt: 3 },
    { id: 4, title: 'D', category: '전자기기', price: 9, currency: 'KRW', createdAt: 4, deletedAt: 123 }, // 삭제 제외
    { id: 5, title: 'E', createdAt: 5 }, // 분야 없음 → 기타
  ];
  const cats = sb.wishCategories();
  const byName = {}; cats.forEach((c) => { byName[c.name] = c.count; });
  t.ok('전자기기 2개(삭제 제외)', byName['전자기기'] === 2, JSON.stringify(cats));
  t.ok('가구 1개', byName['가구'] === 1);
  t.ok('분야 없으면 기타', byName['기타'] === 1);
  t.ok('삭제 항목 제외', sb.wishActive().length === 4);
}

// ── 정렬 ─────────────────────────────────────────────────────────────────────
{
  sb.wishlist = [
    { id: 1, title: '가', price: 100, currency: 'KRW', rating: 3, createdAt: 1 },
    { id: 2, title: '나', price: 5, currency: 'USD', rating: 5, createdAt: 2 }, // 5 USD ≈ 6900 KRW
    { id: 3, title: '다', price: 50000, currency: 'KRW', rating: 1, createdAt: 3 },
  ];
  const active = sb.wishActive();
  sb._wishSort = 'priceLow';
  const low = sb.wishSorted(active).map((w) => w.id);
  t.ok('가격 낮은순(통화 환산)', low[0] === 1, JSON.stringify(low)); // 100 KRW < 6900 < 50000
  sb._wishSort = 'priceHigh';
  const high = sb.wishSorted(active).map((w) => w.id);
  t.ok('가격 높은순', high[0] === 3, JSON.stringify(high));
  sb._wishSort = 'rating';
  const byRate = sb.wishSorted(active).map((w) => w.id);
  t.ok('별점 높은순', byRate[0] === 2, JSON.stringify(byRate));
  sb._wishSort = 'name';
  const byName = sb.wishSorted(active).map((w) => w.title);
  t.ok('이름순', byName.join('') === '가나다', byName.join(''));
}

// ── 통화 환산(정렬 보조) ─────────────────────────────────────────────────────
{
  t.ok('원화 그대로', sb.wishKRW({ price: 5000, currency: 'KRW' }) === 5000);
  t.ok('달러 환산 > 원금', sb.wishKRW({ price: 10, currency: 'USD' }) > 10);
}

// ── 이미지 목록 정규화 ───────────────────────────────────────────────────────
{
  t.ok('images 배열 사용', sb.wishImages({ images: [{ ref: 'a' }, { sync: 'b' }] }).length === 2);
  t.ok('구버전 imageRef 흡수', sb.wishImages({ imageRef: 'x' }).length === 1 && sb.wishImages({ imageRef: 'x' })[0].ref === 'x');
  t.ok('빈 항목 제거', sb.wishImages({ images: [{ ref: '' }, { ref: 'y' }] }).length === 1);
  t.ok('없으면 빈 배열', sb.wishImages({}).length === 0);
}

// ── 추가 비용 + 합산 ─────────────────────────────────────────────────────────
{
  const w = { price: 399000, currency: 'KRW', extras: [{ label: '배송비', amount: 3000 }, { label: '보증', amount: 5000 }] };
  t.ok('추가비용 합', sb.wishExtrasSum(w) === 8000, sb.wishExtrasSum(w));
  t.ok('합산 = 원금+추가', sb.wishTotalOrig(w) === 407000, sb.wishTotalOrig(w));
  t.ok('합산 원화(KRW)', sb.wishTotalKRW(w) === 407000);
  // 0원 항목은 제외
  t.ok('0원 추가 제외', sb.wishExtras({ extras: [{ label: 'x', amount: 0 }, { label: 'y', amount: 100 }] }).length === 1);
  // 가격 없이 추가만 있어도 합산
  t.ok('가격없이 추가만', sb.wishTotalOrig({ extras: [{ label: '배송', amount: 2500 }] }) === 2500);
  // 아무 금액도 없으면 null
  t.ok('금액 전무 → null', sb.wishTotalOrig({ title: 'x' }) === null);
  // 외화 합산 원화 환산
  const usd = { price: 100, currency: 'USD', extras: [{ label: 'ship', amount: 20 }] };
  t.ok('USD 합산 120', sb.wishTotalOrig(usd) === 120);
  t.ok('USD 합산 원화 > 120', sb.wishTotalKRW(usd) > 120);
}

t.done();
