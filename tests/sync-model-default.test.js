'use strict';
/* 동기화 기본값 = 'legacy' 여야 한다(그리고 그렇게 유지되어야 한다).
   회귀 배경: RETURN_SYNC_MODEL 기본값이 'entity'로 바뀌어, 명시적으로 참여하지
   않은 기기에서도 per-entity 병합 권한(6d)이 켜졌다. RETURN_ENTITY_DUALWRITE는
   기본 false여서, fbEntityMergeIntoLocal이 '이 기기가 절대 안 쓰는' 낡은 클라우드
   엔티티 미러를 로그인/원격 스냅샷마다 로컬에 병합 → 방금 한 편집이 옛 미러 상태로
   되돌려졌다(사용자 리포트: "직전 변경사항이 되돌려짐").
   가드 두 겹:
     1) 코드 기본값을 'legacy'로 복구(문서 STAGE9 게이트·주변 주석과 일치).
     2) fbEntityMergeIntoLocal은 dual-write가 켜져 있을 때만 병합(안 쓰는 미러에서
        읽어와 로컬을 덮지 않음) — 낡은 명시 플래그로도 되돌림이 못 새게. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('동기화 기본값·엔티티 병합 가드');

// ── 1. 기본값 'legacy' ──
t.ok('RETURN_SYNC_MODEL 기본값 legacy(localStorage 없음)',
  /var RETURN_SYNC_MODEL=\(function\(\)\{ try\{return localStorage\.getItem\('return_sync_model'\)\|\|'legacy';\}catch\(e\)\{return 'legacy';\} \}\)\(\);/.test(html));
t.ok('기본값이 entity로 되돌아가지 않았는지(회귀 가드)',
  !/localStorage\.getItem\('return_sync_model'\)\|\|'entity'/.test(html));

// ── 2. 엔티티 병합은 dual-write 필요 ──
t.ok('fbEntityMergeIntoLocal: dual-write 없으면 skip',
  /if\(!RETURN_ENTITY_DUALWRITE\)return \{skipped:true, ?reason:'no-dualwrite'\};/.test(html));
// 순서: RETURN_SYNC_MODEL 가드 → dual-write 가드 → fbDb/fbUser 가드
t.ok('가드 순서(모델→dualwrite→로그인)',
  /if\(RETURN_SYNC_MODEL!=='entity'\)return \{skipped:true\};[\s\S]{0,900}?if\(!RETURN_ENTITY_DUALWRITE\)return \{skipped:true[\s\S]{0,80}?if\(!fbDb\|\|!fbUser\)return \{skipped:true\};/.test(html));

// ── 3. 런타임 확인: dual-write off면 미러를 아예 읽지 않음(로컬 편집 보존) ──
const block = sliceBlock(html, 'async function fbEntityMergeIntoLocal(ref){', 'window.returnEntityMergeArray=returnEntityMergeArray;');
let readCalled = false;
const ctx = {
  RETURN_SYNC_MODEL: 'entity',
  RETURN_ENTITY_DUALWRITE: false,
  fbDb: {}, fbUser: { uid: 'u' },
  RETURN_ENTITY_COLLECTIONS: [],
  fbEntityReadAllDocs: async function(){ readCalled = true; return {}; },
  tombstonesLoad: function(){ return {}; },
  localStorage: { getItem(){ return null; }, setItem(){} },
  JSON, Object, Array, Number, String,
  console: { warn(){}, log(){} },
  window: {},
};
vm.createContext(ctx);
vm.runInContext(block, ctx);
(async function(){
  const res = await ctx.fbEntityMergeIntoLocal({});
  t.ok('dual-write off → skipped:true, reason no-dualwrite', res && res.skipped === true && res.reason === 'no-dualwrite');
  t.ok('dual-write off → 미러(fbEntityReadAllDocs) 자체를 안 읽음', readCalled === false);
  t.done();
})();
