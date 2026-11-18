'use strict';
/* 위시리스트 분야(카테고리) 순서를 마음대로 — 기기 간 동기화되는 순서(hobby_wish_catorder_v1).
   필터 칩 · 무드보드 그룹 · 비교가 모두 wishCategories() 순서를 따른다. 순서에 없는 새 분야는 뒤에
   처음 담은 순서로. 바꾸는 법: 칩 길게 누르기/우클릭 → 공용 메뉴(맨 앞/한 칸/맨 뒤), '순서' 시트의 ↑↓. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('위시리스트 분야 순서');

const store = {};
const ctx = { JSON, String, Array, Object,
  localStorage: { getItem: (k) => (k in store ? store[k] : null) },
  setReturnStorageItem: (k, v) => { store[k] = v; return true; },
  wishlist: [] };
ctx.wishActive = () => ctx.wishlist.filter((w) => w && !w.deletedAt);
vm.createContext(ctx);
vm.runInContext(sliceBlock(html, "var WISH_CATORDER_KEY='hobby_wish_catorder_v1';", 'function wishSorted(list){'), ctx);
const names = () => ctx.wishCategories().map((c) => c.name + c.count).join(',');

ctx.wishlist = [{ category: '전자기기' }, { category: '미술' }, { category: '전자기기' }, { category: '' }, { category: '가구' }];
t.ok('저장된 순서가 없으면 처음 담은 순서(빈 분야는 기타)', names() === '전자기기2,미술1,기타1,가구1');
ctx.wishMoveCategory('가구', 0);
t.ok('맨 앞으로', names() === '가구1,전자기기2,미술1,기타1');
ctx.wishMoveCategory('가구', -1);
t.ok('맨 뒤로', names() === '전자기기2,미술1,기타1,가구1');
ctx.wishMoveCategory('기타', 1);
t.ok('특정 위치로', names() === '전자기기2,기타1,미술1,가구1');
t.ok('순서는 동기화 키에 저장', store.hobby_wish_catorder_v1 === JSON.stringify(['전자기기', '기타', '미술', '가구']));
ctx.wishlist.push({ category: '음악' });
t.ok('새 분야는 뒤에', names() === '전자기기2,기타1,미술1,가구1,음악1');
ctx.wishlist = ctx.wishlist.filter((w) => w.category !== '미술');
ctx.wishMoveCategory('음악', 0);
ctx.wishlist.push({ category: '미술' });
t.ok('항목이 잠시 없던 분야도 다시 담으면 예전 자리 근처로(순서 기억 유지)', names() === '음악1,전자기기2,기타1,가구1,미술1' || names() === '음악1,전자기기2,기타1,미술1,가구1');
t.ok('없는 분야는 무시', ctx.wishMoveCategory('없음', 0) === false);

/* 배선 */
t.ok('칩: 우클릭·길게 누르기 → 공용 메뉴(길게 누른 뒤 탭은 무시)', /b\.addEventListener\('contextmenu',function\(e\)\{ e\.preventDefault\(\); wishCatMenu\(name,\{x:e\.clientX,y:e\.clientY\}\); \}\);/.test(html) && /t=setTimeout\(function\(\)\{ b\._lp=true; wishCatMenu\(name,null\); \},480\);/.test(html) && /if\(b\._lp\)\{ b\._lp=false; e\.preventDefault\(\); return; \}/.test(html));
t.ok('메뉴는 공용 rdsActionSheet', /function wishCatMenu\(name, at\)\{[\s\S]{0,300}rdsActionSheet\(\{ title:name, sub:'분야 순서', at:at/.test(html));
t.ok('순서 시트 ↑↓(터치 44px)', /data-oup=/.test(html) && /@media \(pointer:coarse\)\{ \.wish-obtn\{width:var\(--tap\);height:var\(--tap\)\}/.test(html));
t.ok('순서 키는 동기화 대상(hobby_ 접두)', /return \/\^\(return_\|task_\|diary_\|hobby_/.test(html));
t.done();
