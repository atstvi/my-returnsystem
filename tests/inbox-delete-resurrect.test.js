'use strict';
/* "인박스(할일·프로젝트) 삭제해도 다시 생김" 근본 원인 고정.

   진단: _eid는 레거시 id에서 결정적으로 파생된다(ib_<id>). 그래서 A기기에서 지운
   항목과, 아직 그 항목을 들고 있는 B기기의 사본은 _eid가 똑같다. A의 삭제는
   tombstone(return_tombstones_v1, 동기화됨)으로 다른 기기에 전파된다.
   그런데 returnEntityPrepareForSave의 "현재 배열에 있으면 tombstone 해제" 단계가
   최신성 검사 없이 무조건 해제해서 → 삭제된 항목을 아직 들고 있는 B기기가 저장하는
   순간 tombstone이 지워지고 항목이 전 기기에서 되살아난다.

   올바른 동작(설계 주석대로): tombstone은 "그 사본의 updatedAt보다 삭제가 더 최신일
   때만" 이긴다. 따라서 해제도 "그 항목이 삭제보다 더 최신으로 재생성/재편집됐을
   때만" 해야 한다. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'function returnEntityBackfillIds(', '\nfunction returnEntityPrepareObjectForSave(');

function makeSandbox() {
  const store = {};
  const ls = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
  let counter = 0;
  const sb = {
    window: {},
    console: { error() {}, warn() {}, log() {} },
    localStorage: ls,
    setReturnStorageItem: (k, v) => { store[k] = String(v); return true; },
    JSON, Object, Array, String, Number, isNaN,
    RETURN_SCHEMA_VERSION: 1,
    RETURN_ENVELOPE_FIELDS: ['_eid', 'updatedAt', 'createdAt', 'deletedAt', 'schemaVersion', '_rev', 'modifiedBy'],
    returnNewId: (prefix) => (prefix || 'e_') + 'gen' + (++counter),
    timetableTaskHash: (str) => 'h:' + String(str),
    Date: { now: () => sb.__now },
    __now: 1000,
  };
  vm.createContext(sb);
  vm.runInContext(block, sb);
  return { sb, store };
}

const t = runner('인박스 삭제 되살아남 방지 · tombstone 해제 최신성');

// ── 스테일 사본은 tombstone을 해제하면 안 된다 ────────────────────────────────
{
  const { sb } = makeSandbox();
  // 1) 이 기기가 항목 X를 갖고 저장한 상태(shadow에 ib_1, updatedAt=4000)
  sb.__now = 4000;
  const X = { id: 1, text: 'x' };
  sb.returnEntityPrepareForSave('inbox', [X], 'ib_', { autoTombstone: true });
  t.ok('결정적 _eid 부여', X._eid === 'ib_1', X._eid);
  t.ok('updatedAt 스탬프', X.updatedAt === 4000, X.updatedAt);

  // 2) 다른 기기의 삭제가 동기화된 tombstone으로 도착(삭제 9000), 이 기기는 아직 X 보유
  sb.__now = 9000;
  sb.returnTombstoneMark('ib_1', 'inbox');
  t.ok('tombstone 활성(삭제 9000 > 사본 4000)', sb.returnTombstoneIsActive('ib_1', 4000) === true);

  // 3) 이 기기가 (X를 그대로 든 채) 다시 저장 — 페이로드 안 바뀜 → updatedAt 유지 4000
  sb.__now = 9500;
  sb.returnEntityPrepareForSave('inbox', [X], 'ib_', { autoTombstone: true });
  t.ok('스테일 사본은 updatedAt 그대로', X.updatedAt === 4000, X.updatedAt);
  // 핵심: 스테일 사본이 tombstone을 지우면 안 된다(지우면 전 기기에서 되살아남).
  t.ok('스테일 저장이 tombstone을 해제하지 않음', sb.returnTombstoneIsActive('ib_1', 4000) === true, sb.tombstonesLoad());
  // 저장 뒤에도 필터가 여전히 이 항목을 떨어뜨려야
  t.ok('되살아남 방지: 필터가 계속 제거', sb.returnEntityFilterTombstoned([X]).length === 0);
}

// ── 진짜 재생성/재편집(더 최신)은 tombstone을 해제해야 한다 ────────────────────
{
  const { sb } = makeSandbox();
  sb.__now = 4000;
  const X = { id: 2, text: 'x' };
  sb.returnEntityPrepareForSave('inbox', [X], 'ib_', { autoTombstone: true });

  sb.__now = 9000;
  sb.returnTombstoneMark('ib_2', 'inbox'); // 삭제 9000

  // 사용자가 같은 _eid 항목을 삭제 이후에 실제로 재편집 → 페이로드 변경 → updatedAt=15000
  sb.__now = 15000;
  X.text = '다시 씀';
  sb.returnEntityPrepareForSave('inbox', [X], 'ib_', { autoTombstone: true });
  t.ok('재편집은 updatedAt 갱신', X.updatedAt === 15000, X.updatedAt);
  t.ok('재편집(더 최신)이면 tombstone 해제', !('ib_2' in sb.tombstonesLoad()), sb.tombstonesLoad());
  t.ok('재편집 항목은 필터에서 살아남음', sb.returnEntityFilterTombstoned([X]).length === 1);
}

t.done();
