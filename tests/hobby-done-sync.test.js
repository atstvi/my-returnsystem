'use strict';
/* 취미 완료가 풀리던 문제(기기 간). 재현(가짜 Firestore 두 기기):
   - 두 기기가 비슷한 때 취미를 고치면 한쪽 변경(완료 체크 포함)이 사라지거나, 한 기기에만 미완료로 남음.
   - 업데이트 전 상태로 꺼져 있던 기기가 켜지자마자 다른 취미를 고치면 그 편집이 사라짐.
   원인: ① 체크가 updatedAt을 안 바꿈 ② 받을 때 새 항목만 지키고 나머지는 클라우드로 통째로 덮음
   ③ 올릴 때 항목별 병합 결과를 '클라우드 + 새 로컬 항목'으로 다시 덮음.
   계약: 저장 시 '실제로 바뀐 항목만' updatedAt(마지막 저장값 기준) · 받을 때/올릴 때 항목별 LWW. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('취미 완료 동기화(항목별 병합)');

const store = {};
const ctx = {
  Date, JSON, String, Array, Object, Number, Math,
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
  setReturnStorageItem: (k, v) => { store[k] = String(v); return true; },
  console: { error() {}, warn() {} },
  RETURN_SCHEMA_VERSION: 1,
  returnMarkRecentLocalEdit() {}, returnMarkPendingEdit() {}, _returnPendingSave() {},
  returnTombstoneMarkMany() {}, tombstonesLoad: () => ({}), returnNewId: (p) => p + 'x',
  timetableTaskHash: (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return String(h); },
};
vm.createContext(ctx);
vm.runInContext(sliceBlock(html, "var RETURN_ENVELOPE_FIELDS=", '\n'), ctx);
vm.runInContext(sliceBlock(html, 'function returnEntityBackfillIds(arr, prefix, idField){', '\nfunction '), ctx);
vm.runInContext(sliceBlock(html, 'function _entityPayloadHash(e){', '\n/* ── Recent-local-edit guard'), ctx);
vm.runInContext(sliceBlock(html, 'function returnEntityStampChanged(collection, arr){', '\nfunction '), ctx);
vm.runInContext(sliceBlock(html, 'function returnEntityPrepareForSave(collection, arr, prefix, opts){', '\nfunction '), ctx);
vm.runInContext(sliceBlock(html, 'function saveItemsData(items) {', '\n/* ── State ── */'), ctx);

/* 업데이트 직후(취미 기록 없음) 처음 저장: 바뀐 항목만 찍힘 */
store.hobby_items_v2 = JSON.stringify([{ id: 101, text: '기타 연습', done: false, createdAt: 1000 }, { id: 102, text: '전시회', done: false, createdAt: 1000 }]);
const items = JSON.parse(store.hobby_items_v2);
items[0].done = true;
ctx.saveItemsData(items);
const saved = JSON.parse(store.hobby_items_v2);
t.ok('완료 체크한 항목만 updatedAt(최신)', saved[0].updatedAt > 1000 && saved[0].done === true);
t.ok('안 바꾼 항목은 찍지 않음(옛 사본이 통째로 이기지 않게)', (saved[1].updatedAt || 0) <= 1000);
t.ok('_eid 부여(항목별 병합 · tombstone 근거)', saved[0]._eid === 'hob_101' && saved[1]._eid === 'hob_102');
const before = saved[0].updatedAt;
const again = JSON.parse(store.hobby_items_v2); ctx.saveItemsData(again);
t.ok('그대로 다시 저장하면 다시 찍지 않음', JSON.parse(store.hobby_items_v2)[0].updatedAt === before);

/* 배선 */
/* 로컬 전용 항목은 세션과 무관하게 보존(지운 항목은 자동 tombstone이 거름) — 옛 클라우드 사본이 들어와도
   지난 세션의 취미·기록 항목이 사라지지 않게(데이터 롤백 사고 대응). */
t.ok('받을 때: 항목별 LWW(로컬 전용 보존 · tombstone)', /if\(k==='hobby_items_v2'\|\|k==='memos_v5'\)\{[\s\S]{0,900}var _hmMerged=returnSyncArrayMerge\(data\.keys\[k\]\|\|'\[\]', localStorage\.getItem\(k\)\|\|'\[\]', \{keepAllLocalOnly:true, tombstones:true, eidPrefix:RETURN_EID_PREFIX\[k\]\}\);/.test(html));
t.ok('올릴 때: 항목별 병합 결과를 덮던 블록 제거 · 같은 보존 규칙', !/_snLocalOnlyHM/.test(html) && /var _hm=returnSyncArrayMerge\(cloud\.fullValue, ours, \{keepAllLocalOnly:true, tombstones:true, eidPrefix:RETURN_EID_PREFIX\[k\]\}\);/.test(html));
t.done();
