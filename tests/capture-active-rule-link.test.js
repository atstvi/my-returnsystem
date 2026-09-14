'use strict';
/* 자연어로 마감을 담으면 활성 규칙 연결 할일이 '지금 바로' 생겨야 한다.
   예전엔 홈 빠른 캡처(homeCapture)와 AI 캡처 확정(_commitCaptureTask)이 할일만 추가하고
   applyActiveTaskRules를 부르지 않아, 연결 할일이 다음 홈 렌더(_initHome)까지 안 생겼다.
   그래서 방금 담은 마감이 '오늘 상황'에서 '연결 안 됨'으로 표시됐다. 두 캡처 경로가 추가
   직후 applyActiveTaskRules를 호출하게 한다(생성 시 스스로 saveTaskData+상황 갱신). */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('캡처 → 활성 규칙 연결 즉시 생성');

// 홈 빠른 캡처(로컬 NL)
t.ok('homeCapture: 추가 직후 applyActiveTaskRules 호출', /note:'홈 빠른 캡처'[\s\S]{0,400}?try\{ if\(typeof applyActiveTaskRules==='function'\) applyActiveTaskRules\(\); \}catch\(e\)\{\}/.test(html));
// AI 캡처 확정
t.ok('_commitCaptureTask: 추가 직후 applyActiveTaskRules 호출', /function _commitCaptureTask\(parsed\)\{[\s\S]*?try\{ if\(typeof applyActiveTaskRules==='function'\) applyActiveTaskRules\(\); \}catch\(e\)\{\}\s*if\(typeof saveTaskData==='function'\) saveTaskData\(\);/.test(html));

// 연결 판정이 정/역방향 소스 id를 본다(회귀 기준)
t.ok('연결 판정: _ruleSourceId/deadlineId/sourceTaskId 매칭', /if\(String\(t\.deadlineId\|\|''\)===tid\|\|String\(t\.sourceTaskId\|\|''\)===tid\|\|String\(t\._ruleSourceId\|\|''\)===tid\)return true;/.test(html));
// 규칙 생성 태스크가 소스 마감을 가리킨다(회귀 기준)
t.ok('규칙 생성 태스크가 소스 마감 id로 연결', /_ruleSourceId:sourceId[\s\S]{0,80}?_generationKey:genKey/.test(html) || /deadlineId:src\?String\(src\.id\):''[\s\S]*?_ruleSourceId:sourceId/.test(html));

t.done();
