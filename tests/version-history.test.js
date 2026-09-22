'use strict';
/* 버전 기록(스냅샷): 노션 페이지 히스토리처럼 중요 데이터(할일·반복·메모·인박스·
   프로젝트·루틴·일기·시간표 등)를 IndexedDB(return_snapshots_v1)에 시간순 보관해,
   실수 삭제나 동기화 역전파로 손실돼도 이전 버전에서 '없는 것만 병합' 또는 '그 시점으로
   교체' 복원할 수 있게 한다. 최신 N개 + '가장 풍부한' 스냅샷 1개(대량 손실 직전)를 보호
   보관하고, 저장 시(스로틀)·부팅 settle 후·탭 백그라운드 전환 때 찍는다. 기기 로컬(동기화 X). */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('버전 기록(스냅샷)');

// ── 상수/스토어 ──
t.ok('스냅샷 키셋에 주요 도메인 전부(할일·프로젝트·시간표·취미·머니·일기 등)', ['task_items_v1','task_rules_v1','projects_v1','routine_habits_v1','timetables_v1','hobby_items_v2','money_tx_v1','memos_v5','metrics_v1','return_check_logs','phil_cards','music_playlists_v1','diary_entries_v1'].every(function(k){ return html.indexOf("'"+k+"'")>=0 && new RegExp('var RETURN_SNAPSHOT_KEYS=[\\s\\S]*?'+k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'[\\s\\S]*?\\n\\];').test(html); }));
t.ok('보관 개수/최소 간격 상수', /var RETURN_SNAPSHOT_MAX=30, RETURN_SNAPSHOT_MIN_INTERVAL=5\*60\*1000;/.test(html));
t.ok('IDB return_snapshots_v1 오픈', /indexedDB\.open\('return_snapshots_v1',1\)/.test(html) && /createObjectStore\('snap',\{keyPath:'ts'\}\)/.test(html));

// ── 스냅샷 엔진 ──
t.ok('returnSnapshotNow 정의+노출', /function returnSnapshotNow\(reason\)\{/.test(html) && /window\.returnSnapshotNow=returnSnapshotNow;/.test(html));
t.ok('settle 전엔 스냅샷 금지(부팅 부분상태 방지)', /if\(typeof _idbInitSettled!=='undefined'&&!_idbInitSettled\)return Promise\.resolve\(false\);/.test(html));
t.ok('텅 빈 상태는 자동 스냅샷 안 함(어느 도메인이든 내용 있으면 찍음)', /if\(!force && !\['task_items_v1','memos_v5','projects_v1','hobby_items_v2','money_tx_v1'[\s\S]*?\.some\(function\(k\)\{ var v=c\.keys\[k\]; return v&&v!=='\[\]'&&v!=='\{\}'&&v!=='null'; \}\)\)return Promise\.resolve\(false\);/.test(html));
t.ok('내용 변화 없으면(해시 동일) 스킵', /if\(h===_snapLastHash&&!force\)return Promise\.resolve\(false\);/.test(html));

// ── 프루닝: 최신 N + 가장 풍부한 것 보호 ──
t.ok('최신 N개 + 가장 풍부한 스냅샷 보호 보관', /var richest=all\.reduce\(function\(a,b\)\{return _snapTotal\(b\)>_snapTotal\(a\)\?b:a;\}[\s\S]*?if\(richest\)keep\[richest\.ts\]=1;/.test(html));

// ── 스로틀 + 자동 트리거 ──
t.ok('저장 스로틀 예약(_snapScheduleThrottled)', /function _snapScheduleThrottled\(\)\{\s*if\(_snapTimer\)return;/.test(html));
t.ok('_afterWriteSideEffects에서 스냅샷 예약', /RETURN_SNAPSHOT_KEYS\.indexOf\(key\)>=0&&typeof _snapScheduleThrottled==='function'\)\{\s*try\{_snapScheduleThrottled\(\);\}/.test(html));
t.ok('탭 백그라운드 전환 시 스냅샷', /visibilitychange[\s\S]*?visibilityState==='hidden'[\s\S]*?returnSnapshotNow\(\{reason:'hidden'\}\)/.test(html));

// ── 복원 ──
t.ok('returnVersionRestore 정의+노출', /async function returnVersionRestore\(ts, opts\)\{/.test(html) && /window\.returnVersionRestore=returnVersionRestore;/.test(html));
// 모양(배열/객체/스칼라) 구분 복원 — 스칼라 키를 '[]'로 덮어써 망가뜨리던 문제 방지
t.ok('모양 판별 헬퍼(배열/객체/스칼라)', /function _snapShape\(v\)\{ return Array\.isArray\(v\)\?'array':\(\(v&&typeof v==='object'\)\?'object':'scalar'\); \}/.test(html));
t.ok('배열 키: id 없는 항목만 병합 push', /\(snV\|\|\[\]\)\.forEach\(function\(it\)\{ if\(it&&it\.id!=null&&!ids\[String\(it\.id\)\]\)cur\.push\(it\); \}\);/.test(html));
t.ok('객체 키(일기·루틴로그·트래커값): 키 단위 병합', /else if\(shape==='object'\)\{\s*var curO=_snapParseObj\(curRaw\); Object\.keys\(snV\|\|\{\}\)\.forEach\(function\(d\)\{ if\(curO\[d\]==null\)curO\[d\]=snV\[d\]; \}\); setReturnStorageItem\(k, JSON\.stringify\(curO\)\);/.test(html));
t.ok('스칼라 키: 비어있을 때만 채움(덮어쓰기 방지)', /if\(_snapCurEmpty\(curRaw\)\) setReturnStorageItem\(k, rec\.keys\[k\]\);/.test(html));
t.ok('교체 모드(replace): 스냅샷 값으로 setReturnStorageItem', /if\(opts\.replace\)\{ setReturnStorageItem\(k, rec\.keys\[k\]\); return; \}/.test(html));
t.ok('복원 후 메모리 재적재+렌더', /returnReloadMemoryFromStorage\(\);/.test(html));
t.ok('dryRun 미리보기(변경 없음)', /if\(opts\.dryRun\)\{[\s\S]*?dryRun:true \};/.test(html));

// ── UI ──
t.ok('returnVersionOpenUI 모달 정의+노출', /async function returnVersionOpenUI\(\)\{/.test(html) && /window\.returnVersionOpenUI=returnVersionOpenUI;/.test(html));
t.ok('모달: 없는 것만/교체 버튼', /data-rv-merge="'\+r\.ts\+'"/.test(html) && /data-rv-replace="'\+r\.ts\+'"/.test(html));
/* 회귀: counts 폴백('비어 있음')은 반드시 괄호로 묶여야 한다. 안 그러면 연산자
   우선순위(+ > ||)로 '<div class=rv-counts>'+join || '비어 있음'+'</div>'+액션…이
   되어, join이 truthy일 때 || 오른쪽(닫는 div + 액션 버튼 전체)이 통째로 사라져
   '이 버전으로 교체' 버튼이 렌더되지 않는다. */
t.ok('counts 폴백 괄호로 묶여 액션 버튼 안 잘림', /\.join\(' · '\)\|\|'비어 있음'\)\+'<\/div>'/.test(html));
t.ok('설정 데이터 관리에 버전 보기 진입점', /onclick="returnVersionOpenUI\(\)"/.test(html));

// ── returnReloadMemoryFromStorage(복원/재수화 공용) ──
t.ok('returnReloadMemoryFromStorage 정의+노출', /function returnReloadMemoryFromStorage\(\)\{/.test(html) && /window\.returnReloadMemoryFromStorage=returnReloadMemoryFromStorage;/.test(html));

t.done();
