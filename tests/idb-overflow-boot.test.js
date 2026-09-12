'use strict';
/* iPad 데이터 손실 근본 원인: IndexedDB overflow 캐시 + localStorage.getItem 패치는
   비동기 IDB open 완료(tx.oncomplete) 후에야 설치되는데, 부팅 로더는 그 전에 동기
   실행돼 overflow된 동기화 키(task_items_v1 등, iPad 작은 quota에서 흔함)를 raw
   localStorage(null)에서 '빈 값'으로 로드했다. 그 부분 상태가 (1) 저장되어 overflow된
   IDB 값을 덮고(로컬 손실), (2) Firebase로 PUSH되어 클라우드를 덮어써 '다른 기기에서
   입력·완료·메모가 다 사라지는' 역전파를 일으켰다.

   수정 3종:
   - _idbInitSettled 게이트: overflow 캐시 로드 완료(또는 IDB 사용불가/5s 폴백) 전엔
     PUSH를 연기 → 부분 스냅샷이 클라우드를 못 덮게.
   - returnRehydrateOverflowedState: IDB 준비 시 overflow된 동기화 키를 메모리로 재수화
     → '누락된 할일'을 복구하고, 이후 저장이 완전한 데이터를 쓰게.
   - setReturnStorageItem: settle 전엔 동기화 컬렉션 키 쓰기를 건너뜀 → 부팅 시 부분
     메모리가 overflow된 IDB 값을 지우지 못하게. */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('IDB overflow 부팅 안정성');

// ── 플래그 + 동기화 컬렉션 키 목록 ──
t.ok('_idbInitSettled 플래그 선언', /var _idbInitSettled = false;/.test(html));
t.ok('동기화 컬렉션 키 목록', /var RETURN_SYNC_COLLECTION_KEYS=\['task_items_v1'[^\]]*'memos_v5'[^\]]*'diary_entries_v1'/.test(html));

// ── 재수화 ──
t.ok('returnRehydrateOverflowedState 정의', /function returnRehydrateOverflowedState\(\)\{/.test(html));
t.ok('overflow된 키가 있을 때만 재수화', /RETURN_SYNC_COLLECTION_KEYS\.some\(function\(k\)\{ return Object\.prototype\.hasOwnProperty\.call\(_idbCache,k\); \}\)/.test(html));
t.ok('tasks 재수화', /var rt=JSON\.parse\(localStorage\.getItem\('task_items_v1'\)\|\|'null'\); if\(Array\.isArray\(rt\)&&typeof tasks!=='undefined'\)\{ tasks=rt;/.test(html));

// ── settle 처리 ──
t.ok('_idbMarkSettled 정의 + 저장 플러시', /function _idbMarkSettled\(\)\{ if\(_idbInitSettled\)return; _idbInitSettled=true;[\s\S]*?fbSaveAll\(\)/.test(html));
t.ok('IDB 준비 시 재수화 후 settle', /try\{ returnRehydrateOverflowedState\(\); \}catch\(_e\)\{\}\s*_idbMarkSettled\(\);/.test(html));
t.ok('IDB 실패/미가용 시 settle', /req\.onerror = function\(e\)\{ console\.warn\('\[idb\] open failed', e\); _idbMarkSettled\(\); \};/.test(html));
t.ok('IDB 미가용(catch) settle', /console\.warn\('\[idb\] indexedDB unavailable', e\); _idbMarkSettled\(\);/.test(html));
t.ok('5초 폴백 settle', /if\(!_idbInitSettled\)\{[\s\S]*?_idbMarkSettled\(\);[\s\S]*?\}, 5000\)/.test(html));

// ── PUSH 게이트 ──
t.ok('fbSaveNow가 settle 전엔 연기', /if\(typeof _idbInitSettled!=='undefined' && !_idbInitSettled\)\{\s*clearTimeout\(_fbSaveTimer\);\s*_fbSaveTimer=setTimeout\(function\(\)\{ try\{fbSaveNow\(opts\);\}catch\(_e\)\{\} \}, 400\)/.test(html));

// ── 로컬 쓰기 스킵(settle 전, 동기화 키) ──
t.ok('setReturnStorageItem이 settle 전 동기화 키 쓰기 스킵',
  /if\(typeof _idbInitSettled!=='undefined' && !_idbInitSettled &&\s*typeof RETURN_SYNC_COLLECTION_KEYS!=='undefined' && RETURN_SYNC_COLLECTION_KEYS\.indexOf\(key\)>=0\)\{[\s\S]*?return false;/.test(html));

t.done();
