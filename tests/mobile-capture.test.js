'use strict';
/* 모바일 리디자인 ②: 빠른 담기 바텀시트(FAB).
   담기 로직은 새로 만들지 않고 기존 homeCapture/homeCaptureAI를 그대로 재사용
   (submitGlobalCapture와 동일 경로). 시트는 할일/메모/기록 세그먼트 + 로컬 파서
   기반 시간·날짜·마감 미리보기(표시 전용) + 담기 버튼. 이 테스트는 DOM/CSS/JS
   배선과 '기존 캡처 재사용'을 회귀로 고정한다. */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('모바일 빠른 담기 시트');

// ── DOM ──
t.ok('담기 시트/딤 존재', /<div id="m-cap-dim"[^>]*onclick="mCapClose\(\)"/.test(html) && /<div id="m-cap-sheet"/.test(html));
t.ok('세그먼트 3종(할일/메모/기록)',
  /data-mtype="task"[^>]*onclick="mCapSetType\('task'\)"/.test(html) &&
  /data-mtype="inbox"[^>]*onclick="mCapSetType\('inbox'\)"/.test(html) &&
  /data-mtype="log"[^>]*onclick="mCapSetType\('log'\)"/.test(html));
t.ok('입력이 미리보기 갱신(oninput)', /id="m-cap-input"[\s\S]*?oninput="mCapPreview\(\)"/.test(html));
t.ok('Enter로 담기, Esc로 닫기', /if\(event\.key==='Enter'\)\{event\.preventDefault\(\);mCapSubmit\(\);\}if\(event\.key==='Escape'\)\{mCapClose\(\);\}/.test(html));
t.ok('미리보기 컨테이너 + 담기 버튼', /id="m-cap-preview"/.test(html) && /id="m-cap-send"[^>]*onclick="mCapSubmit\(\)"/.test(html));

// ── JS: 기존 캡처 재사용 ──
t.ok('mCapture가 시트 오픈', /function mCapture\(\)\{ mCapOpen\(\); \}/.test(html));
t.ok('미리보기는 로컬 파서(captureParseNL) 사용', /function mCapPreview\(\)\{[\s\S]*?captureParseNL\(text, \(typeof TK!=='undefined'\?TK:''\)\)/.test(html));
t.ok('할일 담기는 기존 homeCaptureAI 재사용(있으면)', /if\(_mCapType==='task' && typeof homeCaptureAI==='function'\)\{[\s\S]*?await homeCaptureAI\(text\)/.test(html));
t.ok('메모/기록 담기는 기존 homeCapture 재사용', /if\(typeof homeCapture==='function'\)homeCapture\(text\);/.test(html));
t.ok('담기 시 homeCaptureType을 세그먼트로 전환·복원',
  /homeCaptureType=_mCapType;[\s\S]*?homeCaptureType=old/.test(html));
t.ok('AI 미리보기 앵커를 담기 시트로', /_capturePreviewContext=\{anchorSelector:'#m-cap-sheet'/.test(html));

// ── CSS ──
t.ok('데스크톱에선 시트 숨김', /#m-tabbar, #m-more-dim, #m-more-sheet, #m-cap-dim, #m-cap-sheet,[^\n]*\{ display:none; \}/.test(html));
t.ok('[hidden] override에 담기 시트 포함', /#m-cap-dim\[hidden\], #m-cap-sheet\[hidden\]\{ display:none; \}/.test(html));
t.ok('세그먼트 활성색 = 앱 강조색', /#m-cap-sheet \.m-cap-seg button\.on\{ background:var\(--accent, #A75F66\); color:#fff; \}/.test(html));

t.done();
