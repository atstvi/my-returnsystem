'use strict';
/* 할일탭 타임블록(주간) 뷰:
   1) 종일 할일을 3개까지 접어 보이되, 토글로 모두 펼칠 수 있게(_twvAlldayExpanded).
   2) 드래그·완료·생성 등 '제자리 편집' 재렌더에서 스크롤 위치를 유지(keepScroll).
      예전엔 매 재렌더마다 현재 시각으로 자동 스크롤돼, 드래그할 때마다 스크롤이 위로
      튀어(새로고침처럼) 보였다. */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('타임블록 종일 펼치기·스크롤 유지');

// ── 스크롤 유지 ──
{
  t.ok('renderTaskWeekView(keepScroll) 파라미터', /function renderTaskWeekView\(keepScroll\)\{/.test(html));
  t.ok('재렌더 전 이전 스크롤 캡처',
    /if\(keepScroll\)\{ var _pv=container\.querySelector\('#twv-viewport'\); if\(_pv\)_twvPrevScroll=\{top:_pv\.scrollTop,left:_pv\.scrollLeft\}; \}/.test(html));
  t.ok('keepScroll이면 자동 스크롤 대신 이전 위치 복원',
    /if\(keepScroll&&_twvPrevScroll\)\{[\s\S]*vp\.scrollTop=_ps\.top; vp\.scrollLeft=_ps\.left;/.test(html));
  t.ok('복원 시 smooth 잠깐 끔(즉시 복원)',
    /vp\.style\.scrollBehavior='auto';/.test(html));
  // 제자리 편집 재렌더 5곳은 keepScroll=true
  t.ok('완료 토글 재렌더 keepScroll', /t\.done=!t\.done;t\.updatedAt=Date\.now\(\);[\s\S]{0,120}renderTaskWeekView\(true\);/.test(html));
  t.ok('블록 드래그 재렌더 keepScroll', /if\(pendingDate\)t\.date=pendingDate;\}\s*t\.updatedAt=Date\.now\(\);[\s\S]{0,120}renderTaskWeekView\(true\);/.test(html));
  t.ok('리사이즈 재렌더 keepScroll', /t\.timeEnd=twvFmt\(pendingEm\);t\.updatedAt=Date\.now\(\);[\s\S]{0,120}renderTaskWeekView\(true\);/.test(html));
  t.ok('종일 드래그 재렌더 keepScroll', /t\.timeEnd=twvFmt\(pendingSm\+60\);[\s\S]{0,160}renderTaskWeekView\(true\);/.test(html));
  t.ok('생성 재렌더 keepScroll', /tasks\.unshift\(nt\);[\s\S]{0,120}renderTaskWeekView\(true\);/.test(html));
  // 네비게이션은 자동 스크롤 유지(인자 없음)
  t.ok('이전/다음 이동은 자동 스크롤(인자 없음)',
    /_twvAnchor=a;renderTaskWeekView\(\);/.test(html));
}

// ── 종일 펼치기 ──
{
  t.ok('_twvAlldayExpanded 상태 변수', /var _twvAlldayExpanded = false;/.test(html));
  t.ok('펼침 여부로 표시 개수 결정(접으면 3)', /var limit=_twvAlldayExpanded\?notime\.length:3;/.test(html));
  t.ok('접힘 & 3개 초과일 때만 "+N개" 토글', /if\(!_twvAlldayExpanded&&notime\.length>3\)chips\+='<div class="twv-allday-more" data-twv-allday-toggle="1"/.test(html));
  t.ok('종일 축 라벨 토글(펼칠 게 있을 때)', /_canExpand\?' twv-allday-toggle'/.test(html) && /var _canExpand=_maxNotime>3;/.test(html));
  t.ok('토글 클릭 → 펼침 반전 + 스크롤 유지 재렌더',
    /\[data-twv-allday-toggle\][\s\S]{0,160}_twvAlldayExpanded=!_twvAlldayExpanded;\s*renderTaskWeekView\(true\);/.test(html));
}

// ── 종일 칩 드래그: sticky 종일/헤더 행이 그리드를 덮어도 시간 지정되게 ──
{
  // 드래그 시작 시 종일/헤더 행을 통과(pointer-events:none)시켜 elementFromPoint가 그리드 열을 찾게
  t.ok('드래그 중 종일/헤더 행 통과',
    /container\.querySelectorAll\('\.twv-allday-row,\.twv-head-row'\)\.forEach\(function\(r\)\{r\.style\.pointerEvents='none';\}\);/.test(html));
  // 드래그 종료 시 원복
  t.ok('드래그 종료 시 pointer-events 원복',
    /container\.querySelectorAll\('\.twv-allday-row,\.twv-head-row'\)\.forEach\(function\(r\)\{r\.style\.pointerEvents='';\}\);/.test(html));
}

t.done();
