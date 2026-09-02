'use strict';
/* 자연어 할일 캡처 AI가 어느 제공자로든(Claude/Groq/Gemini) 작동하도록.
   회귀: 캡처 AI(_captureAIParse)와 게이트가 groq_api_key만 봐서, 사용자가 Anthropic/
   Gemini 키를 넣어도 AI가 전혀 안 돌고 로컬 폴백(제목만)했다. 다중 제공자 호출
   returnAiChat + returnHasAiKey로 전환하고, AI 결과의 빈 필드는 로컬 파서로 백필. */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('캡처 AI 다중 제공자');

// returnHasAiKey: 세 제공자 모두 확인
t.ok('returnHasAiKey 세 키 확인',
  /return !!\(localStorage\.getItem\('anthropic_api_key'\)\|\|localStorage\.getItem\('groq_api_key'\)\|\|localStorage\.getItem\('gemini_api_key'\)\)/.test(html));

// returnAiChat: 세 엔드포인트
t.ok('Anthropic 엔드포인트', html.indexOf('https://api.anthropic.com/v1/messages') >= 0);
t.ok('Anthropic 브라우저 직접호출 헤더', /'anthropic-dangerous-direct-browser-access':'true'/.test(html));
t.ok('Groq 엔드포인트', html.indexOf('https://api.groq.com/openai/v1/chat/completions') >= 0);
t.ok('Gemini 엔드포인트', html.indexOf('generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent') >= 0);

// homeCaptureAI 게이트가 returnHasAiKey (groq 전용 아님)
t.ok('homeCaptureAI 게이트 = returnHasAiKey', /if\(!returnHasAiKey\(\)\)\{\s*\/\*[^\n]*\*\/\s*homeCapture\(text\);/.test(html));

// _captureAIParse가 로컬 파서로 백필
t.ok('_captureAIParse 로컬 파서 선계산', /var local = \(typeof captureParseNL==='function'\) \? captureParseNL\(text, \(typeof TK!=='undefined'\?TK:''\)\)/.test(html));
t.ok('AI 빈 필드 로컬 백필(timeStart)', /if\(!parsed\.timeStart\) parsed\.timeStart = local\.timeStart/.test(html));
t.ok('AI 빈 필드 로컬 백필(deadlineDate)', /if\(!parsed\.deadlineDate\) parsed\.deadlineDate = local\.deadlineDate/.test(html));
t.ok('AI가 제목을 안 다듬으면 로컬 제목', /if\(!parsed\.text \|\| parsed\.text===text\) parsed\.text = local\.text/.test(html));
// 응답에서 첫 JSON만 추출(잡텍스트 대응)
t.ok('응답에서 JSON 오브젝트 추출', /var mObj=content\.match\(\/\\\{\[\\s\\S\]\*\\\}\/\)/.test(html));

t.done();
