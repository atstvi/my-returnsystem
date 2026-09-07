'use strict';
/* 모바일 전용 하단 네비 뼈대(레이아웃만 — 기능/라우팅은 goPage 재사용).
   데스크톱 사이드바를 하단에서 가로 스크롤하던 것을 대체: 탭 4개(나·할일·루틴·인박스)
   + 중앙 담기 FAB, 나머지 섹션은 '더보기' 바텀시트. 모바일(≤639px)에서만 보이고
   데스크톱 레이아웃·기능·테마는 그대로. 이 테스트는 DOM/CSS/JS 배선을 회귀로 고정. */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('모바일 하단 네비');

// ── DOM: 하단 네비 탭 4개 + FAB ──
t.ok('#m-tabbar 존재', /<nav id="m-tabbar"/.test(html));
['home','tasks','routine','inbox'].forEach(function(slug){
  t.ok('탭: '+slug, new RegExp('class="mtab" data-mslug="'+slug+'"[^>]*onclick="mNavGo\\(\''+slug+'\'\\)"').test(html));
});
t.ok('탭은 정확히 4개', (html.match(/class="mtab" data-mslug=/g)||[]).length===4);
t.ok('중앙 담기 FAB', /<button class="mfab" id="m-fab"[^>]*onclick="mCapture\(\)"/.test(html));

// ── DOM: 더보기 시트 + 상단 더보기 버튼 ──
t.ok('상단 더보기 버튼(m-only)', /id="m-more-btn"[^>]*onclick="mMoreOpen\(\)"/.test(html));
t.ok('더보기 시트/딤', /<div id="m-more-dim"[^>]*onclick="mMoreClose\(\)"/.test(html) && /<div id="m-more-sheet"/.test(html));
['projects','schedule','hobby','recharge','records','money','timer','music'].forEach(function(slug){
  t.ok('더보기 항목: '+slug, new RegExp("onclick=\"mMore\\('"+slug+"'\\)").test(html));
});
t.ok('더보기: 설정', /onclick="mMore\('settings'\)"/.test(html));
t.ok('더보기: 프로필', /onclick="mMoreClose\(\);openProfileSettings\(\)"/.test(html));

// ── JS: 라우팅 재사용 + 시트 제어 ──
t.ok('mNavGo가 goPage 재사용', /function mNavGo\(slug\)\{[\s\S]*?goPage\(slug\)/.test(html));
t.ok('goPage가 모바일 네비 활성 동기화', /if\(typeof syncMobileNav==='function'\) syncMobileNav\(slug\)/.test(html));
t.ok('syncMobileNav 활성 토글', /b\.classList\.toggle\('on', b\.getAttribute\('data-mslug'\)===slug\)/.test(html));
t.ok('mCapture가 기존 캡처 입력 포커스', /function mCapture\(\)\{[\s\S]*?getElementById\('capture-inp'\)/.test(html));
t.ok('mMoreOpen/Close 정의', /function mMoreOpen\(\)\{/.test(html) && /function mMoreClose\(\)\{/.test(html));

// ── CSS: 데스크톱 숨김, 모바일에서만 표시, 사이드바 대체 ──
t.ok('데스크톱에선 모바일 껍데기 숨김', /#m-tabbar, #m-more-dim, #m-more-sheet, \.topbar-icon-btn\.m-only \{ display:none; \}/.test(html));
t.ok('모바일에서 사이드바 하단바 숨김(대체)', /\.sidebar \{ display:none !important; \}/.test(html));
t.ok('모바일에서 하단 네비 표시', /#m-tabbar\{\s*display:flex;/.test(html));
t.ok('숨김 상태 재확인([hidden] override)', /#m-more-dim\[hidden\], #m-more-sheet\[hidden\]\{ display:none; \}/.test(html));
t.ok('FAB는 앱 강조색 사용(정체성 유지)', /background:var\(--accent, #A75F66\); color:#fff/.test(html));

t.done();
