'use strict';
/* RDS v2 — 공통 디자인 기반(1단계) · 공통 프레임(2단계) · 할일 탭 시안.
   계약: 크기 클래스(폰 <640 · 태블릿 · 데스크톱 ≥1024), 손가락이면 44px 조작, 폰 글자 한 단계 크게
   (테마 스튜디오 글자 크기와도 호환), 메인 CSS에 9~11.5px 하드코딩 없음, 폰 모달은 아래 시트.
   할일 탭: 주간 줄 기본 · '보기' 메뉴 · 길게 누르기/밀기/우클릭 같은 동작 · 키보드 단축키. */
const vm = require('vm');
const { readIndex, sliceBlock, runner } = require('./lib');
const html = readIndex();
const t = runner('RDS 기반 + 할일 탭');

const css = html.slice(html.indexOf('<style>\n\n/* ── DESIGN SYSTEM TOKENS ── */'), html.indexOf('\n</style>\n</head>'));

// 1단계 — 토큰
t.ok('손가락이면 조작 44px', /@media \(pointer:coarse\)\{ :root\{ --tap:44px; --ctl-h:44px;/.test(css));
t.ok('폰 글자 단계 상향', /@media \(max-width:639px\)\{ :root\{ --gutter:16px; --text-2xs:11px; --text-micro:11px; --text-mini:12px; --text-xs:12px; --text-sm:13px; --text-base:14px;/.test(css));
t.ok('데스크톱 기본 micro/mini는 10/11px', /--text-micro:10px; --text-mini:11px;/.test(css));
t.ok('메인 CSS에 9~11.5px 하드코딩 글자 없음', !/font-size:\s*(9|10|10\.5|11|11\.5)px/.test(css));
t.ok('테마 스튜디오도 폰 글자 상향(큰 글씨 설정은 제외)', /var sizeC=typo\.size==='large'\?null:/.test(html) && /if\(sizeC\)css\+='@media \(max-width:639px\)\{:root\{--text-xs:'/.test(html));

// 2단계 — 공통 프레임
t.ok('모든 탭 제목 같은 크기', /\.inbox-title,\.music-title,\.rec-nav-title,\.set-nav-title,\.tt-left-title,\.list-date,\.plan-date,\.hobby-banner-title\{\s*font-size:var\(--title-size\)!important/.test(css));
t.ok('손가락: 공통 버튼 최소 높이', /:is\(\.btn,\.set-btn,\.icon-btn,[\s\S]*?\)\{min-height:var\(--ctl-h\)\}/.test(css));
t.ok('작은 인라인 조작은 눌리는 영역만 44px', /::after\{\s*content:"";position:absolute;left:50%;top:50%;width:max\(100%,44px\);height:max\(100%,44px\)/.test(css));
t.ok('폰 모달 = 아래 시트', /@media \(max-width:639px\)\{\s*\.overlay\{align-items:flex-end;padding:0\}/.test(css));

// 할일 탭 — 구조
t.ok('주간 줄 렌더(renderCal 끝에서)', /setupCalDragDrop\(\);\s*try\{ rdsRenderWeekStrip\(\); \}catch\(_e\)\{\}/.test(html));
t.ok('주간 줄이 기본(저장값 없으면 접힘)', /var on=true; try\{ var _mv=localStorage\.getItem\('m_cal_collapsed'\); if\(_mv!==null\)on=_mv==='1'; \}/.test(html));
t.ok('주간 모드면 ‹ › 가 한 주씩', /getElementById\('cal-prev'\)\.addEventListener\('click',function\(\)\{if\(rdsWeekMode\(\)\)\{rdsShiftWeek\(-1\);return;\}/.test(html));
t.ok("보기 토글은 '보기' 메뉴 하나로", /id="m-view-btn"[^>]*onclick="taskViewMenu\(this\)"/.test(html) && /#page-task \.cal-controls\{display:none\}/.test(css));
t.ok('손가락 기기는 HTML 드래그 끔', /el\.setAttribute\('draggable',rdsIsTouch\(\)\?'false':'true'\);/.test(html));
t.ok('마우스 줄 빠른 버튼', /qa\.className='ti-quick'/.test(html));

// 할일 탭 — 제스처 안전장치
{
  const i = html.indexOf('/* 할일 줄 제스처(손가락)');
  const seg = html.slice(i, i + 5600);
  t.ok('제스처 블록 존재', i > 0);
  t.ok('손가락만(pointerType touch)', /if\(e\.pointerType!=='touch'\|\|\(typeof selMode!=='undefined'&&selMode\)\)return;/.test(seg));
  t.ok('세로로 움직이면 아무 것도 안 함(스크롤)', /if\(Math\.abs\(dy\)>10&&Math\.abs\(dy\)>=Math\.abs\(dx\)\)\{ clear\(st\); st=null; return; \}/.test(seg));
  t.ok('가로 의도가 분명할 때만 밀기', /Math\.abs\(dx\)>14&&Math\.abs\(dx\)>Math\.abs\(dy\)\*1\.5/.test(seg));
  t.ok('충분히 민 뒤 손을 뗐을 때만 실행(취소 제외)', /var armed=s\.mode==='swipe'&&Math\.abs\(s\.dx\)>=lim\(s\.row\)&&e\.type==='pointerup';/.test(seg));
  t.ok('길게 누르기·밀기 뒤 클릭은 문서 전체에서 버림', /document\.addEventListener\('click',function\(e\)\{ if\(Date\.now\(\)<_rdsSuppressUntil\)/.test(seg));
  t.ok('할일 탭·나 탭 오늘 할일이 같은 제스처', /rdsBindTaskGestures\(document\.getElementById\('task-sections'\),'\.task-item'\);\s*rdsBindTaskGestures\(document\.getElementById\('home-eisen-grid'\),'\.eisen-item'\);\s*rdsBindTaskGestures\(document\.getElementById\('home-task-list'\),'\.task-item'\);/.test(seg));
  t.ok('하위·준비물 영역에선 제스처 시작 안 함', /e\.target\.closest\('\.task-children,\.task-prep-list,\.ti-quick'\)/.test(seg));
}
// 할일 탭 — 키보드
{
  const i = html.indexOf('/* 할일 탭 키보드');
  const seg = html.slice(i, i + 1600);
  t.ok('할일 탭에서만', /_currentPage!=='tasks'\)return;/.test(seg));
  t.ok('입력 중엔 무시', /if\(tag==='input'\|\|tag==='textarea'\|\|tag==='select'/.test(seg));
  t.ok('창이 열려 있으면 무시', /if\(_rdsOpen\|\|document\.querySelector\('\.overlay\.open'\)\)return;/.test(seg));
}

// 하루 미루기 날짜 계산(실제 함수)
{
  const src = sliceBlock(html, 'function _taskTomorrowKey(){', 'function _taskPickDate(t){');
  const ctx = { TK: '2026-10-27', Date, dk: d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') };
  vm.createContext(ctx); vm.runInContext(src, ctx);
  t.ok('오늘 할일 → 내일', ctx._taskPostponeKey({ date: '2026-10-27' }) === '2026-10-28');
  t.ok('지난 할일 → 내일', ctx._taskPostponeKey({ date: '2026-10-20' }) === '2026-10-28');
  t.ok('날짜 없음 → 내일', ctx._taskPostponeKey({}) === '2026-10-28');
  t.ok('앞날 할일 → 그다음 날', ctx._taskPostponeKey({ date: '2026-10-30' }) === '2026-10-31');
  t.ok('월 넘김', ctx._taskPostponeKey({ date: '2026-10-31' }) === '2026-11-01');
  t.ok('라벨: 오늘/내일/날짜', ctx._taskDayLabel('2026-10-27') === '오늘' && ctx._taskDayLabel('2026-10-28') === '내일' && ctx._taskDayLabel('2026-11-03') === '11/03');
}

// 나 탭
t.ok('나 탭 오늘 할일 줄에 data-id(제스처·메뉴 대상)', /it\.setAttribute\('data-id', t\.id\);\s*it\.setAttribute\('draggable', rdsIsTouch\(\)\?'false':'true'\);/.test(html) && /row\.setAttribute\('data-id', t\.id\);/.test(html));
t.ok('빈 사분면 표시', /box\.classList\.add\('is-empty'\);/.test(html) && /\.eisen-box\.is-empty\{flex-direction:row;/.test(css));
t.ok('레이더 주간 그리드: 폰은 하루 84px + 가로 밀기', /if \(_tgNarrow\) cw = Math\.max\(cw, COLS \* 84 \+ PAD_X \* 2\);/.test(html) && /layer\.style\.width = _tgNarrow \? cw \+ 'px' : '';/.test(html));
t.ok('위젯 카드가 남는 높이를 채우지 않음', /\.home-col > \.home-widget-card:last-child\{flex:0 0 auto!important;min-height:0!important\}/.test(css));
t.ok('사진 없으면 사진 꽉 채움 모드 아님', /card\.classList\.toggle\('hw-photo-mode',type==='photo'&&!!localStorage\.getItem\('home_widget_photo'\)\)/.test(html));
t.ok('오늘 상황 주 버튼 = 테마 색', /\.sit-now-btn\.primary\{background:var\(--accent\);border-color:var\(--accent\);color:#fff\}/.test(css));
t.ok('카드 제목 공통(또렷한 제목)', /\.sec-label\{font-size:var\(--text-base\);font-weight:700;color:var\(--fg\);letter-spacing:-\.01em;text-transform:none\}/.test(css));

t.done();
