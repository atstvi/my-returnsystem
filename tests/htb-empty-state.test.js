'use strict';
/* 나탭 타임블록 — 오늘 시간 지정 블록도 실제 종일 항목도 없으면, 큰 빈 격자로 홈을
   도배하지 말고 컴팩트 안내(🗓️ + '계획 세우기')로 대체한다. 항목이 생기면 격자 복귀. */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('나탭 타임블록 빈 상태');

t.ok('실제 종일 항목 유무를 placeholder 추가 전에 판정', /var _htbHadAllday = allday\.children\.length>0;\s*if \(!_htbHadAllday\) \{/.test(html));
t.ok('빈 격자 → htb-empty 클래스', /if\(!_htbHasTimed && !_htbHadAllday\)\{\s*_htbBody\.classList\.add\('htb-empty'\);/.test(html));
t.ok('컴팩트 안내 패널 + 계획 세우기 버튼', /_ov\.className='htb-empty-panel'/.test(html) && /오늘은 아직 시간 계획이 없어요/.test(html) && /id="htb-empty-plan">계획 세우기/.test(html));
t.ok('계획 세우기 → 계획창 열기', /#htb-empty-plan'\);[\s\S]*?_planReturnPage='home'; if\(typeof goPage==='function'\)goPage\('planner'\);/.test(html));
t.ok('밀린 할일 있으면 오늘로 버튼', /id="htb-empty-pull">지난 할일 '\+_ovOverdue\+'개 오늘로/.test(html));
t.ok('항목 있으면 htb-empty 해제', /\} else \{\s*_htbBody\.classList\.remove\('htb-empty'\);\s*\}/.test(html));
t.ok('이전 빈 패널 정리(중복 방지)', /var _htbOldEmpty=document\.getElementById\('htb-empty'\); if\(_htbOldEmpty\)_htbOldEmpty\.remove\(\);/.test(html));
t.ok('빈 상태 CSS: 격자 숨김 + 중앙 배치', /\.htb-body\.htb-empty\{display:flex;align-items:center;justify-content:center[\s\S]*?\.htb-body\.htb-empty \.htb-axis,\.htb-body\.htb-empty \.htb-slots\{display:none\}/.test(html));

t.done();
