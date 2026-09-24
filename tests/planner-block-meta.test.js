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
t.ok('이동시간·준비물 값 계산(목표 대표 제외)', /var travelMin=parseInt\(t\.travelMin\|\|t\.moveMin\|\|t\.travelMinutes\|\|0,10\)\|\|0;\s*var prepAll=\(!isGoalRep&&typeof taskPrepList==='function'\)\?taskPrepList\(t\):\[\];/.test(html));
t.ok('여유 높이일 때 메타(이동·준비물) 표시', /if\(\(travelMin>0\|\|prepAll\.length\) && hgt>42\)\{/.test(html));
t.ok('이동시간 칩 🚶 N분', /tv\.className='pbm-travel'; tv\.textContent='🚶 '\+travelMin\+'분'/.test(html));
t.ok('준비물 칩 🧳 done/total', /pp\.textContent='🧳 '\+prepDone\+'\/'\+prepAll\.length;/.test(html));
t.ok('준비물 칩 탭 → 체크리스트 열기', /pp\.addEventListener\('click',function\(e\)\{ e\.stopPropagation\(\); openPrepChecklistEditor\(t,function\(\)\{[\s\S]*?renderPlanner\(\); \}\); \}\);/.test(html));

// 드래그 제외
t.ok('컨트롤은 드래그(pointerdown) 대상에서 제외', /\|\|\(e\.target\.closest&&e\.target\.closest\('\.plan-block-ctl'\)\)\)return;/.test(html));

// CSS
t.ok('완료 체크 CSS', /\.plan-block-check\{[\s\S]*?border-radius:var\(--r-full\)/.test(html) && /\.plan-block-check\.done\{background:currentColor\}/.test(html));
t.ok('메타/준비물 CSS', /\.plan-block-meta\{display:flex/.test(html) && /\.pbm-prep\{[\s\S]*?cursor:pointer\}/.test(html));

// ── 대표 처리: 하위/목표 할일 collapse + 블록 안 하위 목록 ──
t.ok('_planWindowBlocks: 하위·목표 할일 collapse + 목표 대표 concat', /if\(typeof taskIsNested==='function' && taskIsNested\(t\)\)return;\s*if\(t\.goalId && typeof findGoal==='function' && findGoal\(t\.goalId\)\)return;[\s\S]*?return out\.concat\(_planGoalReps\(START,END\)\);/.test(html));
t.ok('_planGoalReps: 오늘 소속 할일만(시간 유무 무관, 다른 날 제외)', /var today=all\.filter\(function\(x\)\{ return x&&!x\._travelOnly&&String\(x\.goalId\|\|''\)===gid && x\.date===_planDate; \}\);/.test(html));
t.ok('_planGoalReps: 완료해도 안 사라짐(미완료 게이트 없음)', /var undone=today\.filter\(function\(x\)\{ return !_md\(x\); \}\);\s*\/\* 타임라인에 놓으려면/.test(html) && !/if\(!undone\.length\)return;/.test(html));
t.ok('목표 대표 완료 판정(소속 다 완료면 done — 흐리게 남김)', /var _grDone = !!t\._planGoalRep && Number\(t\._repTotal\)>0 && Number\(t\._repDone\|\|0\)>=Number\(t\._repTotal\);\s*var done=t\._planGoalRep \? _grDone :/.test(html));
t.ok('_planGoalReps: 시간 있는 멤버로 위치·높이(완료 포함) + 90~180분 상한', /var timed=today\.filter\(_timed\);\s*if\(!timed\.length\)return;[\s\S]*?timed\.forEach\(function\(m\)\{[\s\S]*?var dur=Math\.max\(90, Math\.min\(\(eMax-sMin\), 180\)\);/.test(html));
t.ok('_planGoalReps: 진행 정보 저장(_repDone/_repTotal)', /_repMembers:today, _repDone:\(today\.length-undone\.length\), _repTotal:today\.length/.test(html));
t.ok('대표 목록: 목표=미완료만, 일반=하위 전체', /var repChildren = isGoalRep \? repAll\.filter\(function\(x\)\{return !_effDone\(x\);\}\) : repAll;/.test(html));
t.ok('목표 대표는 체크 대신 진행 뱃지(🎯 done/total)', /if\(isGoalRep\)\{\s*var cnt=document\.createElement\('span'\); cnt\.className='plan-block-count'; cnt\.textContent='🎯 '\+repDoneN\+'\/'\+repTotal;/.test(html));
t.ok('하위 행에 시각 표기(대표가 시간 다 못 덮으니)', /if\(\/\^\\d\{1,2\}:\\d\{2\}\$\/\.test\(String\(ch\.timeStart\|\|''\)\)\)\{ var tmc=document\.createElement\('span'\); tmc\.className='pbs-time'; tmc\.textContent=ch\.timeStart;/.test(html));
t.ok('블록 안에 하위/소속 할일 목록 렌더', /if\(repChildren\.length && hgt>52\)\{[\s\S]*?subs\.className='plan-block-subs'[\s\S]*?pbs-check plan-block-ctl[\s\S]*?pbs-name/.test(html));
t.ok('하위 행 미니 체크=완료 토글, 이름 탭=편집창', /sck\.addEventListener\('click',function\(e\)\{ e\.stopPropagation\(\); if\(typeof taskCheckToggle==='function'\)taskCheckToggle\(ch\)[\s\S]*?row\.addEventListener\('click',function\(e\)\{ e\.stopPropagation\(\);[\s\S]*?tasksOpenModal\(live\)/.test(html));
t.ok('목표 대표는 드래그로 소속 이동(_planBindGoalRep) + 탭', /if\(isGoalRep\)\{[\s\S]*?el\.style\.cursor='grab';\s*_planBindGoalRep\(el,t,o,START,SLOT_H\);\s*return el;\s*\}/.test(html));
t.ok('_planBindGoalRep: 소속 할일들을 같은 delta로 이동', /function _planBindGoalRep\(el,t,o,START,SLOT_H\)\{[\s\S]*?var delta=o\.sm - sm0;[\s\S]*?\(t\._repMembers\|\|\[\]\)\.forEach\(function\(m\)\{[\s\S]*?m\.timeStart=_planHM\(ns2\); m\.timeEnd=_planHM\(ns2\+d\); m\.updatedAt=Date\.now\(\);[\s\S]*?saveTaskData\(\)/.test(html));
t.ok('_planBindGoalRep: 안 움직이면 첫 소속 편집창', /\} else \{\s*var first=\(t\._repMembers\|\|\[\]\)\[0\];[\s\S]*?tasksOpenModal\(live\)/.test(html));
t.ok('saveTaskData: 계획창 열려 있으면 즉시 반영(모달·일괄 등)', /if\(!window\._fbApplyReloadPhase && typeof renderPlanner==='function' && \(typeof _planEditId==='undefined'\|\|_planEditId==null\)\)\{[\s\S]*?_pp\.classList\.contains\('active'\)\)renderPlanner\(\);/.test(html));
t.ok('하위 목록 CSS', /\.plan-block-subs\{[\s\S]*?flex-direction:column/.test(html) && /\.pbs-check\.done\{background:currentColor\}/.test(html));

t.done();
