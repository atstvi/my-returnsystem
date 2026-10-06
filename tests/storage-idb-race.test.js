'use strict';
/* 저장공간 정리(IDB 이동)·오버플로 폴백과 사용자 편집이 겹칠 때 편집이 사라지면 안 된다.

   유실 경로(수정 전):
     정리: v_old 읽음 → await _idbSet(k, v_old) ┐
     사용자: setReturnStorageItem(k, v_new)       │ (await 동안)
     IDB 커밋 완료 → _idbCache[k]=v_old           ┘
     정리: localStorage.removeItem(k)  → v_new 영구 삭제, getItem은 v_old 반환
   또 오버플로 폴백: IDB 커밋이 늦게 끝나면 그 사이 localStorage에 안착한 더 새 값을
   _idbCache(getItem 우선)가 가린다.

   계약: _idbSet은 시작 시점의 쓰기 세대를 기억하고, 커밋 시 세대가 바뀌었으면 자기 사본을
   버리고 superseded로 거절한다. 이동 헬퍼는 이동 직전 값을 원시 localStorage에서 다시 읽고,
   거절되면 localStorage를 지우지 않는다. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('저장공간 IDB 이동 ↔ 동시 편집 경합');

const genBlock = sliceBlock(html, 'var _idbWriteGen = {};', '\nvar _idbReady = false;');
const setBlock = sliceBlock(html, 'function _idbSet(key, value){', '\nfunction _idbDelete(key){');
const delBlock = sliceBlock(html, 'function _idbDelete(key){', '\n/* ═');
const moveBlock = sliceBlock(html, 'async function _returnMoveKeyToIdb(k){', '\nasync function returnSpillDataToIdb(');

function makeEnv(){
  const ls = {}; const idb = {}; const pending = [];
  const ctx = {
    Error, Object, Promise,
    _idbCache: {},
    /* 커밋을 수동으로 끝낼 수 있는 가짜 IndexedDB */
    _idbOverflow: {
      transaction(){
        const tx = { oncomplete:null, onerror:null };
        tx.objectStore = () => ({
          put(v,k){ pending.push(() => { idb[k]=v; tx.oncomplete && tx.oncomplete(); }); return {}; },
          delete(k){ delete idb[k]; return {}; },
        });
        return tx;
      },
    },
    localStorage: {
      getItem(k){ if(Object.prototype.hasOwnProperty.call(ctx._idbCache,k)) return ctx._idbCache[k]; return k in ls ? ls[k] : null; }, /* 패치된 getItem: 캐시 우선 */
      removeItem(k){ delete ls[k]; },
    },
    Storage: { prototype: { getItem(k){ return k in ls ? ls[k] : null; } } }, /* 원시 getItem */
  };
  vm.createContext(ctx);
  vm.runInContext(genBlock, ctx); vm.runInContext(setBlock, ctx); vm.runInContext(delBlock, ctx); vm.runInContext(moveBlock, ctx);
  /* 앱의 _rawSetItem과 같은 계약: 쓰기 성공 시 세대 증가 */
  ctx.userWrite = (k, v) => { ls[k] = v; ctx._idbBumpGen(k); };
  return { ctx, ls, idb, flush: () => { while(pending.length) pending.shift()(); } };
}
const tick = () => new Promise(r => setImmediate(r));

(async () => {
  // 1) 정리 이동 중 사용자 편집 → 편집 보존, IDB 사본 폐기, localStorage 유지
  {
    const e = makeEnv();
    e.ls.task_items_v1 = 'OLD';
    const p = e.ctx._returnMoveKeyToIdb('task_items_v1');
    e.ctx.userWrite('task_items_v1', 'NEW');        // await 동안 편집
    e.flush();                                       // IDB 커밋 완료
    const freed = await p.catch(err => (err && err.superseded) ? 'superseded' : 'err:'+err);
    t.ok('경합 시 이동 거절(superseded)', freed === 'superseded', freed);
    t.ok('편집값이 localStorage에 남음', e.ls.task_items_v1 === 'NEW');
    t.ok('getItem이 스테일 IDB 값으로 가리지 않음', e.ctx.localStorage.getItem('task_items_v1') === 'NEW');
    t.ok('스테일 IDB 사본 삭제', !('task_items_v1' in e.idb) && !('task_items_v1' in e.ctx._idbCache));
  }
  // 2) 경합 없으면 정상 이동
  {
    const e = makeEnv();
    e.ls.memos_v5 = 'M';
    const p = e.ctx._returnMoveKeyToIdb('memos_v5');
    e.flush();
    const freed = await p;
    t.ok('정상 이동: localStorage 제거', !('memos_v5' in e.ls) && freed > 0);
    t.ok('정상 이동: getItem은 IDB 캐시로 같은 값', e.ctx.localStorage.getItem('memos_v5') === 'M');
  }
  // 3) 후보 수집 후 다른 키를 옮기는 동안 이 키가 바뀜 → 이동 직전 다시 읽어 최신값을 옮김
  {
    const e = makeEnv();
    e.ls.a = 'A0'; e.ls.b = 'B0';
    const pa = e.ctx._returnMoveKeyToIdb('a');
    e.ctx.userWrite('b', 'B1');                      // a 이동 중 b 편집
    e.flush(); await pa;
    const pb = e.ctx._returnMoveKeyToIdb('b');
    e.flush(); await pb;
    t.ok('나중 키는 이동 직전 값(B1)으로 이동', e.ctx.localStorage.getItem('b') === 'B1');
  }
  // 4) 오버플로 폴백(_idbSet 직접) 뒤 localStorage 쓰기가 이기면 캐시가 가리지 않음
  {
    const e = makeEnv();
    const p = e.ctx._idbSet('diary_entries_v1', 'OVERFLOW_V1');
    e.ctx.userWrite('diary_entries_v1', 'LS_V2');   // 공간이 생겨 다음 쓰기는 localStorage에 성공
    e.flush();
    const r = await p.then(() => 'ok', err => (err && err.superseded) ? 'superseded' : 'err');
    t.ok('늦은 IDB 커밋은 superseded', r === 'superseded');
    t.ok('getItem = 최신 localStorage 값', e.ctx.localStorage.getItem('diary_entries_v1') === 'LS_V2');
  }
  // 소스 배선
  t.ok('_rawSetItem이 쓰기 세대를 올림', /var _rawSetItem = function\(k, v\)\{ _nativeSetItem\(k, v\); try\{ if\(typeof _idbBumpGen==='function'\)_idbBumpGen\(k\); \}catch\(_e\)\{\} \};/.test(html));
  t.ok('오버플로 폴백: superseded는 실패로 기록 안 함', /if\(e2&&e2\.superseded\)\{ __storageHealthRecord\(\{key:key,mode:'local',ok:true\}\); return; \}/.test(html));
  t.ok('미디어 압축·데이터 스필 모두 안전 헬퍼 사용', (html.match(/var r=await _returnMoveKeyToIdb\(ck\);/g) || []).length === 2 && !/await _idbSet\(ck,cv\)/.test(html));
  t.done();
})();
