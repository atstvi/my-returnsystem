'use strict';
/* 저장공간 안전 게이트 — 'IDB 오버플로가 살아있으면 앱을 얼리지 않는다'.
   localStorage가 꽉 차도 IDB 오버플로가 쓰기를 durable하게 받고 있으면(읽기 _idbCache,
   동기화 fbCollectData가 IDB-only 키 포함) 전체화면 게이트로 편집을 막을 필요가 없다.
   기존엔 _storageIsFull()만 보고 무조건 막아서 '중간중간 멈춤'이 생겼다. _storageIsBlocking
   =꽉 참 AND durable 경로 없음(스테일 키 존재 또는 IDB 오버플로 자체 없음). */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('저장 게이트 IDB 헬스');

const block = sliceBlock(html,
  'function _idbOverflowHealthy(){',
  'window._storageIsBlocking=_storageIsBlocking;');

function makeCtx(opts){
  opts=opts||{};
  const win = { __staleQuotaKeys: opts.stale || {} };
  const ctx = {
    Object,
    window: win,
    _idbOverflow: ('idb' in opts) ? opts.idb : {},   // 기본 = 열림
    _idbReady: ('ready' in opts) ? opts.ready : true,
    _storageIsFull: () => ('full' in opts) ? opts.full : true,  // 기본 = 꽉 참
  };
  vm.createContext(ctx);
  vm.runInContext(block, ctx);
  return ctx;
}

// ── _idbOverflowHealthy ──
t.ok('IDB 열림+준비+스테일 없음 → healthy', makeCtx()._idbOverflowHealthy()===true);
t.ok('스테일 키 있으면 → unhealthy', makeCtx({stale:{task_items_v1:1}})._idbOverflowHealthy()===false);
t.ok('IDB 오버플로 없으면 → unhealthy', makeCtx({idb:null})._idbOverflowHealthy()===false);
t.ok('_idbReady=false면 → unhealthy(패치 전)', makeCtx({ready:false})._idbOverflowHealthy()===false);

// ── _storageIsBlocking ──
t.ok('안 꽉 찼으면 blocking 아님', makeCtx({full:false})._storageIsBlocking()===false);
t.ok('꽉 참 + IDB 건강 → blocking 아님(얼리지 않음)', makeCtx({full:true})._storageIsBlocking()===false);
t.ok('꽉 참 + 스테일(durable 경로 없음) → blocking', makeCtx({full:true,stale:{memos_v5:1}})._storageIsBlocking()===true);
t.ok('꽉 참 + IDB 오버플로 없음 → blocking', makeCtx({full:true,idb:null})._storageIsBlocking()===true);

// ── 소스 배선: 게이트/자동완화가 _storageIsBlocking을 사용 ──
t.ok('게이트가 _storageIsBlocking 사용', /function returnStorageSafetyGate\(opts\)\{[\s\S]*?var full=_storageIsBlocking\(\);/.test(html));
t.ok('게이트 재확인도 _storageIsBlocking', /#rsg-recheck[\s\S]*?if\(!_storageIsBlocking\(\)\)\{ ov\.remove/.test(html));
t.ok('정리 후 재판정도 _storageIsBlocking', /returnStorageCleanupNow\(\)\.then\(function\(\)\{ if\(!_storageIsBlocking\(\)\)/.test(html));
t.ok('자동완화는 durable 경로 없을 때만 게이트', /if\(_storageIsBlocking\(\)\)\{ try\{ returnStorageSafetyGate\(\);/.test(html));
t.ok('자동완화 진입 트리거는 여전히 _storageIsFull', /if\(!_storageIsFull\(\)\) return false;/.test(html));

t.done();
