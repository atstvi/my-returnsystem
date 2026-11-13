'use strict';
/* 데이터 롤백 사고 — "한 달치 완료가 풀리고, 만든 할일·수정이 사라지고, 전체가 예전 데이터가 됨".

   실제 재현(두 기기 하네스, 실제 브라우저 저장 한도): 어떤 기기가 한 달 전 사본을 클라우드에 올린 뒤,
   최신 데이터를 가진 기기 A가 그 스냅샷을 받는다. A의 저장공간이 거의 차 있으면 병합 결과
   (클라우드 + A의 새 항목·최신 완료)는 옛 사본보다 커서 쓰기가 QuotaExceeded로 실패했고, 그 예외가
   병합 분기의 빈 catch에 삼켜진 뒤 '일반 덮어쓰기'로 흘러 더 작은 옛 클라우드 값이 저장됐다 →
   A까지 옛 데이터가 되고, 그 상태가 확정됐다(완료 풀림·새 할일 사라짐·제목 되돌아감 동시 발생).

   또 클라우드에 없는 로컬 항목은 '이 세션에 만든 것'만 남겨, 옛 사본이 들어오면 지난 세션의 인박스·
   프로젝트·기록·취미 항목과 최근 완료한 할일이 사라졌다(다음 저장의 자동 tombstone이 그 삭제를 퍼뜨림).

   이 테스트는 실제 fbApplyData를 sandbox에서 실행해:
   1. 병합 쓰기가 용량 초과여도 옛 클라우드 값으로 덮지 않고 '병합 결과'를 IDB로 보낸다(fail-closed).
   2. 병합 중 예외면 그 키는 로컬 유지 + '동기화됨'으로 기록하지 않는다.
   3. 지난 세션 로컬 전용 인박스·프로젝트, 최근 완료 할일은 보존하고, tombstone된 것만 버린다.
   4. 크게 되돌리는 동기화는 쓰기 전에 버전 스냅샷을 남긴다.
   + 저장(fbSaveNow) 쪽 배선: 클라우드를 못 읽으면 올리지 않음 · 값 기반 변경 감지 · 병합 실패 키 건너뜀. */
const { readIndex, sliceBlock, runner, syncHelpersSource } = require('./lib');
const vm = require('vm');

const html = readIndex();
const t = runner('동기화 롤백 방지 (fail-closed 병합 · 로컬 전용 보존 · 되돌림 스냅샷)');

const fbApplyBlock = sliceBlock(html, 'function fbApplyData(data){', '\nfunction fbStatusTime(');
const tombBlock = sliceBlock(html, "var RETURN_TOMBSTONE_KEY='return_tombstones_v1';", 'window.returnTombstoneMark=returnTombstoneMark;');
const protectBlock = sliceBlock(html, 'function returnTaskIsProtectedLocalOnly(t){', 'window.returnTaskIsProtectedLocalOnly=returnTaskIsProtectedLocalOnly;');
const quotaBlock = sliceBlock(html, 'function __isQuotaError(e){', '\n/* Build an honest');

const NOW = Date.now();
const SESSION = NOW - 60 * 1000;          // 이 세션은 1분 전에 시작
const DAY = 86400000;

function makeSandbox(store, opts) {
  opts = opts || {};
  const written = Object.assign({}, store || {});
  const idb = {}, snaps = [], stale = {};
  const sb = {
    window: {}, console: { error() {}, warn() {}, log() {} },
    Date, JSON, Math, Object, Array, String, Number, Promise,
    setTimeout: () => {}, clearTimeout: () => {},
    _rawSetItem: (k, v) => {
      if (opts.quotaOver != null && String(v).length > opts.quotaOver) { const e = new Error("Failed to execute 'setItem' on 'Storage': exceeded the quota."); e.name = 'QuotaExceededError'; throw e; }
      written[k] = v;
    },
    localStorage: {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(sb._idbCache, k) ? sb._idbCache[k] : (k in written ? written[k] : null)),
      setItem: (k, v) => { written[k] = String(v); },
      removeItem: (k) => { delete written[k]; },
    },
    _idbCache: {}, _idbOverflow: {},
    _idbSet: (k, v) => { idb[k] = v; return Promise.resolve(); },
    _idbDelete: (k) => { delete sb._idbCache[k]; delete idb[k]; },
    __markStaleQuota: (k) => { stale[k] = 1; },
    __clearStaleQuota: (k) => { delete stale[k]; },
    returnSnapshotNow: (r) => { snaps.push(r); return Promise.resolve(true); },
    _applyingFbData: false, _lastRemoteApplyMs: 0, _lastRepairSaveMs: 0,
    _returnSessionLoadMs: SESSION,
    _fbLastPushedSnapshot: {},
    MEDIA_SYNC_KEY: 'return_media_sync_v1', _mediaSyncManifest: null,
    fbSaveAll: () => {}, setReturnStorageItem: (k, v) => { written[k] = v; return true; },
    _getArchiveCfg: () => ({ taskDays: 90, auto: true }),
  };
  vm.createContext(sb);
  vm.runInContext(quotaBlock, sb);
  vm.runInContext(syncHelpersSource(html), sb);
  vm.runInContext(tombBlock, sb);
  vm.runInContext(protectBlock, sb);
  vm.runInContext(fbApplyBlock, sb);
  if (opts.after) opts.after(sb);
  return { sb, written, idb, snaps, stale };
}
const tasksOf = (s) => { try { return JSON.parse(s || '[]'); } catch (e) { return null; } };
const T = (id, extra) => Object.assign({ id, text: '할일' + id, catId: 'work', date: '2026-11-01', done: false, subs: [], createdAt: NOW - 40 * DAY, updatedAt: NOW - 40 * DAY }, extra || {});

/* 한 달 전 사본(클라우드) vs 최신 로컬 */
const staleCloud = [T(1), T(2), T(3, { text: '원래 제목' }), T(9, { text: '다른 기기에서만 만든 할일 '.repeat(8), createdAt: NOW - 1000, updatedAt: NOW - 1000 })];
const freshLocal = [
  T(1, { done: true, updatedAt: NOW - 5 * DAY }),
  T(2, { done: true, updatedAt: NOW - 3 * DAY }),
  T(3, { text: 'A에서 고친 제목', updatedAt: NOW - 2 * DAY }),
  T(4, { text: '지난주에 만든 할일', createdAt: NOW - 7 * DAY, updatedAt: NOW - 7 * DAY }),
  T(5, { text: '지난주에 만들고 끝낸 할일', done: true, createdAt: NOW - 8 * DAY, updatedAt: NOW - 6 * DAY }),
];
const check = (arr) => {
  const by = {}; (arr || []).forEach((x) => { by[x.id] = x; });
  const miss = [];
  if (!(by[1] && by[1].done)) miss.push('1 완료 풀림'); if (!(by[2] && by[2].done)) miss.push('2 완료 풀림');
  if (!(by[3] && by[3].text === 'A에서 고친 제목')) miss.push('3 제목 되돌아감');
  if (!by[4]) miss.push('4(지난주 할일) 사라짐'); if (!by[5]) miss.push('5(지난주 완료 할일) 사라짐');
  if (!by[9]) miss.push('9(다른 기기 새 할일) 빠짐');
  return miss.join(', ') || 'OK';
};

/* 1. 저장공간이 거의 찬 기기: 병합 쓰기 실패 → 옛 값으로 덮지 않고 병합 결과를 IDB로 */
{
  const localStr = JSON.stringify(freshLocal), cloudStr = JSON.stringify(staleCloud);
  // 옛 클라우드 값(작음)은 들어가고, 병합 결과(큼)는 안 들어가는 한도
  const merged = JSON.stringify(freshLocal.concat([staleCloud[3]]));
  const limit = Math.max(cloudStr.length, localStr.length) + 10;
  t.ok('(전제) 병합 결과가 한도를 넘고 옛 값은 들어감', merged.length > limit && cloudStr.length <= limit);
  const { sb, written, idb, stale } = makeSandbox({ task_items_v1: localStr }, { quotaOver: limit });
  sb.fbApplyData({ keys: { task_items_v1: cloudStr }, updatedAtMs: NOW });
  const visible = tasksOf(sb.localStorage.getItem('task_items_v1'));
  t.ok('옛 클라우드 값이 로컬을 덮지 않음(예전: 완료 풀림·새 할일 사라짐·제목 되돌아감)', written.task_items_v1 !== cloudStr, written.task_items_v1 && written.task_items_v1.slice(0, 80));
  t.ok('읽히는 값 = 병합 결과(이 기기 최신 + 다른 기기 새 항목)', check(visible) === 'OK', check(visible));
  t.ok('병합 결과를 IDB 오버플로로 보냄 + 업로드도 IDB 값을 쓰게 표시', check(tasksOf(idb.task_items_v1)) === 'OK' && stale.task_items_v1 === 1);
}

/* 2. 병합 중 예외 → 그 키는 로컬 유지, '동기화됨'으로 기록 안 함 */
{
  const localStr = JSON.stringify(freshLocal);
  const { sb, written } = makeSandbox({ task_items_v1: localStr }, { after: (s) => { s.returnDedupById = () => { throw new Error('boom'); }; } });
  sb.fbApplyData({ keys: { task_items_v1: JSON.stringify(staleCloud), return_theme_mode: 'dark' }, updatedAtMs: NOW });
  t.ok('병합 예외 → 로컬 그대로(옛 값으로 대신 덮지 않음)', written.task_items_v1 === localStr);
  t.ok('그 키는 동기화됨으로 기록 안 함(다음 저장이 다시 병합) · 다른 키는 기록', !('task_items_v1' in sb._fbLastPushedSnapshot) && sb._fbLastPushedSnapshot.return_theme_mode === 'dark');
  t.ok('배열이 아닌 클라우드 값(깨짐)도 덮지 않음', (() => { const r = makeSandbox({ inbox_v1: '[{"id":1,"text":"x","ts":1}]' }); r.sb.fbApplyData({ keys: { inbox_v1: '{"broken":true}' }, updatedAtMs: NOW }); return r.written.inbox_v1 === '[{"id":1,"text":"x","ts":1}]'; })());
}

/* 3. 지난 세션의 로컬 전용 항목 보존, tombstone된 것만 버림 */
{
  const { sb, written } = makeSandbox({ task_items_v1: JSON.stringify(freshLocal) });
  sb.fbApplyData({ keys: { task_items_v1: JSON.stringify(staleCloud) }, updatedAtMs: NOW });
  t.ok('할일: 저장공간 여유가 있어도 결과는 같음(최근 완료·지난주 할일 보존)', check(tasksOf(written.task_items_v1)) === 'OK', check(tasksOf(written.task_items_v1)));
}
{
  const ib = [{ id: 11, text: '지난주 인박스', ts: NOW - 7 * DAY, createdAt: NOW - 7 * DAY }, { id: 12, _eid: 'ib_12', text: '다른 기기에서 지운 인박스', ts: NOW - 9 * DAY, createdAt: NOW - 9 * DAY }];
  const tomb = JSON.stringify({ ib_12: { deletedAt: NOW - DAY, collection: 'inbox' } });
  const { sb, written } = makeSandbox({ inbox_v1: JSON.stringify(ib), return_tombstones_v1: tomb });
  sb.fbApplyData({ keys: { inbox_v1: '[]' }, updatedAtMs: NOW });
  const out = tasksOf(written.inbox_v1);
  t.ok('인박스: 지난 세션 항목은 보존, 다른 기기가 지운(tombstone) 항목은 제거', out.some((x) => x.id === 11) && !out.some((x) => x.id === 12), out);
}
{
  const { sb, written } = makeSandbox({ memos_v5: JSON.stringify([{ id: 'm1', text: '지난주 메모', ts: NOW - 7 * DAY }]) });
  sb.fbApplyData({ keys: { memos_v5: '[]' }, updatedAtMs: NOW });
  t.ok('기록(메모): 지난 세션 로컬 전용 항목 보존', (tasksOf(written.memos_v5) || []).some((x) => x.id === 'm1'));
}
{
  const { sb } = makeSandbox({});
  const P = (x) => sb.returnTaskIsProtectedLocalOnly(x);
  t.ok('보호 규칙: 최근 완료(일반·반복 회차) 보존 · 아카이브 나이의 완료는 제외',
    P({ id: 1, done: true, updatedAt: NOW - 10 * DAY }) === true
    && P({ id: 2, done: true, _repeatId: 'ri_x', updatedAt: NOW - 3 * DAY }) === true
    && P({ id: 3, done: true, updatedAt: NOW - 85 * DAY }) === false
    && P({ id: 4, done: false }) === true);
}

/* 4. 크게 되돌리는 동기화는 쓰기 전에 스냅샷 */
{
  const local = [T(1, { done: true, updatedAt: NOW - DAY }), T(2, { done: true, updatedAt: NOW - DAY }), T(3, { done: true, updatedAt: NOW - DAY })];
  const cloudNewer = local.map((x) => Object.assign({}, x, { done: false, updatedAt: NOW }));   // 다른 기기에서 정말 더 최근에 되돌림
  const { sb, snaps } = makeSandbox({ task_items_v1: JSON.stringify(local) });
  sb.fbApplyData({ keys: { task_items_v1: JSON.stringify(cloudNewer) }, updatedAtMs: NOW });
  t.ok('완료 3건 이상 풀리면 적용 전 버전 스냅샷', snaps.length === 1 && /sync-revert:task_items_v1/.test(snaps[0].reason) && snaps[0].force === true);
  const r = makeSandbox({ task_items_v1: JSON.stringify(local.slice(0, 1)) });
  r.sb.fbApplyData({ keys: { task_items_v1: JSON.stringify(cloudNewer.slice(0, 1)) }, updatedAtMs: NOW });
  t.ok('작은 변경엔 스냅샷 안 찍음', r.snaps.length === 0);
  t.ok('되돌림 집계', JSON.stringify(sb.returnSyncRevertStats([{ id: 1, done: true }, { id: 2 }, { id: 3, done: true }], [{ id: 1, done: false }, { id: 3, done: true }])) === '{"undone":1,"removed":1,"total":3}');
}

/* 5. 값 기반 변경 감지 */
{
  const { sb } = makeSandbox({});
  sb._fbLastPushedSnapshot = { a: 'v1' };
  t.ok('마지막 동기화 값과 같으면 안 바뀜 · 다르면 바뀜 · 처음 보는 키는 바뀜', sb.returnFbCloudChangedSinceSync('a', 'v1') === false && sb.returnFbCloudChangedSinceSync('a', 'v2') === true && sb.returnFbCloudChangedSinceSync('b', 'x') === true);
  sb._fbLastPushedSnapshot = null;
  t.ok('기준을 모르면(저장 오류 직후) 판단 안 함 → 예전 시계 규칙', sb.returnFbCloudChangedSinceSync('a', 'v2') === false);
}

/* 6. 받은 항목을 '이 기기 편집'으로 다시 찍지 않음 + 받은 항목 삭제도 기록 + 대량 삭제 가드 */
{
  const stampBlock = sliceBlock(html, 'var RETURN_ENVELOPE_FIELDS=', '/* Collapse duplicate entries in an array collection');
  const prepBlock = sliceBlock(html, '/* 비교 기준(shadow)을', '/* Object-collection variant for diary');
  const store = {};
  const c = { window: {}, console: { warn() {}, log() {} }, Date, JSON, Math, Object, Array, String, Number,
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    setReturnStorageItem: (k, v) => { store[k] = String(v); return true; }, _rawSetItem: (k, v) => { store[k] = String(v); },
    timetableTaskHash: (str) => { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return String(h); },
    returnNewId: (p) => p + Math.random().toString(36).slice(2), RETURN_SCHEMA_VERSION: 1, snaps: [] };
  c.returnSnapshotNow = (r) => { c.snaps.push(r); };
  vm.createContext(c); vm.runInContext(stampBlock + '\n' + prepBlock, c);
  const old = NOW - 9 * DAY;
  // 이 기기가 마지막으로 저장한 상태(기준) → 그 뒤 동기화가 X를 'v2'로 바꿔 저장소에 씀
  const mine = [{ id: 1, text: 'X', done: false, updatedAt: old }, { id: 2, text: 'Y', done: false, updatedAt: old }];
  store.task_items_v1 = JSON.stringify(mine); c.returnEntityPrepareForSave('tasks', JSON.parse(store.task_items_v1), 't_', { storageKey: 'task_items_v1' });
  const recvAt = NOW - 1000;
  store.task_items_v1 = JSON.stringify([{ id: 1, _eid: 't_1', text: 'X v2', done: false, updatedAt: recvAt }, { id: 2, _eid: 't_2', text: 'Y', done: false, updatedAt: old }]);
  const mem = JSON.parse(store.task_items_v1); mem[1].done = true;   // 무관한 Y 체크
  c.returnEntityPrepareForSave('tasks', mem, 't_', { storageKey: 'task_items_v1' });
  t.ok('받은 X는 다시 찍지 않음(예전: X에 지금 시각 → 다른 기기의 더 최근 완료를 되돌림) · 실제로 바꾼 Y만 찍음', mem[0].updatedAt === recvAt && mem[1].updatedAt > recvAt);

  store.inbox_v1 = JSON.stringify([{ id: 11, text: '받은 인박스', ts: old }, { id: 12, text: '내 인박스', ts: old }, { id: 13, text: 'c', ts: old }, { id: 14, text: 'd', ts: old }]);
  store.__eid_shadow_inbox = '{}';   // 이 기기 기준엔 아직 없음(동기화로만 받음)
  const ib = JSON.parse(store.inbox_v1).filter((x) => x.id !== 11);
  c.returnEntityPrepareForSave('inbox', ib, 'ib_', { autoTombstone: true, storageKey: 'inbox_v1' });
  const tomb = JSON.parse(store.return_tombstones_v1 || '{}');
  t.ok('동기화로 받은 항목을 지워도 삭제 기록이 남음(예전엔 기준에 없어 안 남아 다른 기기에서 되살아남)', !!tomb.ib_11 && !tomb.ib_12);

  store.memos_v5 = JSON.stringify([1, 2, 3, 4].map((i) => ({ id: 'm' + i, text: 'm' + i, ts: old })));
  c.returnEntityPrepareForSave('memos', [{ id: 'm9', text: '새 메모', ts: NOW }], 'memo_', { autoTombstone: true, storageKey: 'memos_v5' });
  const tomb2 = JSON.parse(store.return_tombstones_v1 || '{}');
  t.ok('대량 삭제 가드: 저장된 것의 80% 이상이 한 번에 사라지면 삭제로 기록하지 않음 + 스냅샷', !tomb2.memo_m1 && !tomb2.memo_m4 && c.snaps.some((r) => /mass-removal:memos/.test(r.reason)));
}

/* 7. 예전 코드가 저장한(_eid 없는) 항목도 삭제 기록과 맞춤 */
{
  const tomb = JSON.stringify({ ib_12: { deletedAt: NOW - DAY, collection: 'inbox' }, memo_m2: { deletedAt: NOW - DAY, collection: 'memos' } });
  const { sb, written } = makeSandbox({ inbox_v1: JSON.stringify([{ id: 11, text: 'a', ts: 1 }, { id: 12, text: '지운 것', ts: 2 }]), memos_v5: JSON.stringify([{ id: 'm1', text: 'a', ts: 1 }, { id: 'm2', text: '지운 메모', ts: 2 }]), return_tombstones_v1: tomb });
  sb.fbApplyData({ keys: { inbox_v1: '[]', memos_v5: '[]' }, updatedAtMs: NOW });
  const ib = tasksOf(written.inbox_v1), mm = tasksOf(written.memos_v5);
  t.ok('_eid 없는 인박스·메모도 tombstone으로 걸러짐(예전: 통과해 되살아남)', ib.some((x) => x.id === 11) && !ib.some((x) => x.id === 12) && mm.some((x) => x.id === 'm1') && !mm.some((x) => x.id === 'm2'));
}

/* 앱 시작 · 흡수 배선 */
t.ok('인박스·메모는 탭을 열기 전에도 저장된 값으로 시작(예전: 예시/빈 값 + 빠르게 담기 → 실제 인박스 덮어씀)', /try\{ var _ibBoot=localStorage\.getItem\('inbox_v1'\); if\(_ibBoot\)\{ var _ibBootArr=JSON\.parse\(_ibBoot\); if\(Array\.isArray\(_ibBootArr\)\)inboxItems=_ibBootArr; \} \}catch\(_e\)\{\}/.test(html) && /try\{ var _mmBoot=JSON\.parse\(localStorage\.getItem\('memos_v5'\)\|\|'null'\); if\(Array\.isArray\(_mmBoot\)\)memos=_mmBoot; \}catch\(_e\)\{\}/.test(html));
t.ok('저장 쪽 흡수 뒤 메모리도 다시 읽음(옛 메모리가 받은 항목을 지우지 않게)', /RETURN_SYNC_COLLECTION_KEYS\.indexOf\(k\)>=0\)\|\|k==='hobby_items_v2'[\s\S]{0,120}\)\) \{\s*try \{ returnReloadSyncedCollections\(\); \} catch\(_e\)\{\}/.test(html));
t.ok('모든 컬렉션 저장이 기준=저장된 값', ["'tasks', tasks, 't_', {storageKey:'task_items_v1'}", "'inbox', inboxItems, 'ib_', {autoTombstone:true, storageKey:'inbox_v1'}", "'memos', memos, 'memo_', {autoTombstone:true, storageKey:'memos_v5'}", "'projects', projects, 'p_', {autoTombstone:true, storageKey:'projects_v1'}", "{autoTombstone:true, storageKey:'routine_habits_v1'}", "{autoTombstone:true, storageKey:'routine_bundles_v1'}"].every((x) => html.indexOf(x) >= 0));

/* 데이터 복구센터: 보호 스냅샷은 14일간 따로 보관 + 목록에 표시 */
t.ok('보호 스냅샷(동기화 직전 보관)은 평소 스냅샷에 밀려 지워지지 않음 · 목록에 표시', /function _snapIsProtective\(r\)\{ return \/\^\(sync-revert\|mass-removal\):\/\.test/.test(html)
  && /all\.filter\(function\(r\)\{ return _snapIsProtective\(r\)&&\(Date\.now\(\)-Number\(r\.ts\|\|0\)\)<14\*86400000; \}\)\.slice\(0,10\)\.forEach\(function\(r\)\{ keep\[r\.ts\]=1; \}\);/.test(html)
  && /_snapIsProtective\(r\)\?'<span class="rv-tag"/.test(html));

/* 저장(fbSaveNow) 배선 */
t.ok('클라우드를 못 읽으면 올리지 않음(예전: 병합 없이 전부 올리기)', /try\{ console\.warn\('\[fb\] cloud read before save failed — save postponed \(no blind push\):',_coldErr&&_coldErr\.message\); \}catch\(_\)\{\}\s*throw _coldErr;/.test(html) && !/proceeding as full push/.test(html));
t.ok('캐시가 5분 넘게 오래되면 저장 전에 다시 읽음', /var _cacheFresh = _fbCloudDocCache !== null && \(Date\.now\(\) - \(_fbCloudDocCacheAt\|\|0\)\) < RETURN_FB_CACHE_MAX_AGE_MS;\s*if \(_cacheFresh\) \{/.test(html) && /_fbCloudDocCache=cacheNew;\s*_fbCloudDocCacheAt=Date\.now\(\);/.test(html));
t.ok('병합 키는 시계 대신 "마지막 동기화 값과 다름"으로도 병합', /var _cloudChanged = cloud && \(cloud\.updatedAtMs > localApplyBaseline \|\| \(_mergeKey && returnFbCloudChangedSinceSync\(k, cloud\.fullValue\)\)\);\s*if \(!opts\.force && cloud && _cloudChanged && cloud\.fullValue !== ours\) \{/.test(html));
t.ok('병합이 실패한 키는 이번 저장에서 건너뜀(어느 쪽도 덮지 않음)', /if \(_mergeFailed\) \{[\s\S]{0,500}preservedFromCloud\.push\(k\);\s*return;\s*\}/.test(html) && (html.match(/_mergeFailed=true;/g) || []).length >= 10);
t.ok('저장 쪽 흡수 쓰기도 fail-closed(IDB 대체)', /try \{ returnFbApplyWrite\(k, valueToAbsorb, _rawSetItem\); \} finally \{ _applyingFbData = false; \}/.test(html));
t.ok('저장 쪽 로컬 전용 보존 규칙 = 받는 쪽', /var _snLocalOnly=_snOursArr\.filter\(function\(t\)\{[\s\S]{0,400}returnTaskIsProtectedLocalOnly\(t\)\)return true;\s*if\(k==='inbox_v1'\|\|k==='projects_v1'\)return true;/.test(html));

t.done();
