'use strict';
/* 계획창: 목표 대표 블록 안 소속 할일 줄도 다른 할일처럼 — 우클릭/길게 누르기 = 조작 메뉴,
   끌어서 오른쪽 '인박스'에 놓으면 처리 필요 인박스로. 할일 → 인박스 드래그는 고스트 알약이
   인박스로 날아가며 자연스럽게(새 항목 잠깐 강조). 마감 레이더 '급함 N' 칩은 제목 옆 + 필터. */
const { readIndex, sliceBlock, runner } = require('./lib');
const html = readIndex();
const t = runner('계획창 목표 소속 줄 메뉴·인박스 드래그 + 드래그 애니메이션');

const sub = sliceBlock(html, 'function _planBindSubRow(row, ch){', '\n/* 목표 대표 블록 드래그');
t.ok('소속 줄 우클릭 → 블록과 같은 조작 메뉴', /addEventListener\('contextmenu',function\(e\)\{ e\.preventDefault\(\); e\.stopPropagation\(\); _planBlockMenu\(live\(\), e\.clientX, e\.clientY\); \}\)/.test(sub));
t.ok('소속 줄 길게 누르기 → 메뉴', /var lp=setTimeout\(function\(\)\{ if\(!moved\)\{ menuOpened=true; _planBlockMenu\(live\(\), x0, y0\); \} \}, 460\);/.test(sub));
t.ok('소속 줄 드래그 → 인박스 위면 고스트 📥 모드, 놓으면 날아간 뒤 인박스로', /overInbox=_planInboxDropHover\(ev\.clientX,ev\.clientY\); _planGhostMode\(overInbox\);/.test(sub) && /_planGhostFlyToInbox\(function\(\)\{ if\(_planTaskToInbox\(live\(\)\)\)\{ renderPlanner\(\); _planFlashInbox\(_planLastInboxId\); \} \}\);/.test(sub));
t.ok('소속 줄 탭(안 움직임) → 그 할일 편집창', /if\(!moved\)\{ if\(typeof tasksOpenModal==='function'\)tasksOpenModal\(live\(\)\); return; \}/.test(sub));
t.ok('대표 블록 드래그는 소속 줄에서 시작 안 함(전파 차단 + 무시)', /e\.stopPropagation\(\);\n    var x0=e\.clientX/.test(sub) && /e\.target\.closest\('\.plan-block-sub'\)\)\)return; \/\* 소속 줄은 자기 드래그·메뉴 \*\//.test(html));
t.ok('대표 블록 소속 목록이 바인더 사용', /_planBindSubRow\(row, ch\);/.test(html));
t.ok('메뉴에 인박스로 + 시간 없는 할일엔 길이 칩 숨김', /data-act="toinbox">📥 인박스로 \(처리 필요\)/.test(html) && /\(\/\^\\d\{1,2\}:\\d\{2\}\$\/\.test\(String\(t\.timeStart\|\|''\)\)\?'<div class="plan-ctx-durrow">/.test(html));
t.ok('블록 드래그: 인박스 위 → 블록 흐리게 + 고스트, 놓으면 날아간 뒤 이동', /el\.classList\.add\('to-inbox-pending'\); _planGhostShow\(/.test(html) && /el\.classList\.add\('leaving'\);\n        _planGhostFlyToInbox\(/.test(html));
t.ok('옮긴 인박스 항목 id 기록 → 계획창 목록에서 강조', (html.match(/ _planLastInboxId=(src|item)\.id;/g) || []).length === 2 && /el\.classList\.add\('just-added'\)/.test(html) && /@keyframes planTrayJustAdded/.test(html));
t.ok('마감 레이더 칩: 제목 옆 · 급함 N · 누르면 급한 것만', /마감 레이더<button type="button" class="radar-badge" id="radar-badge"/.test(html) && /badge\.textContent=mustN\?\('급함 '\+mustN\):'✓ 준비 OK';/.test(html) && /_radarOnlyUrgent=!_radarOnlyUrgent;/.test(html) && !/class="sec-badge" id="radar-badge"/.test(html));
t.done();
