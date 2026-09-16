'use strict';
/* 저장공간 자동 정리(알아서 되게):
   게이트(100%)까지 가기 전에 소프트 임계(RETURN_STORAGE_SOFT_PCT=80) 이상이면
   returnStorageProactiveRelief가 조용히 returnStorageCleanupNow를 돌려 미리 공간을
   줄인다. 부팅 settle·주기 타이머(15분)·저장 시 사용률 상승 감지에서 호출된다.
   임계 미만이면 즉시 반환(비용 없음), 최근 실행 후 최소 간격으로 스로틀. */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('저장공간 자동(소프트) 정리');

t.ok('소프트 임계 상수(80)', /var RETURN_STORAGE_SOFT_PCT=80;/.test(html));
t.ok('스로틀 상태(마지막 실행/최소 간격)', /var _softReliefLastMs=0, ?_softReliefMinGapMs=10\*60\*1000;/.test(html));
t.ok('returnStorageProactiveRelief 정의', /async function returnStorageProactiveRelief\(opts\)\{/.test(html));
t.ok('임계 미만이면 아무것도 안 함', /if\(pct<RETURN_STORAGE_SOFT_PCT\)return false;/.test(html));
t.ok('간격 스로틀', /if\(!opts\.force && \(now-_softReliefLastMs\)<_softReliefMinGapMs\)return false;/.test(html));
t.ok('조용히 cleanupNow 호출', /var res=await returnStorageCleanupNow\(\{silent:true\}\);/.test(html));
t.ok('busy 가드 공유(autoRelief와 겹침 방지)', /if\(window\._autoReliefBusy\)return false;[\s\S]*?window\._autoReliefBusy=true;/.test(html));

/* 호출 지점: 부팅 settle · 주기 타이머 · 저장 시 상승 감지 */
t.ok('부팅 settle에서 호출', /_idbMarkSettled[\s\S]*?if\(typeof returnStorageProactiveRelief==='function'\)returnStorageProactiveRelief\(\);/.test(html));
t.ok('주기 타이머(15분) 설정', /window\._storageReliefTimer=setInterval\(function\(\)\{[\s\S]*?returnStorageProactiveRelief\(\);[\s\S]*?\}, ?15\*60\*1000\);/.test(html));
t.ok('저장 시 사용률 상승하면 예방 정리', /if\(_uPct>=\(typeof RETURN_STORAGE_SOFT_PCT!=='undefined'\?RETURN_STORAGE_SOFT_PCT:80\) && typeof returnStorageProactiveRelief==='function'\)\{[\s\S]*?returnStorageProactiveRelief\(\);/.test(html));

t.done();
