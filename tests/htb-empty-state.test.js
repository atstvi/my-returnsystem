'use strict';
/* 나탭 타임블록 — 시간 지정 블록이 하나도 없어도 '타임라인(시각 격자)'는 항상 보인다.
   (예전엔 빈 격자를 컴팩트 패널로 접었는데, 그러면 타임블록처럼 안 보인다는 피드백에 따라
   접기(htb-empty)를 제거.) 시간 계획이 없을 땐 격자 위에 옅은 안내(htb-empty-hint)만 얹고,
   탭하면 계획창으로 간다. 격자(axis/slots)는 절대 숨기지 않는다. */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('나탭 타임블록 빈 상태(타임라인 유지)');

t.ok('실제 종일 항목 유무를 placeholder 추가 전에 판정', /var _htbHadAllday = allday\.children\.length>0;\s*if \(!_htbHadAllday\) \{/.test(html));
t.ok('격자는 항상 유지 — htb-empty 클래스 항상 해제', /if\(_htbBody\)\{\s*_htbBody\.classList\.remove\('htb-empty'\);/.test(html));
t.ok('빈 상태를 격자 숨김으로 접지 않음(add htb-empty 없음)', !/_htbBody\.classList\.add\('htb-empty'\)/.test(html));
t.ok('시간 블록 없으면 옅은 안내(htb-empty-hint) 격자 위에 얹기', /if\(!_htbHasTimed\)\{[\s\S]*?_hint\.className='htb-empty-hint'[\s\S]*?slots\.appendChild\(_hint\);/.test(html));
t.ok('안내 문구 종일 유무에 적응', /_htbHadAllday\?'시간 계획 없음 · 종일 할일을 시간대로 배치해보세요':'시간 계획 없음 · 탭해서 계획 세우기'/.test(html));
t.ok('안내 탭 → 계획창 열기', /_hint\.addEventListener\('click',function\(\)\{ _planReturnPage='home'; if\(typeof goPage==='function'\)goPage\('planner'\); \}\);/.test(html));
t.ok('이전 안내 정리(중복 방지)', /var _htbOldEmpty=document\.getElementById\('htb-empty'\); if\(_htbOldEmpty\)_htbOldEmpty\.remove\(\);/.test(html));
t.ok('안내 CSS: 격자 위 옅은 알약(격자 숨기지 않음)', /\.htb-empty-hint\{position:absolute[\s\S]*?cursor:pointer/.test(html));

t.done();
