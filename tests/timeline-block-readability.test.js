'use strict';
/* 타임라인 블록 가독성·편의성 개선(나탭 htb / 계획창 여러날 overview):
   - 나탭: 이동시간 블록을 체크·배지·타이머 없는 슬림 해칭 레인(.htb-travel + 라벨)으로,
     실블록 최소 높이 28px, 이름 한 줄 말줄임. 분할 레인 폭 유지.
   - 계획창 여러날(_planRenderMulti): 카테고리색 거의 불투명 배경 + 밝기 기반 대비 글자색
     (twvTextColor), 블록 최소 높이 20px. (할일탭 twv 뷰는 계획창으로 대체되어 제거됨) */
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

/* 계획창 여러날 overview 블록 가독성 */
t.ok('planm 블록 글자 10px', /\.planm-bt\{font-size:10px;/.test(html));
t.ok('twvTextColor 대비 글자색 헬퍼', /function twvTextColor\(hex\)\{[\s\S]*?var L=\(0\.299\*r\+0\.587\*g\+0\.114\*b\)\/255;[\s\S]*?return L<0\.62\?'#ffffff':'#1c1c1c';/.test(html));
t.ok('여러날 블록 최소 높이 20', /var hgt=Math\.max\(\(em-sm\)\/60\*SLOT_H-2,20\);/.test(html));
t.ok('여러날 배경 거의 불투명 + 대비 글자색', /var bg=\(typeof twvHexAlpha==='function'\)\?twvHexAlpha\(hex,done\?0\.2:0\.92\):hex;[\s\S]*?var tc=done\?'var\(--fg-4\)':\(\(typeof twvTextColor==='function'\)\?twvTextColor\(hex\):'#fff'\);/.test(html));
t.ok('여러날 style에 배경/글자색 반영', /background:'\+bg\+';color:'\+tc\+';border-left/.test(html));
t.ok('할일탭 twv 뷰 제거됨(#task-week-view 없음)', !/id="task-week-view"/.test(html) && !/function renderTaskWeekView/.test(html));

t.done();
