'use strict';
/* 모바일 리디자인 ⑤: 시간표·기록 화면 재배치(레이아웃만).
   회귀 배경(캐스케이드 버그): 모바일 규칙(@media ≤639px)이 소스상 tt/records '기본
   CSS'보다 앞서 있어, 뒤에 오는 .tt-left{width:240px}/.rec-nav{width:200px}가 모바일
   폭 100%를 덮었다(같은 명시도 → 나중 규칙 승리). 그래서 모바일에서 시간표 그리드가
   안 보이고(왼쪽 240px 패널 + 빈 공간), 기록도 nav 200px + 빈 공간이 남았다.
   해결: 각 페이지의 기본 CSS '뒤'에 모바일 레이아웃을 다시 확정하는 블록을 둔다. */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('모바일 시간표·기록');

// 캐스케이드 순서 확인: 오버라이드가 기본 CSS보다 뒤에 와야 이긴다
const idxTtBase = html.indexOf('.tt-left{\n  width:240px');
const idxTtFix = html.indexOf('시간표(모바일): 위쪽 @media');
const idxRecBase = html.indexOf('.rec-nav{\n  width:200px');
const idxRecFix = html.indexOf('기록(모바일): 위쪽 ≤639px');
t.ok('tt 모바일 오버라이드가 tt 기본 CSS보다 뒤', idxTtBase >= 0 && idxTtFix > idxTtBase);
t.ok('records 모바일 오버라이드가 rec 기본 CSS보다 뒤', idxRecBase >= 0 && idxRecFix > idxRecBase);

// ── 시간표: 그리드가 7일 다 들어오게 열 변수 축소 + 레이아웃 ──
t.ok('그리드 열/행 변수 축소(모바일)', /:root\{ --tt-time-w:38px; --tt-day-min-w:40px; --tt-cell-h:42px; \}/.test(html));
t.ok('tt-left 풀폭', /\.tt-left\{ width:100%; flex-shrink:0; border-right:none;/.test(html));
t.ok('학기 목록 가로 스크롤 카드', /\.tt-left \.tt-sem-list\{ display:flex; flex-direction:row;[\s\S]*?overflow-x:auto;/.test(html));
t.ok('그리드 세로 스크롤 영역', /\.tt-grid-wrap\{ overflow:auto; max-height:62vh;/.test(html));
t.ok('tt-right 풀폭', /\.tt-right\{ width:100%; flex:1 1 auto; min-height:auto; overflow:visible; \}/.test(html));

// ── 기록: 세로 메뉴 → 가로 탭 바, 콘텐츠 풀폭 ──
t.ok('records-page 세로 스택', /\.records-page\{ flex-direction:column; height:auto;/.test(html));
t.ok('rec-nav 가로 스크롤 탭 바', /\.rec-nav\{ width:100%; flex-direction:row; align-items:center;[\s\S]*?overflow-x:auto;/.test(html));
t.ok('제목·섹션라벨·메모작성기는 모바일에서 숨김', /\.rec-nav-title, \.rec-nav-section, \.rec-nav-sep, \.rec-capture\{ display:none; \}/.test(html));
t.ok('탭은 내용 폭(가로 배치)', /\.rec-tab\{ width:auto; flex:0 0 auto; margin-bottom:0; white-space:nowrap; \}/.test(html));

t.done();
