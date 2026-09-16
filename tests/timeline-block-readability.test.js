'use strict';
/* 타임라인 블록 가독성·편의성 개선(나탭 htb / 할일탭 twv):
   - 나탭: 이동시간 블록을 체크·배지·타이머 없는 슬림 해칭 레인(.htb-travel + 라벨)으로,
     실블록 최소 높이 28px, 이름 한 줄 말줄임. 분할 레인 폭 유지.
   - 할일탭(twv): 블록 최소 24px, 카테고리색 거의 불투명 배경 + 밝기 기반 대비 글자색
     (twvTextColor), 글자 11px. */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('타임라인 블록 가독성');

/* 나탭 htb */
t.ok('이름 한 줄 말줄임', /\.htb-vname \{[^}]*text-overflow:ellipsis;[^}]*white-space:nowrap;/.test(html));
t.ok('.htb-travel 해칭 레인 스타일', /\.htb-vblock\.htb-travel \{[\s\S]*?repeating-linear-gradient/.test(html));
t.ok('.htb-travel-lbl 라벨 스타일', /\.htb-travel-lbl \{[^}]*text-overflow:ellipsis;/.test(html));
t.ok('makeBlock: isTravel 판정', /var isTravel=!!t\._travelOnly;/.test(html));
t.ok('실블록 최소 28px·이동 18px', /isTravel\?18:\(virtual\?20:28\)/.test(html));
t.ok('이동 블록: htb-travel 클래스 + 슬림 라벨 + 조기 반환', /if\(isTravel\)\{\s*el\.classList\.add\('htb-travel'\);[\s\S]*?trLbl\.textContent='🚶 '\+\(parseInt\(t\.travelMin,10\)\|\|0\)\+'분 이동';[\s\S]*?slots\.appendChild\(el\); return;/.test(html));
t.ok('이동 블록도 분할 레인 폭 유지', /if\(isTravel\)\{[\s\S]*?if\(!_htbSplit\)\{ el\.style\.left='var\(--sp-6\)'; el\.style\.right='var\(--sp-6\)'; \}/.test(html));

/* 할일탭 twv */
t.ok('twv 블록 글자 11px', /\.twv-block\{[^}]*font-size:11px;/.test(html));
t.ok('twvTextColor 대비 글자색 헬퍼', /function twvTextColor\(hex\)\{[\s\S]*?var L=\(0\.299\*r\+0\.587\*g\+0\.114\*b\)\/255;[\s\S]*?return L<0\.62\?'#ffffff':'#1c1c1c';/.test(html));
t.ok('twv 블록 최소 높이 24', /var h=Math\.max\(\(em-sm\)\/60\*SLOT_H-2,24\);/.test(html));
t.ok('twv 배경 거의 불투명 + 대비 글자색 적용', /var bg=twvHexAlpha\(hexCol,t\.done\?0\.22:0\.92\);[\s\S]*?var txtCol=t\.done\?'var\(--fg-4\)':twvTextColor\(hexCol\);/.test(html));
t.ok('twv style에 color 반영', /background:'\+bg\+';color:'\+txtCol\+';border-left/.test(html));
t.ok('twv 리사이즈 최소도 24', /block\.style\.height=Math\.max\(\(nem-origSm\)\/60\*SLOT_H-2,24\)\+'px';/.test(html));

t.done();
