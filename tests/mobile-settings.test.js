'use strict';
/* 설정탭 폰 버그: set-mob-header(햄버거+현재 패널명)를 모바일에서 보이게 하는 규칙이
   @media(≤639px) 블록에 있는데, 기본 CSS의 .set-mob-header{display:none}이 소스상 뒤라
   덮어써(같은 명시도 → 나중 규칙 승리) 폰에서 햄버거가 사라졌다. 그래서 설정 드로어를
   못 열고 첫 패널(테마·외관)에만 갇혔다. 기본 CSS '뒤'에 재확정 블록을 둬 고친다. */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('설정 폰 드로어');

const idxBaseHide = html.indexOf('.set-mob-header{display:none}');
const idxFix = html.indexOf('설정(모바일): set-mob-header');
t.ok('기본 CSS에 set-mob-header display:none 존재', idxBaseHide >= 0);
t.ok('모바일 재확정 블록이 기본 CSS보다 뒤', idxFix >= 0 && idxFix > idxBaseHide);
t.ok('모바일에서 set-mob-header 다시 표시', /@media \(max-width:639px\)\{\s*\.set-mob-header\{ display:flex; \}/.test(html));
t.ok('드로어 오버레이 열림 확정', /\.set-nav-overlay\.open\{ display:block; \}/.test(html));
// 토글/드로어 배선은 그대로(회귀 기준)
t.ok('햄버거가 toggleSetNav 호출', /class="set-mob-toggle" onclick="toggleSetNav\(\)"/.test(html));

t.done();
