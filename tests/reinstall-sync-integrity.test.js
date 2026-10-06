'use strict';
/* 앱 재설치/새 기기 동기화 무결성 — "핸드폰 앱 지우고 다시 까니까 예전 할일이 뭉텅이로
   미완료로 보이고, 추가한 적 없는 기본 할일도 들어와 있음".

   원인(재현으로 확인)과 고정하는 계약:
   1) '완료 정리'(clearDone)가 생성 회차(반복·규칙 준비·시간표 수업)를 지우면 생성기가 빈
      슬롯으로 보고 즉시 '미완료'로 다시 만들었다(결정적 id + 새 updatedAt → tombstone 무력).
      → 지우기 전에 generation suppression을 남기고(쓰기보다 먼저), 시간표 재조정도 그
        억제를 존중한다. 반복 '규칙'은 건드리지 않는다.
   2) 키워드 규칙이 과거 전체 마감에 대해 준비 할일을 '새로' 만들었다 → 지난 마감은 생성 안 함.
   3) 억제 항목을 기록 후 180일에 지워 과거 회차가 다시 부활 → occurrence 날짜 400일 기준.
   4) tombstone 레지스트리(return_tombstones_v1)가 일반 키라 클라우드가 통째로 덮어써 다른
      기기의 삭제 기록이 사라짐 + 캐시(_tombstones)가 무효화되지 않음
      → eid별 max(deletedAt) 합집합 병합(인/아웃바운드), 적용 후 캐시 무효화.
   5) 데모 정리 1회 플래그가 동기화돼 재설치 기기가 정리를 건너뜀 → 기기 로컬 키. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('재설치·다기기 동기화 무결성(완료 정리 부활·tombstone 병합)');

// ── 1) suppressGeneratedTasks ──
(function(){
  const block = sliceBlock(html, 'function isGeneratedOccurrenceTask(t){', 'window.suppressGeneratedTasks=suppressGeneratedTasks;');
  const store = { gen: {}, rep: {} };
  const saves = { gen: 0, rep: 0 };
  const ctx = {
    Date, String, Array, JSON,
    generatedCanonicalType: function(x){ return x._repeatId ? 'repeat' : (x._ruleGen ? 'rule' : ''); },
    generatedTaskKey: function(x){ return x.generationKey || ''; },
    taskDateKeyLocal: function(d){ return d ? String(d).slice(0,10) : ''; },
    loadGeneratedTaskSuppressions: function(){ return JSON.parse(JSON.stringify(store.gen)); },
    saveGeneratedTaskSuppressions: function(m){ saves.gen++; store.gen = m; return true; },
    loadRepeatSuppressions: function(){ return JSON.parse(JSON.stringify(store.rep)); },
    saveRepeatSuppressions: function(m){ saves.rep++; store.rep = m; return true; },
    window: {},
  };
  vm.createContext(ctx); vm.runInContext(block, ctx);
  const list = [
    { id:'tt_a', _isTt:true, _ttId:'777', generationKey:'tt|777|s0|2026-09-07', _ttKey:'tt|777|s0|2026-09-07', date:'2026-09-07', done:true },
    { id:'tt_b', _isTt:true, _ttId:'777', _ttKey:'tt|777|s0|2026-09-14', date:'2026-09-14', done:true }, /* legacy: only _ttKey */
    { id:'g1', _repeatId:'ri_daily', generationKey:'repeat:ri_daily:2026-10-06', date:'2026-10-06', done:true },
    { id:'g2', _ruleGen:true, _ruleId:'rule_q', generationKey:'rule:rule_q:src1:2026-10-08', date:'2026-10-08', done:true },
    { id:555, text:'일반 할일', date:'2026-10-01', done:true },                      /* not generated */
  ];
  const n = ctx.suppressGeneratedTasks(list, 'cleared');
  t.ok('생성 회차 4개만 억제(일반 할일 제외)', n === 4, n);
  t.ok('시간표 회차 억제(generationKey)', !!store.gen['tt|777|s0|2026-09-07'] && store.gen['tt|777|s0|2026-09-07'].sourceType === 'timetable');
  t.ok('시간표 회차 억제(_ttKey 폴백)', !!store.gen['tt|777|s0|2026-09-14']);
  t.ok('반복 회차 억제 + repeat_suppressions에도', !!store.gen['repeat:ri_daily:2026-10-06'] && Object.keys(store.rep).length === 1);
  t.ok('규칙 회차 억제', !!store.gen['rule:rule_q:src1:2026-10-08']);
  t.ok('맵은 한 번만 저장(대량 정리 시 저장 폭주 방지)', saves.gen === 1 && saves.rep === 1, JSON.stringify(saves));
  t.ok('occurrenceDate 기록(프루닝 기준)', store.gen['tt|777|s0|2026-09-07'].occurrenceDate === '2026-09-07');
  t.ok('빈 목록 → 0, 저장 없음', ctx.suppressGeneratedTasks([], 'x') === 0 && saves.gen === 1);
})();

// ── 1b) clearDone: 억제 → tombstone → 쓰기 순서, 취소 항목 보존 ──
(function(){
  const block = sliceBlock(html, 'function clearDone() {', '\n/* ── 지난 자동 생성 정리');
  const order = [];
  const items = [
    { id:'tt_a', _isTt:true, done:true, date:'2026-09-07' },
    { id:'g1', _repeatId:'ri_daily', done:true, date:'2026-10-06' },
    { id:2, text:'취소', done:true, canceled:true },
    { id:3, text:'미완료', done:false },
  ];
  const store = { task_items_v1: JSON.stringify(items) };
  let suppressedArg = null, tombArg = null;
  const ctx = {
    JSON, String,
    confirm: function(){ return true; },
    localStorage: { getItem: function(k){ return store[k] == null ? null : store[k]; } },
    setReturnStorageItem: function(k, v){ order.push('write:'+k); store[k] = v; return true; },
    suppressGeneratedTasks: function(list, reason){ order.push('suppress'); suppressedArg = { ids: list.map(function(x){ return x.id; }), reason: reason }; return list.length; },
    returnTombstoneMarkMany: function(eids){ order.push('tombstone'); tombArg = eids; return eids.length; },
    gcalQueueTaskEventDeletion: function(){},
    showToast: function(){}, calcDataSize: function(){},
    tasks: items.slice(),
  };
  vm.createContext(ctx); vm.runInContext(block, ctx); vm.runInContext('clearDone()', ctx);
  t.ok('완료 정리: 생성 회차 억제 호출(cleared)', suppressedArg && suppressedArg.reason === 'cleared' && suppressedArg.ids.join(',') === 'tt_a,g1', JSON.stringify(suppressedArg));
  t.ok('완료 정리: 억제·tombstone이 저장(동기화 트리거)보다 먼저', order.indexOf('suppress') >= 0 && order.indexOf('suppress') < order.indexOf('write:task_items_v1') && order.indexOf('tombstone') < order.indexOf('write:task_items_v1'), JSON.stringify(order));
  t.ok('완료 정리: tombstone eid(t_+id)', tombArg && tombArg.join(',') === 't_tt_a,t_g1', JSON.stringify(tombArg));
  const left = JSON.parse(store.task_items_v1).map(function(x){ return x.id; });
  t.ok('완료 정리: 취소·미완료 보존', left.join(',') === '2,3', JSON.stringify(left));
  t.ok('완료 정리: 메모리 tasks 동기화', ctx.tasks.map(function(x){ return x.id; }).join(',') === '2,3');
  t.ok('완료 정리: 반복 규칙 삭제 경로(noteGeneratedTaskDeleted) 안 씀', !/noteGeneratedTaskDeleted\(/.test(block));
})();

// ── 1c) reconcileTimetableTasks: 억제된 회차는 재생성 안 함 ──
(function(){
  const block = sliceBlock(html, 'function reconcileTimetableTasks(opts){', 'function cleanupLegacyTimetableTaskConflicts(ttList, expected){');
  const finder = sliceBlock(html, 'function findTimetableExpectedKeyForTask(task, expected, expectedKeys){', 'function timetableTaskKey(tt, slot, dateKey, slotIdx){');
  function exp(k, date){ return { id:'tt_'+k.replace(/\W/g,''), text:'화학', catId:'schedule', date:date, timeStart:'09:00', timeEnd:'10:00', priority:'', done:false, deadlineDate:'', deadlineId:'', note:'시간표 · 내 시간표', _isTt:true, _ttId:'777', _ttSlotId:'s0', _ttSlotKey:'L0', _ttKey:k, generationKey:k, sourceType:'timetable', occurrenceDate:date, subs:[], prepItems:[], travelMin:0 }; }
  const K1 = 'tt|777|s0|2026-09-07', K2 = 'tt|777|s0|2026-09-14', K3 = 'tt|777|s0|2026-10-12';
  const expected = {}; expected[K1] = exp(K1,'2026-09-07'); expected[K2] = exp(K2,'2026-09-14'); expected[K3] = exp(K3,'2026-10-12');
  let supp = {};
  const ctx = {
    Object, JSON, String, Array, Date,
    window: {},
    localStorage: { getItem: function(){ return '[]'; } },
    buildTimetableExpectedTasks: function(){ return JSON.parse(JSON.stringify(expected)); },
    migrateGcalEventMetaKey: function(){}, queueGeneratedExternalDeletion: function(){},
    stripPrepEmoji: function(s){ return s; }, mergeGeneratedChecklist: function(a, b){ return b; },
    cleanupLegacyTimetableTaskConflicts: function(){ return 0; },
    normalizeTimetableTaskCategories: function(){}, setReturnStorageItem: function(){ return true; },
    loadGeneratedTaskSuppressions: function(){ return supp; },
    tasks: [],
  };
  vm.createContext(ctx); vm.runInContext(finder, ctx); vm.runInContext(block, ctx);
  supp = {}; supp[K1] = { sourceType:'timetable', reason:'cleared' }; supp[K2] = { sourceType:'timetable', reason:'deleted' };
  vm.runInContext('reconcileTimetableTasks({timetables:[{id:777}], silent:true})', ctx);
  const keys = ctx.tasks.map(function(x){ return x._ttKey; });
  t.ok('억제된 지난 수업(완료 정리·삭제)은 재생성 안 함', keys.indexOf(K1) < 0 && keys.indexOf(K2) < 0, JSON.stringify(keys));
  t.ok('억제 안 된 회차는 정상 생성', keys.indexOf(K3) >= 0, JSON.stringify(keys));
  /* 억제가 있어도 이미 존재하는(다른 기기에서 온) 회차는 지우지 않는다 — 생성만 막음 */
  ctx.tasks = [Object.assign(exp(K1,'2026-09-07'), { done:true, createdAt:1, updatedAt:1 })];
  vm.runInContext('reconcileTimetableTasks({timetables:[{id:777}], silent:true})', ctx);
  t.ok('기존 완료 회차는 유지', ctx.tasks.some(function(x){ return x._ttKey === K1 && x.done; }));
})();

// ── 2) 키워드 규칙: 지난 마감은 준비 할일을 새로 만들지 않음 ──
t.ok('키워드 규칙 과거 마감 생성 차단', /var anchor=taskDateKeyLocal\(src\.deadlineDate\|\|src\.date\);\s*if\(!anchor\)return;[\s\S]{0,400}?if\(anchor<from\)return;\s*var due=taskAddDaysKey\(anchor,-offset\);/.test(html));

// ── 3) 억제 프루닝: occurrence 날짜 400일 기준 ──
(function(){
  const block = sliceBlock(html, 'function pruneGeneratedTaskSuppressionsOld(map){', 'function saveGeneratedTaskSuppressions(map){');
  const ctx = { Date, Object, String }; vm.createContext(ctx); vm.runInContext(block, ctx);
  const DAY = 86400000, now = Date.now();
  const iso = function(ms){ return new Date(ms).toISOString().slice(0,10); };
  const recentOcc = iso(now - 200*DAY), ancientOcc = iso(now - 500*DAY);
  const map = {};
  map['tt|1|s0|'+recentOcc] = { occurrenceDate: recentOcc, at: now - 300*DAY };      /* 기록은 오래됐지만 회차는 생성 범위 안 → 유지 */
  map['tt|1|s0|'+ancientOcc] = { occurrenceDate: ancientOcc, at: now - 10*DAY };     /* 회차가 400일+ 전 → 정리 */
  map['rule:r:src:'+recentOcc] = { at: now - 300*DAY };                               /* 키에서 날짜 추출 → 유지 */
  map['nodate-old'] = { at: now - 450*DAY };                                          /* 날짜 없음 + 400일+ → 정리 */
  map['nodate-new'] = { at: now - 30*DAY };
  ctx.pruneGeneratedTaskSuppressionsOld(map);
  t.ok('최근 회차 억제는 기록이 오래돼도 유지(180일 프루닝 부활 방지)', !!map['tt|1|s0|'+recentOcc] && !!map['rule:r:src:'+recentOcc], JSON.stringify(Object.keys(map)));
  t.ok('400일+ 지난 회차 억제는 정리', !map['tt|1|s0|'+ancientOcc]);
  t.ok('날짜 없는 항목은 기록 시각 400일 기준', !map['nodate-old'] && !!map['nodate-new']);
})();

// ── 4) tombstone 레지스트리 합집합 병합 ──
(function(){
  const block = sliceBlock(html, 'function returnTombstoneMergeStr(cloudStr, localStr, now){', 'window.returnTombstoneMergeStr=returnTombstoneMergeStr;');
  const ctx = { JSON, Object, Number, Array, Date, RETURN_TOMBSTONE_TTL_MS: 90*24*60*60*1000 };
  vm.createContext(ctx); vm.runInContext(block, ctx);
  const now = 1_800_000_000_000, DAY = 86400000;
  const cloud = { a:{deletedAt: now-5*DAY, collection:'tasks'}, b:{deletedAt: now-3*DAY}, old:{deletedAt: now-100*DAY} };
  const local = { b:{deletedAt: now-1*DAY}, c:{deletedAt: now-2*DAY}, a:{deletedAt: now-9*DAY} };
  const r = ctx.returnTombstoneMergeStr(JSON.stringify(cloud), JSON.stringify(local), now);
  const m = JSON.parse(r.value);
  t.ok('클라우드 전용 기록 보존(덮어쓰기로 사라지던 것)', !!m.a && m.a.deletedAt === now-5*DAY);
  t.ok('로컬 전용 기록 보존', !!m.c);
  t.ok('같은 eid는 더 늦은 deletedAt', m.b.deletedAt === now-1*DAY);
  t.ok('TTL(90일) 지난 기록은 버림', !m.old);
  t.ok('클라우드 대비 추가분 집계(재푸시 판단)', r.addedVsCloud === 2, r.addedVsCloud);
  t.ok('로컬 대비 추가분 집계', r.addedVsLocal === 1, r.addedVsLocal);
  t.ok('손상 JSON → null(덮어쓰지 않음)', ctx.returnTombstoneMergeStr('{bad', '{}', now) === null);
  t.ok('배열 → null', ctx.returnTombstoneMergeStr('[]', '{}', now) === null);
})();

// ── 4b) 배선: 인바운드 선병합 + 캐시 무효화, 아웃바운드 병합·푸시, cloud-only 흡수 무효화 ──
t.ok('인바운드: 키 순회 전에 tombstone 선병합', /var _fbApplySkip = \{'return_sync_model': true\};\s*[\s\S]{0,700}?returnTombstoneMergeStr\(data\.keys\['return_tombstones_v1'\], localStorage\.getItem\('return_tombstones_v1'\)\)[\s\S]{0,700}?returnTombstoneInvalidate\(\);[\s\S]{0,1500}?Object\.keys\(data\.keys\)\.forEach/.test(html));
t.ok('인바운드: 원시 덮어쓰기 루프에서 제외', /_fbApplySkip\['return_tombstones_v1'\]=true;/.test(html));
t.ok('아웃바운드: absorb 병합', /if\(k==='return_tombstones_v1'&&typeof returnTombstoneMergeStr==='function'\)\{\s*try\{ var _snTb=returnTombstoneMergeStr\(cloud\.fullValue, ours\); if\(_snTb\)valueToAbsorb=_snTb\.value; \}catch\(_tb2\)\{\}/.test(html));
t.ok('아웃바운드: 병합 결과 푸시 목록', /k==='generated_task_suppressions_v1' \|\| k==='return_tombstones_v1' \|\| k==='hobby_items_v2'/.test(html));
t.ok('아웃바운드/cloud-only 흡수 후 캐시 무효화(2곳)', (html.match(/if\(k==='return_tombstones_v1'&&typeof returnTombstoneInvalidate==='function'\)returnTombstoneInvalidate\(\);/g) || []).length === 2);
t.ok('무효화 헬퍼', /function returnTombstoneInvalidate\(\)\{ _tombstones=null; \}/.test(html));

// ── 5) 데모 정리 플래그는 기기 로컬(동기화 안 됨) ──
(function(){
  const block = sliceBlock(html, 'function shouldFbSyncKey(k){', 'function fbConfig(){');
  const ctx = {}; vm.createContext(ctx); vm.runInContext(block, ctx);
  const m = html.match(/var DEMO_CLEANUP_KEY = '([^']+)';/);
  t.ok('데모 정리 키 정의', !!m);
  t.ok('데모 정리 키는 동기화 대상 아님(재설치 기기도 자기 사본 정리)', m && ctx.shouldFbSyncKey(m[1]) === false, m && m[1]);
  t.ok('tombstone 레지스트리는 동기화 대상', ctx.shouldFbSyncKey('return_tombstones_v1') === true);
})();

// ── 6) 지난 시간표 수업은 '밀린 할일'이 아님(개수·오늘로 옮기기에서 제외) ──
t.ok('홈 밀린 할일 칩: 수업 제외', /var _overdue=\(tasks\|\|\[\]\)\.filter\(function\(t\)\{return t&&!t\.done&&!t\._travelOnly&&!t\._isTt&&t\.date&&t\.date<TK;\}\)\.length;/.test(html));
t.ok('밀린 할일 오늘로: 수업은 안 옮김', /if\(!t\|\|t\.done\|\|!t\.date\|\|t\.date>=TK\|\|t\._travelOnly\|\|t\._isTt\)return;/.test(html));
t.ok('할일 섹션 밀림 배지: 수업 제외(카테고리·프로젝트)', (html.match(/!t\.done&&!t\._travelOnly&&!t\._isTt&&taskEffectiveCatId\(t\)===/g) || []).length === 2);

// ── 7) 이미 섞인 '지난 미완료 자동 생성분' 정리 도구 ──
(function(){
  const block = sliceBlock(html, 'function returnStaleGeneratedScan(todayKey){', 'window.returnStaleGeneratedScan=returnStaleGeneratedScan;');
  const order = [];
  const ctx = {
    Array, String, JSON, TK:'2026-10-06',
    isGeneratedOccurrenceTask: function(t){ return !!(t._isTt || t._repeatId || t._ruleGen); },
    generatedCanonicalType: function(t){ return t._repeatId ? 'repeat' : (t._ruleGen ? 'rule' : ''); },
    taskChildren: function(id){ return ctx.tasks.filter(function(x){ return String(x.parentId) === String(id); }); },
    suppressGeneratedTasks: function(l){ order.push('suppress:'+l.length); return l.length; },
    returnTombstoneMarkMany: function(e){ order.push('tomb:'+e.length); return e.length; },
    gcalQueueTaskEventDeletion: function(){},
    saveTaskData: function(){ order.push('save'); return true; },
    tasks: [
      { id:'tt1', _isTt:true, date:'2026-09-07', done:false },                 /* 후보 */
      { id:'tt2', _isTt:true, date:'2026-09-14', done:true },                  /* 완료 → 제외 */
      { id:'tt3', _isTt:true, date:'2026-09-21', done:false, userModifiedDate:true }, /* 사용자가 옮김 → 제외 */
      { id:'tt4', _isTt:true, date:'2026-09-28', done:false, prepItems:[{done:true}] }, /* 진행 중 → 제외 */
      { id:'tt5', _isTt:true, date:'2026-10-06', done:false },                 /* 오늘 → 제외 */
      { id:'r1', _repeatId:'ri', date:'2026-09-29', done:false },              /* 후보(반복) */
      { id:'p1', _ruleGen:true, date:'2026-09-01', done:false },               /* 후보(규칙) */
      { id:'p2', _ruleGen:true, date:'2026-09-02', done:false },
      { id:'kid', parentId:'p2', text:'하위', date:'2026-09-02', done:false }, /* p2는 하위 있음 → 제외 */
      { id:'c1', _isTt:true, date:'2026-09-01', done:false, canceled:true },   /* 취소 → 제외 */
      { id:555, text:'진짜 놓친 할일', date:'2026-09-30', done:false },        /* 생성 아님 → 제외 */
    ],
  };
  vm.createContext(ctx); vm.runInContext(block, ctx);
  const sc = ctx.returnStaleGeneratedScan();
  const ids = function(a){ return a.map(function(x){ return x.id; }).join(','); };
  t.ok('정리 후보: 손대지 않은 지난 미완료 수업만', ids(sc.timetable) === 'tt1', ids(sc.timetable));
  t.ok('정리 후보: 반복', ids(sc.repeat) === 'r1', ids(sc.repeat));
  t.ok('정리 후보: 규칙 준비(하위 있는 것 제외)', ids(sc.rule) === 'p1', ids(sc.rule));
  const n = ctx.returnStaleGeneratedRemove(sc.timetable.concat(sc.rule));
  t.ok('정리: 선택분만 제거', n === 2 && !ctx.tasks.some(function(x){ return x.id === 'tt1' || x.id === 'p1'; }) && ctx.tasks.some(function(x){ return x.id === 'r1'; }) && ctx.tasks.some(function(x){ return x.id === 555; }));
  t.ok('정리: 억제·tombstone → 저장 순서(다른 기기 재생성 방지)', order.join('|') === 'suppress:2|tomb:2|save', order.join('|'));
})();
t.ok('설정 데이터 관리에 정리 버튼', /onclick="openStaleGeneratedCleanup\(\)"/.test(html));
t.ok('정리 전 버전 스냅샷', /returnSnapshotNow\(\{reason:'before-stale-cleanup',force:true\}\)/.test(html));

t.done();
