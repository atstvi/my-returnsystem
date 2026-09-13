'use strict';
/* 저장공간 초과(quota) 시 PUSH 차단 backstop:
   기기가 quota를 넘으면(usedPct≥100%) 들어온 최신 데이터를 localStorage에도 IDB
   오버플로에도 못 써서 두 곳 다 '옛 값'이 남는다. 그 상태로 push하면 옛 값이 클라우드의
   정상 데이터를 덮어써(아이패드 역전파의 실체) 다른 기기까지 망가진다. 그래서 quota를
   넘은 기기는 자동 업로드를 멈추고(pull은 계속), 공간을 정리해 usedPct가 내려가면
   자동 재개한다. 수동 force(지금 올리기)만 사용자 판단으로 우회. */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('quota PUSH 차단 + 공간 정리');

// ── usedPct 캐시 헬퍼 ──
t.ok('usedPct 8초 캐시 헬퍼', /function _fbStorageUsedPct\(\)\{[\s\S]*?if\(now-_fbQuotaChkMs<8000\) return _fbQuotaChkPct;/.test(html));
t.ok('차단 임계 100%', /var RETURN_FB_QUOTA_PUSH_BLOCK_PCT=100;/.test(html));

// ── fbSaveNow 가드 ──
t.ok('force 아닐 때만 검사', /if\(!opts\.force\)\{\s*var _uPct=_fbStorageUsedPct\(\);/.test(html));
t.ok('임계 이상이면 push 중단(return false)', /if\(_uPct>=RETURN_FB_QUOTA_PUSH_BLOCK_PCT\)\{[\s\S]*?return false;\s*\}\s*\}/.test(html));
t.ok('가득 참 상태 표시', /이 기기 저장공간이 가득 차 업로드를 멈췄어요/.test(html));
t.ok('공간 정리되면 자동 재개(1분 뒤 재시도)', /window\._fbQuotaFullRetry=setTimeout\(function\(\)\{ window\._fbQuotaFullRetry=null; try\{fbSaveAll\(\);\}catch\(_e\)\{\} \}, 60000\)/.test(html));

// ── 공간 정리 ──
t.ok('returnStorageCleanupNow 정의+노출', /async function returnStorageCleanupNow\(\)\{/.test(html) && /window\.returnStorageCleanupNow=returnStorageCleanupNow;/.test(html));
t.ok('정리: 아카이브 + 고아백업 prune(다운로드 없음)', /runArchiveOnBoot\(\)[\s\S]*?returnStoragePrune\(\{apply:true,archive:false\}\)/.test(html));
t.ok('정리 후 quota 캐시 무효화', /_fbQuotaChkMs=0; \/\* 캐시 무효화/.test(html));
t.ok('100% 밑으로 내려가면 막힌 업로드 재개', /if\(after<RETURN_FB_QUOTA_PUSH_BLOCK_PCT\)\{ try\{ if\(typeof fbSaveAll==='function'\) fbSaveAll\(\); \}/.test(html));

// ── 복구 센터 ④ 저장공간 섹션 ──
t.ok('복구 센터에 저장공간 섹션', /④ 이 기기 저장공간/.test(html));
t.ok('가득 찬 기기는 자동 업로드 멈춤 안내', /가득 찬 기기는 자동 업로드를 멈춰<\/b> 다른 기기를 지켜요/.test(html));
t.ok('공간 정리 버튼 → returnStorageCleanupNow', /cb\.addEventListener\('click',function\(\)\{ cb\.disabled=true; cb\.textContent='정리 중…'; returnStorageCleanupNow\(\)/.test(html));
t.ok('usedPct 막대 + 퍼센트 표시', /width:'\+Math\.min\(100,pct\)\+'%/.test(html));

// ── 공간 정리: 진짜 범인(인라인 이미지) 이동 ──
t.ok('정리 시 인라인 이미지 MediaStore 이동', /if\(typeof diaryMigrateInlineImagesToMediaStore==='function'\)\{ imgMoved=\(await diaryMigrateInlineImagesToMediaStore\(\)\)\|\|0; \}/.test(html));

// ── 저장공간 안전 게이트(못 저장하는 기기에서 편집 차단) ──
t.ok('64KB 쓰기 프로브(실측)', /function _storageWriteProbe\(\)\{[\s\S]*?new Array\(64\*1024\)\.join\('x'\)[\s\S]*?return true;[\s\S]*?catch\(e\)\{ return false; \}/.test(html));
t.ok('returnStorageSafetyGate 정의+노출', /function returnStorageSafetyGate\(opts\)\{/.test(html) && /window\.returnStorageSafetyGate=returnStorageSafetyGate;/.test(html));
t.ok('공간 있으면 게이트 해제', /var full=!_storageWriteProbe\(\);[\s\S]*?if\(!full\)\{ if\(existing\)existing\.remove\(\); return false; \}/.test(html));
t.ok('전체화면 오버레이로 앱 차단', /ov\.id='return-storage-gate';[\s\S]*?position:fixed;inset:0;z-index:2000/.test(html));
t.ok("'읽기 전용으로 계속' 세션 해제(업로드는 계속 차단)", /window\.__returnReadOnlyAck=true;[\s\S]*?ov\.remove\(\)/.test(html) && /if\(window\.__returnReadOnlyAck && !opts\.force\) return true;/.test(html));
t.ok('정리 버튼→정리 후 프로브 통과 시 게이트 제거', /returnStorageCleanupNow\(\)\.then\(function\(\)\{ if\(_storageWriteProbe\(\)\)\{ ov\.remove\(\);/.test(html));
t.ok('부팅 settle 후 게이트 확인', /returnStorageSafetyGate==='function'\)returnStorageSafetyGate\(\); \}, 2500\)/.test(html));
t.ok('quota 저장 실패 시 게이트 발동', /진짜 저장 실패 → 안전 게이트로 편집 차단[\s\S]*?returnStorageSafetyGate\(\);/.test(html));

t.done();
