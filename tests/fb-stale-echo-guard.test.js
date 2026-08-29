'use strict';
/* 스테일 에코 가드 — 취미 체크·프로필 변경 등이 '일정 시간 후 롤백'되는 현상의 근본 수정.

   증상: 사용자가 편집(취미 todo 체크, 프로필 이름/사진, 카테고리 등)을 하면 로컬엔
   반영되지만, 다른 기기가 무언가를 바꿔 root 문서가 갱신되면 그 스냅샷은 아직 이 기기의
   최근 편집을 담지 않은(그 키는 예전 값 그대로인) 상태로 도착한다. 기존 apply는 그
   클라우드 값으로 로컬을 덮어써 방금 한 편집이 롤백됐다(profile_data·hobby_cats_v2는
   기본 덮어쓰기 경로, hobby_items_v2는 '새 항목만' 보존하는 union-merge라 편집을 못 지킴).

   근본 판별: 타임스탬프(시계 오차·초기화 쓰기에 취약)가 아니라 '마지막 동기화 값'
   스냅샷(_fbLastPushedSnapshot)으로 한다.
     cloud === pushed (원격은 그 뒤로 이 키를 안 바꿈) && local !== pushed (로컬만 편집됨)
     → 스테일 에코 → 로컬 유지 + 다음 저장에서 되밀기. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'function returnFbStaleEcho(k, data){', '\nfunction fbApplyData(data){');

function sandbox(pushed, store) {
  const ctx = {
    _fbLastPushedSnapshot: pushed,
    localStorage: {
      getItem: (k) => (store && k in store ? store[k] : null),
    },
    Object,
  };
  vm.createContext(ctx);
  vm.runInContext(block, ctx);
  return ctx;
}

const t = runner('스테일 에코 가드');

// 1) 클라우드는 마지막 동기화 값 그대로, 로컬만 편집됨 → 보호(true)
{
  const c = sandbox({ profile_data: '{"name":"old"}' }, { profile_data: '{"name":"new"}' });
  const r = c.returnFbStaleEcho('profile_data', { keys: { profile_data: '{"name":"old"}' } });
  t.ok('cloud===pushed & local!==pushed → 롤백 방지(true)', r === true, String(r));
}

// 2) 원격이 실제로 바뀜(cloud!==pushed) → 정상 적용(false)
{
  const c = sandbox({ profile_data: '{"name":"old"}' }, { profile_data: '{"name":"new"}' });
  const r = c.returnFbStaleEcho('profile_data', { keys: { profile_data: '{"name":"remote-changed"}' } });
  t.ok('cloud!==pushed → 원격 변경 적용(false)', r === false, String(r));
}

// 3) 로컬에 편집 없음(local===pushed) → 정상(false)
{
  const c = sandbox({ hobby_cats_v2: '[1]' }, { hobby_cats_v2: '[1]' });
  const r = c.returnFbStaleEcho('hobby_cats_v2', { keys: { hobby_cats_v2: '[1]' } });
  t.ok('local===pushed → 보호 안 함(false)', r === false, String(r));
}

// 4) 마지막 동기화 스냅샷 없음(null) → false (초기 상태)
{
  const c = sandbox(null, { profile_data: 'x' });
  const r = c.returnFbStaleEcho('profile_data', { keys: { profile_data: 'y' } });
  t.ok('_fbLastPushedSnapshot null → false', r === false, String(r));
}

// 5) 스냅샷에 없는 키 → false
{
  const c = sandbox({ other: 'z' }, { profile_data: 'x' });
  const r = c.returnFbStaleEcho('profile_data', { keys: { profile_data: 'y' } });
  t.ok('pushed 스냅샷에 없는 키 → false', r === false, String(r));
}

// 6) 로컬 값 없음(null) → false (덮어쓸 로컬 편집이 없음)
{
  const c = sandbox({ profile_data: 'p' }, {});
  const r = c.returnFbStaleEcho('profile_data', { keys: { profile_data: 'p' } });
  t.ok('localNow null → false', r === false, String(r));
}

// 7) data 없음/keys 없음 → false (방어)
{
  const c = sandbox({ profile_data: 'p' }, { profile_data: 'q' });
  t.ok('data null → false', c.returnFbStaleEcho('profile_data', null) === false);
  t.ok('keys 없음 → false', c.returnFbStaleEcho('profile_data', {}) === false);
}

// 8) 취미 체크(hobby_items_v2): 로컬만 체크됨 → 보호
{
  const cloud = '[{"id":1,"done":false}]';
  const local = '[{"id":1,"done":true}]';
  const c = sandbox({ hobby_items_v2: cloud }, { hobby_items_v2: local });
  const r = c.returnFbStaleEcho('hobby_items_v2', { keys: { hobby_items_v2: cloud } });
  t.ok('취미 체크 로컬 편집 보호(true)', r === true, String(r));
}

// ── 소스 배선 확인 ─────────────────────────────────────────────
// fbApplyData가 hydration이 아닌 apply에서만 가드를 호출하고, 발동 시 로컬 유지 + 되밀기
t.ok('fbApplyData가 !__hydrate 게이트로 가드 호출',
  /if\(!data\.__hydrate && typeof returnFbStaleEcho==='function' && returnFbStaleEcho\(k,data\)\)\{\s*taskUnionMergeAfterFbApply=true;/.test(html));
// 초기 하이드레이션 apply는 __hydrate로 표시(가드 제외) — 로그인 union-merge 우회 방지
t.ok('legacy snap 하이드레이션 __hydrate 표시', /var _snapData=snap\.data\(\);_snapData\.__hydrate=true;fbApplyData\(_snapData\)/.test(html));
t.ok('split 하이드레이션 __hydrate 표시', /splitData\.__hydrate=true;fbApplyData\(splitData\)/.test(html));

t.done();
