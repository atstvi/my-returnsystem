'use strict';
/* 저장공간 정리 — 큰 '텍스트' 동기화 데이터를 IDB 오버플로로 옮겨 실제로 localStorage를
   비운다. returnCompactMediaToIdb는 미디어/base64만 옮기므로, 일기·루틴로그·메모처럼 순수
   텍스트가 쌓인 기기에선 정리 결과가 0%가 되어 usedPct가 안 내려가고 quota PUSH가 계속
   막힌다('정리해도 정리 안 됨 + 동기화 오류' 반복). returnSpillDataToIdb는 부팅 시
   returnRehydrateOverflowedState가 다시 읽어오는 동기화 컬렉션 키만 골라 큰 것부터
   목표 사용률 밑으로 내려갈 때까지 옮긴다. 읽기는 _idbCache, 동기화는 fbCollectData가
   IDB-only 키를 포함해 유지된다(별도 검증). 이 파일은 이동 선택 로직을 검증한다. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('저장공간 텍스트 데이터 IDB 스필');

const block = sliceBlock(html,
  'async function returnSpillDataToIdb(targetPct){',
  'window.returnSpillDataToIdb=returnSpillDataToIdb;');

function makeCtx(){
  const store = {};
  const _idbCache = {};
  const win = { __staleQuotaKeys: {} };
  const ctx = {
    Math, Object, JSON, String,
    window: win,
    _idbCache,
    _idbOverflow: {},          // truthy = ready
    _idbReady: true,
    RETURN_SYNC_COLLECTION_KEYS: ['task_items_v1','task_cats_v1','inbox_v1','projects_v1','routine_habits_v1','routine_bundles_v1','routine_logs_v1','memos_v5','metrics_v1','diary_entries_v1','repeat_items_v1'],
    RETURN_STORAGE_SOFT_PCT: 80,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      removeItem: (k) => { delete store[k]; },
    },
    _idbSet: (k,v) => new Promise((res)=>{ _idbCache[k]=v; res(); }),
    /* usedPct = localStorage 크기 기준(5MB). removeItem 하면 즉시 내려간다. */
    returnStorageReport: () => {
      let total=0; Object.keys(store).forEach(k=>{ total+=(k.length+String(store[k]).length)*2; });
      return { usedPct: Math.round(total/(5*1024*1024)*100) };
    },
    __store: store, __idbCache: _idbCache, __win: win,
  };
  vm.createContext(ctx);
  vm.runInContext(block, ctx);
  return ctx;
}

function big(kb){ return 'x'.repeat(kb*1024); }

(async () => {
  // ── 텍스트 과다: 큰 것부터 목표(75%) 밑으로 내려갈 때까지만 이동 ──
  (function seed(c){
    c.__store['routine_logs_v1']=JSON.stringify({n:big(1400)}); // ~2.7MB
    c.__store['memos_v5']=JSON.stringify([{t:big(1200)}]);      // ~2.4MB
    c.__store['diary_entries_v1']=JSON.stringify({d:big(1000)});// ~2.0MB
    c.__store['task_items_v1']=JSON.stringify([{x:big(600)}]);  // ~1.2MB
    c.__store['task_cats_v1']=JSON.stringify([{id:'a'}]);       // 작음
  })(globalThis.__c = makeCtx());
  const c = globalThis.__c;
  const before = c.returnStorageReport().usedPct;
  const res = await c.returnSpillDataToIdb(75);
  const after = c.returnStorageReport().usedPct;

  t.ok('정리 전 사용률 100% 초과(재현)', before>100);
  t.ok('실제로 이동 발생(>0)', res.moved>0);
  t.ok('사용률이 목표 밑으로 내려감', after<=75);
  t.ok('가장 큰 키부터 이동(routine_logs)', 'routine_logs_v1' in c.__idbCache);
  t.ok('이동한 키는 localStorage에서 제거', !('routine_logs_v1' in c.__store));
  t.ok('목표 도달 후 불필요한 이동 없음(작은/일부 키 보존)', ('task_cats_v1' in c.__store));

  // ── 스테일(역전파 위험) 키는 절대 건드리지 않음 ──
  const c2 = makeCtx();
  c2.__store['memos_v5']=JSON.stringify([{t:big(2000)}]);
  c2.__win.__staleQuotaKeys['memos_v5']=true;
  const res2 = await c2.returnSpillDataToIdb(75);
  t.ok('스테일 키는 이동하지 않음', !('memos_v5' in c2.__idbCache) && ('memos_v5' in c2.__store) && res2.moved===0);

  // ── 64KB 미만 키는 이동 이득이 없어 건드리지 않음 ──
  const c3 = makeCtx();
  c3.__store['memos_v5']=JSON.stringify([{t:'small'}]);
  const res3 = await c3.returnSpillDataToIdb(75);
  t.ok('작은 키는 이동 안 함', res3.moved===0 && ('memos_v5' in c3.__store));

  // ── IDB 미준비면 아무것도 안 함(부팅 초기 안전) ──
  const c4 = makeCtx();
  c4._idbReady=false;
  c4.__store['memos_v5']=JSON.stringify([{t:big(1500)}]);
  const res4 = await c4.returnSpillDataToIdb(75);
  t.ok('_idbReady=false면 이동 안 함', res4.moved===0 && ('memos_v5' in c4.__store));

  // ── 동기화 컬렉션 밖 키는 대상 아님(부팅 rehydrate가 못 살리므로) ──
  const c5 = makeCtx();
  c5.__store['some_unlisted_key']=big(2000);
  const res5 = await c5.returnSpillDataToIdb(75);
  t.ok('허용 목록 밖 키는 이동 안 함', res5.moved===0 && ('some_unlisted_key' in c5.__store));

  // ── 소스 배선: 정리 파이프라인이 스필을 호출하고 결과/토스트에 반영 ──
  t.ok('cleanupNow가 스필 호출', /if\(_midPct>=\(typeof RETURN_STORAGE_SOFT_PCT[\s\S]*?returnSpillDataToIdb\(75\)/.test(html));
  t.ok('결과에 dataMovedToIdb 포함', /dataMovedToIdb:dataMoved/.test(html));
  t.ok('토스트에 데이터 이동 표기', /데이터 '\+dataMoved\+'개 이동/.test(html));
  t.ok('부팅 rehydrate 대상 키만 스필(동일 목록)', /var safe = \(typeof RETURN_SYNC_COLLECTION_KEYS/.test(html));

  t.done();
})();
