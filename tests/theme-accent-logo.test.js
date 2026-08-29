'use strict';
/* 강조색(테마) 변경이 앱 로고(파비콘/PWA 아이콘)·theme-color 메타까지 따라오도록 고정.

   배경: 강조색 UI(스와치·커스텀 색상 피커·기본값)는 #theme-override 스타일만 주입했는데,
   부팅 시/변경 시 나중에 붙는 #theme-studio-style에 덮여 강조색 자체도, 파비콘·PWA 아이콘
   (상단바/작업표시줄 로고)도 테마 설정을 따라가지 않았다(사용자 리포트). 이 세 진입점을
   테마 스튜디오(themeStudioSetColor='단일 소스')로 통일한다 — 이 경로만 --accent와 함께
   theme-color 메타·파비콘·PWA 아이콘을 갱신한다. 또 정적 기본 브랜드색을 앱 기본 로즈로
   맞춘다(예전 하드코딩 빨강 #C2433D → #A75F66). */
const fs = require('fs');
const path = require('path');
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('강조색→로고 일관');

function fnBody(name) {
  const i = html.indexOf('function ' + name + '(');
  if (i < 0) return '';
  // grab a generous window; these functions are short
  return html.slice(i, i + 1400);
}

// 1) 세 진입점이 테마 스튜디오를 거친다
{
  const ac = fnBody('applyThemeColor');
  t.ok('applyThemeColor → themeStudioSetColor(accent)',
    /themeStudioSetColor\('accent',\s*hex\)/.test(ac), ac.slice(0, 120));

  const ap = fnBody('applyThemePalette');
  t.ok('applyThemePalette → themeStudioSetColor(accent)',
    /themeStudioSetColor\('accent',\s*accent\)/.test(ap), ap.slice(0, 120));

  const rt = fnBody('resetTheme');
  t.ok('resetTheme → themeStudioSetColor(accent, 기본)',
    /themeStudioSetColor\('accent',\s*def\)/.test(rt), rt.slice(0, 120));
}

// 2) 정적 기본 파비콘이 로즈(#A75F66)로, 옛 빨강(#C2433D) 제거
{
  t.ok('인라인 SVG 파비콘 rect fill = 로즈', html.indexOf("rx='14' fill='%23A75F66'") >= 0);
  t.ok('파비콘에 옛 빨강 #C2433D 없음', html.indexOf('%23C2433D') < 0);
}

// 3) manifest.json 기본 테마색이 로즈
{
  const mf = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'manifest.json'), 'utf8'));
  t.ok('manifest theme_color = #A75F66', mf.theme_color === '#A75F66', mf.theme_color);
  t.ok('manifest background_color = #A75F66', mf.background_color === '#A75F66', mf.background_color);
}

t.done();
