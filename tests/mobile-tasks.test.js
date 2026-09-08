'use strict';
/* 모바일 리디자인 ③: 할일 화면 재배치(레이아웃만 — 기능·라우팅 무변경).
   - 컨트롤(콤팩트/마감뷰/…)·카테고리 칩을 2줄 줄바꿈 대신 한 줄 가로 스크롤.
   - 달력 셀을 낮춰 첫 화면에서 리스트가 보이게.
   - 모바일 '달력 접기/펼치기' 토글: 접으면 그리드만 숨겨 리스트에 공간(월 이동·필터
     유지). 상태는 기기 로컬(localStorage)로 저장/복원. 데스크톱엔 영향 없음. */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('모바일 할일 화면');

// ── DOM: 달력 접기 토글 버튼 ──
t.ok('달력 접기 토글 버튼', /id="m-cal-toggle"[^>]*onclick="mCalToggle\(\)"/.test(html));

// ── JS: 토글 + 상태 저장/복원 ──
t.ok('mCalToggle이 m-cal-collapsed 토글', /function mCalToggle\(\)\{[\s\S]*?classList\.toggle\('m-cal-collapsed'\)/.test(html));
t.ok('토글 상태를 localStorage에 저장', /localStorage\.setItem\('m_cal_collapsed', on\?'1':'0'\)/.test(html));
t.ok('mCalApply가 저장된 상태 복원', /function mCalApply\(\)\{[\s\S]*?localStorage\.getItem\('m_cal_collapsed'\)==='1'/.test(html));
t.ok('로드시 mCalApply 적용', /try\{ mCalApply\(\); \}catch\(e\)\{\}/.test(html));

// ── CSS ──
t.ok('데스크톱에선 달력 접기 버튼 숨김', /\.m-cal-toggle \{ display:none; \}|, \.m-cal-toggle \{ display:none; \}/.test(html));
t.ok('컨트롤·카테고리 칩 한 줄 가로 스크롤',
  /#page-task \.cal-controls, #page-task \.cat-filter\{ flex-wrap:nowrap; overflow-x:auto;/.test(html));
t.ok('달력 셀 낮춤(정사각형 해제)', /#page-task \.cal-day\{ aspect-ratio:auto; height:34px;/.test(html));
t.ok('접으면 그리드 숨김', /#page-task\.m-cal-collapsed \.cal-grid-outer\{ display:none; \}/.test(html));
t.ok('접힘 시 min-height:260px 무효화(헤더만 남김)', /#page-task\.m-cal-collapsed \.cal-panel\{ min-height:0; max-height:none;/.test(html));
t.ok('모바일 달력 토글 표시', /\.cal-nav \.m-cal-toggle\{ display:inline-flex;/.test(html));
t.ok('뷰 토글 가로 스크롤', /#page-task \.view-toggle\{ overflow-x:auto;/.test(html));

t.done();
