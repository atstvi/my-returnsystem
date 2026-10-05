'use strict';
/* 동기화 병합 누락 유실 2차 — 배열 컬렉션 공용 union-merge(returnSyncArrayMerge)와
   그 적용부(루틴 습관/번들, 메모, 취미)를 고정한다.
   발견: routine_habits_v1/bundles_v1은 인바운드가 'dedup 후 클라우드 덮어쓰기'라 로컬
   추가/편집이 유실(인바운드에서도!), 아웃바운드엔 병합 자체가 없었다. memos/hobby는
   인바운드엔 로컬 전용 보존이 있으나 아웃바운드가 없었다. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('동기화 배열 union-merge(2차 유실 방지)');

// ── 런타임: returnSyncArrayMerge ──
const block = sliceBlock(html, 'function returnSyncArrayMerge(cloudStr, localStr, opts){', 'window.returnSyncArrayMerge=returnSyncArrayMerge;');
function mk(){
  const ctx = { JSON, Number, String, Array, returnDedupById:function(a){ var seen={},out=[],rem=0; (a||[]).forEach(function(x){ var k=x&&(x.id!=null?x.id:x._eid); if(k==null){out.push(x);return;} if(seen[String(k)]){rem++;return;} seen[String(k)]=1; out.push(x); }); return {arr:out,removed:rem}; }, returnEntityFilterTombstoned:function(a){ return (a||[]).filter(function(x){ return !(x&&x.__tomb); }); } };
  vm.createContext(ctx); vm.runInContext(block, ctx);
  return ctx.returnSyncArrayMerge;
}
const merge = mk();

// 1) keepAllLocalOnly: 클라우드에 없는 로컬 습관은 보존(인바운드 유실 방지)
var r1 = merge(JSON.stringify([]), JSON.stringify([{id:'rh_new',title:'새',updatedAt:1}]), {keepAllLocalOnly:true, tombstones:true});
t.ok('로컬 전용 습관 보존(keepAll)', Array.isArray(r1)&&r1.some(function(x){return x.id==='rh_new';}), JSON.stringify(r1));

// 2) tombstone된 로컬 전용은 되살리지 않음
var r2 = merge(JSON.stringify([]), JSON.stringify([{id:'rh_del',__tomb:true,updatedAt:1}]), {keepAllLocalOnly:true, tombstones:true});
t.ok('삭제(tombstone) 습관은 되살림 안 함', Array.isArray(r2)?!r2.some(function(x){return x.id==='rh_del';}):true, JSON.stringify(r2));

// 3) LWW: 같은 id 로컬이 더 최신이면 유지
var r3 = merge(JSON.stringify([{id:'a',title:'옛',updatedAt:1000}]), JSON.stringify([{id:'a',title:'새',updatedAt:2000}]), {keepAllLocalOnly:true});
t.ok('편집 LWW(로컬 최신 유지)', r3&&r3[0].title==='새', JSON.stringify(r3));

// 4) 클라우드가 더 최신이면 클라우드 채택 → 변경 없으면 null
var r4 = merge(JSON.stringify([{id:'a',title:'클',updatedAt:3000}]), JSON.stringify([{id:'a',title:'옛',updatedAt:1000}]), {keepAllLocalOnly:true});
t.ok('변경 없으면 null(클라우드 그대로)', r4===null, JSON.stringify(r4));

// 5) baseline 모드: baseline 이후 생성분만 보존(memos/hobby용)
var r5 = merge(JSON.stringify([]), JSON.stringify([{id:'m1',ts:5000},{id:'m0',ts:10}]), {baseline:100});
t.ok('baseline 이후 추가만 보존', r5&&r5.some(function(x){return x.id==='m1';})&&!r5.some(function(x){return x.id==='m0';}), JSON.stringify(r5));

// ── 소스 배선 ──
t.ok('헬퍼 정의', /function returnSyncArrayMerge\(cloudStr, localStr, opts\)\{/.test(html));
t.ok('routine 인바운드 union-merge', /if\(k==='routine_habits_v1'\|\|k==='routine_bundles_v1'\)\{[\s\S]*?returnSyncArrayMerge\(data\.keys\[k\], localStorage\.getItem\(k\), \{keepAllLocalOnly:true, tombstones:true\}\)/.test(html));
t.ok('routine 아웃바운드 union-merge', /var _rm=returnSyncArrayMerge\(cloud\.fullValue, ours, \{keepAllLocalOnly:true, tombstones:true\}\); if\(_rm!=null\)valueToAbsorb=JSON\.stringify\(_rm\);/.test(html));
t.ok('memos/hobby 아웃바운드 union-merge', /var _hm=returnSyncArrayMerge\(cloud\.fullValue, ours, \{baseline:localApplyBaseline\}\); if\(_hm!=null\)valueToAbsorb=JSON\.stringify\(_hm\);/.test(html));

t.done();
