'use strict';
/* 설정 테마가 '예전 버전/기본값'으로 돌아가던 문제.
   1) 1회 색 초기화(themeStudioResetColorsOnce, 2026-09)가 부팅 2.5초 뒤 + 클라우드 적용 때마다 돌았다.
      테마 상태에 _colorResetV2 플래그가 없으면(테마 초기화·다른 기기 저장·아직 못 읽은 상태) 사용자 색을
      기본값으로 되돌리고 동기화까지 했다(재현: 플래그 없는 상태에서 색 변경 → 클라우드 다시 받기 → 기본색).
      → 자동 실행을 모두 뺐다(함수는 수동 복구용으로 남김).
   2) 설정의 테마 프리셋(인디고·틸·앰버)을 해제할 때 removeItem이라 동기화가 안 돼, 다음 저장의
      '클라우드에만 있는 키 흡수'가 곧바로 옛 프리셋을 되살렸고, 부팅 때 옛 프리셋 램프를 주입했다.
      → 빈 값으로 저장(동기화됨) + 테마 스튜디오 상태가 있으면 부팅 오버라이드 생략.
   3) 테마가 IDB로 넘친 기기(사진 많은 테마·작은 저장공간)는 부팅 때 못 읽어 기본 테마로 그려졌고,
      IDB가 늦게 열리면 그 세션 내내 기본값으로 보였다 → IDB 준비 즉시 다시 적용 + 준비 전 테마 쓰기 금지. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('설정 테마 되돌아감 방지');

t.ok('1회 색 초기화가 자동으로 돌지 않음(부팅 타이머·클라우드 적용 모두)', !/themeStudioResetColorsOnce\(\)/.test(html.replace(/function themeStudioResetColorsOnce\(\)\{/, '')) && /function themeStudioResetColorsOnce\(\)\{/.test(html));
t.ok('클라우드 적용 땐 저장된 테마를 그대로 적용만', /try \{ if\(typeof themeStudioApply==='function'\) themeStudioApply\(themeStudioGet\(\)\);/.test(html));
t.ok('프리셋 해제는 빈 값으로 저장(동기화) — removeItem 없음', !/localStorage\.removeItem\('return_theme_palette'\)/.test(html) && (html.match(/setReturnStorageItem\('return_theme_palette', ''\);/g) || []).length === 2);

/* 부팅 오버라이드: 테마 스튜디오 상태가 있으면 옛 프리셋 램프를 넣지 않음 */
{
  const boot = sliceBlock(html, "(function(){\n  /* 강조색의 단일 소스는 테마 스튜디오다.", '/* ══ HOME ══ */');
  const run = (store) => {
    const styles = {};
    const doc = { getElementById: (id) => styles[id] || null, createElement: () => ({ id: '', textContent: '' }), head: { appendChild: (el) => { styles[el.id] = el; } } };
    const c = { localStorage: { getItem: (k) => (k in store ? store[k] : null) }, document: doc, JSON };
    vm.createContext(c); vm.runInContext(boot, c); return styles['theme-override'] || null;
  };
  t.ok('테마 스튜디오 색이 있으면 옛 프리셋(틸) 램프를 주입하지 않음', run({ return_theme_palette: 'teal', return_theme_studio_state_v1: JSON.stringify({ colors: { accent: '#3366AA' } }) }) === null);
  const legacy = run({ return_theme_palette: 'teal' });
  t.ok('테마 스튜디오 상태가 없는 옛 기기는 예전처럼 프리셋 적용', !!legacy && /--a-400:var\(--t-400\)/.test(legacy.textContent));
}

t.ok('IDB 준비 즉시 넘친 테마를 다시 적용', /if\(Object\.prototype\.hasOwnProperty\.call\(_idbCache,'return_theme_studio_state_v1'\)&&typeof themeStudioApply==='function'&&typeof themeStudioGet==='function'\)\{ themeStudioApply\(themeStudioGet\(\)\);/.test(html));
t.ok('IDB 준비 전엔 테마 상태를 저장하지 않음(못 읽은 기본값으로 덮지 않게)', /\|\| key==='return_theme_studio_state_v1' \|\| key==='return_theme_studio_presets_v1' \|\| key==='return_theme_studio_assets_v1'\)\)\{/.test(html));
t.done();
