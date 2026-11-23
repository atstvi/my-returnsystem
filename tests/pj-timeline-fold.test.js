'use strict';
/* Area 전체 타임라인: 묶음(기본·프로젝트·취미) 접은 상태를 기억한다.
   예전엔 메모리(_pjTlOpen)에만 있어 새로고침·탭 이동 뒤 다시 다 펼쳐졌다.
   화면 취향이라 이 기기 localStorage에만(동기화 안 함). 접은 것만 저장. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('Area 전체 타임라인 접기 기억');

const src = sliceBlock(html, "  var PJ_TL_FOLD_KEY='pj_tl_folded_v1';", "  var _pjLogsView='all';");
function load(store) {
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const ctx = { JSON, Array, Object, String, localStorage: ls };
  vm.createContext(ctx);
  vm.runInContext(src + '\nthis._open=_pjTlOpen; this._save=_pjTlSaveFold;', ctx);
  return ctx;
}

const store = {};
let c = load(store);
t.ok('처음엔 모두 펼침(저장 없음)', Object.keys(c._open).length === 0 && !('pj_tl_folded_v1' in store));
c._open.base = false; c._open.p_12 = false; c._open.hobby = true; c._save();
t.ok('접은 것만 저장', JSON.stringify(JSON.parse(store.pj_tl_folded_v1).sort()) === JSON.stringify(['base', 'p_12']));
c = load(store);
t.ok('다시 열면 접은 상태 그대로', c._open.base === false && c._open.p_12 === false && c._open.hobby !== false);
c._open.base = true; c._open.p_12 = true; c._save();
t.ok('다 펼치면 저장 키 지움', !('pj_tl_folded_v1' in store));
t.ok('깨진 저장값이어도 안전(모두 펼침)', Object.keys(load({ pj_tl_folded_v1: '{oops' })._open).length === 0);

t.ok('토글하면 저장', /_pjTlOpen\[g\]=\(_pjTlOpen\[g\]===false\); _pjTlSaveFold\(\); renderAllTimeline\(\);/.test(html));
t.ok('동기화 대상 아님(기기 로컬)', !/pj_tl_folded_v1[^\n]*setReturnStorageItem/.test(html));

t.done();
