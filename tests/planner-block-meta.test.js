'use strict';
/* 계획창 타임블록 = 홈 타임블록처럼 완료 여부·이동시간·준비물을 함께 보여준다.
   - 완료 체크(.plan-block-check): 탭하면 taskCheckToggle로 완료 토글(취소면 되돌리기).
   - 이동시간(🚶 N분) / 준비물(🧳 done/total, 탭 → 준비물 체크리스트).
   - 이 컨트롤들은 .plan-block-ctl로 드래그(pointerdown) 대상에서 제외해 배치와 안 겹친다. */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('계획창 블록 완료·이동·준비물');

// 완료 체크
t.ok('블록에 완료 체크 버튼', /var ck=document\.createElement\('button'\);[\s\S]*?ck\.className='plan-block-check plan-block-ctl'\+\(done&&!canceled\?' done':''\)\+\(canceled\?' canceled':''\)/.test(html));
t.ok('체크 탭 → taskCheckToggle 후 재렌더', /ck\.addEventListener\('click',function\(e\)\{ e\.stopPropagation\(\); if\(typeof taskCheckToggle==='function'\)taskCheckToggle\(t\);[\s\S]*?renderPlanner\(\); \}\);/.test(html));

// 이동시간 + 준비물
t.ok('이동시간·준비물 값 계산', /var travelMin=parseInt\(t\.travelMin\|\|t\.moveMin\|\|t\.travelMinutes\|\|0,10\)\|\|0;\s*var prepAll=\(typeof taskPrepList==='function'\)\?taskPrepList\(t\):\[\];/.test(html));
t.ok('여유 높이일 때 메타(이동·준비물) 표시', /if\(\(travelMin>0\|\|prepAll\.length\) && hgt>42\)\{/.test(html));
t.ok('이동시간 칩 🚶 N분', /tv\.className='pbm-travel'; tv\.textContent='🚶 '\+travelMin\+'분'/.test(html));
t.ok('준비물 칩 🧳 done/total', /pp\.textContent='🧳 '\+prepDone\+'\/'\+prepAll\.length;/.test(html));
t.ok('준비물 칩 탭 → 체크리스트 열기', /pp\.addEventListener\('click',function\(e\)\{ e\.stopPropagation\(\); openPrepChecklistEditor\(t,function\(\)\{[\s\S]*?renderPlanner\(\); \}\); \}\);/.test(html));

// 드래그 제외
t.ok('컨트롤은 드래그(pointerdown) 대상에서 제외', /\|\|\(e\.target\.closest&&e\.target\.closest\('\.plan-block-ctl'\)\)\)return;/.test(html));

// CSS
t.ok('완료 체크 CSS', /\.plan-block-check\{[\s\S]*?border-radius:var\(--r-full\)/.test(html) && /\.plan-block-check\.done\{background:currentColor\}/.test(html));
t.ok('메타/준비물 CSS', /\.plan-block-meta\{display:flex/.test(html) && /\.pbm-prep\{[\s\S]*?cursor:pointer\}/.test(html));

t.done();
