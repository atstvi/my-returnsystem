'use strict';
/* 일기 타임라인 AI 포맷이 다중 제공자(Claude→Groq→Gemini)를 쓰고, 실패해도
   일기 동기화를 하드-실패시키지 않아야 한다.
   증상(콘솔): POST api.groq.com … 404 → "diary auto sync failed: AI 응답 없음".
   원인: callAI가 Groq 전용 하드코딩 + 모델 404를 그냥 throw. Claude/Gemini 키가
   있어도 안 씀. 30초마다 tick이 하드-실패.
   수정: callAI → returnAiChat(다중 제공자, Claude 우선), 총실패 시 prompt 원문 반환
   (throw 안 함). _formatTimelineWithAI는 AI 미동작 시 raw 타임라인으로 폴백. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('일기 AI 다중 제공자·우아한 폴백');

const callAIBlock = sliceBlock(html, 'async function callAI(prompt, maxTokens){', 'function _buildTodayTasksText(dateKey){');
const fmtBlock = sliceBlock(html, 'async function _formatTimelineWithAI(raw){', '/* ── DB metadata cache ──');

function mkCallAI(extra){ const ctx = Object.assign({}, extra); vm.createContext(ctx); vm.runInContext(callAIBlock, ctx); return ctx; }
function mkFmt(extra){ const ctx = Object.assign({}, extra); vm.createContext(ctx); vm.runInContext(fmtBlock, ctx); return ctx; } // callAI stub kept (block not re-run)

(async function(){
  // (a) 제공자 성공 → 그 텍스트 반환
  let ctx = mkCallAI({ returnAiChat: async function(o){ return 'AI:'+o.user; } });
  t.ok('callAI: 제공자 성공 시 그 응답 반환', (await ctx.callAI('hello',100)) === 'AI:hello');

  // (b) 제공자 없음/실패(null) → 프롬프트 원문 반환(throw 안 함)
  ctx = mkCallAI({ returnAiChat: async function(){ return null; } });
  t.ok('callAI: 총실패 시 프롬프트 원문 반환(throw 없음)', (await ctx.callAI('hello',100)) === 'hello');

  // (c) returnAiChat이 throw해도 삼켜서 프롬프트 반환
  ctx = mkCallAI({ returnAiChat: async function(){ throw new Error('boom'); } });
  t.ok('callAI: 제공자 throw도 삼키고 원문 반환', (await ctx.callAI('x',100)) === 'x');

  // (d) _formatTimelineWithAI: AI 미동작(callAI가 prompt 그대로) → raw 폴백
  ctx = mkFmt({ _diaryNotionCfg:{prompt:'정리: {tasks}'}, DIARY_DEFAULT_PROMPT:'기본 {tasks}', callAI: async function(p){ return p; } });
  t.ok('_formatTimelineWithAI: AI 미동작 → raw 폴백(프롬프트 안 씀)', (await ctx._formatTimelineWithAI('09:00 러닝')) === '09:00 러닝');

  // (e) AI 동작 → AI 결과 반환
  ctx = mkFmt({ _diaryNotionCfg:{prompt:'정리: {tasks}'}, DIARY_DEFAULT_PROMPT:'기본 {tasks}', callAI: async function(){ return '정리됨\n09:00 러닝'; } });
  t.ok('_formatTimelineWithAI: AI 동작 → AI 결과 반환', (await ctx._formatTimelineWithAI('09:00 러닝')) === '정리됨\n09:00 러닝');

  // (f) callAI throw → raw 폴백(tick 하드-실패 방지)
  ctx = mkFmt({ _diaryNotionCfg:{}, DIARY_DEFAULT_PROMPT:'기본 {tasks}', callAI: async function(){ throw new Error('네트워크'); } });
  t.ok('_formatTimelineWithAI: callAI throw → raw 폴백', (await ctx._formatTimelineWithAI('raw타임라인')) === 'raw타임라인');

  // ── 소스 배선 ──
  t.ok('callAI가 returnAiChat 사용(다중 제공자)', /var out=await returnAiChat\(\{user:prompt, maxTokens:maxTokens\|\|800\}\);/.test(html));
  t.ok('callAI 총실패 시 prompt 반환(throw 제거)', /return prompt; \/\* no provider configured\/succeeded/.test(html));

  t.done();
})();
