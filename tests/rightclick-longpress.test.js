'use strict';
/* '조작(메뉴/삭제/빠른 처리)' 진입은 데스크톱 우클릭 = 모바일 롱프레스로 통일한다.
   롱프레스만 있던 요소들(계획창 종일 칩, 루틴 완료 칸, 집중 타이머 프리셋)에 우클릭
   대안을 추가하고, 우클릭이 탭/기본 동작을 겹쳐 실행하지 않게 버튼 가드를 둔다. */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('우클릭 = 모바일 롱프레스');

// 계획창 트레이/종일 칩
t.ok('트레이: onLongPress 있으면 우클릭도 연결', /if\(typeof opts\.onLongPress==='function'\)\{ item\.addEventListener\('contextmenu',function\(e\)\{ e\.preventDefault\(\); opts\.onLongPress\(\); \}\); \}/.test(html));
t.ok('트레이: 우클릭 pointerdown 가드', /item\.addEventListener\('pointerdown',function\(e\)\{\s*if\(e\.button&&e\.button!==0\)return;/.test(html));

// 루틴 완료 칸
t.ok('루틴 완료 칸: 우클릭 → 상태 메뉴', /btn\.addEventListener\('contextmenu',function\(e\)\{e\.preventDefault\(\);openStateMenu\(\);\}\);/.test(html));

// 집중 타이머 프리셋
t.ok('집중 프리셋: 우클릭 → 삭제(askDelete)', /el\.addEventListener\('contextmenu',function\(e\)\{e\.preventDefault\(\);cancel\(\);askDelete\(\);\}\);/.test(html));
t.ok('집중 프리셋: 우클릭 down/up 가드(프리셋 적용 방지)', /el\.addEventListener\('pointerdown',function\(e\)\{if\(e\.button&&e\.button!==0\)return;/.test(html) && /el\.addEventListener\('pointerup',function\(e\)\{if\(e\.button&&e\.button!==0\)return;/.test(html));
t.ok('집중 프리셋: 삭제 로직 공유 함수(askDelete)', /function askDelete\(\)\{var id=el\.getAttribute\('data-preset'\)[\s\S]*?openConfirmDialog\('프리셋 삭제'/.test(html));

// 계획창 블록은 원래부터 우클릭+롱프레스 둘 다 (회귀 방지)
t.ok('계획창 블록: 우클릭 컨텍스트 메뉴 유지', /el\.addEventListener\('contextmenu',function\(e\)\{ e\.preventDefault\(\); _planBlockMenu\(t, e\.clientX, e\.clientY\); \}\);/.test(html));

t.done();
