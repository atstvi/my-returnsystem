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
t.ok('주간 줄이 기본(새 키 m_cal_view로 한 번 이행)', /var on=true; try\{ var _mv=localStorage\.getItem\('m_cal_view'\); if\(_mv\)on=_mv!=='month'; \}/.test(html));
t.ok('주간 모드면 ‹ › 가 한 주씩', /getElementById\('cal-prev'\)\.addEventListener\('click',function\(\)\{if\(rdsWeekMode\(\)\)\{rdsShiftWeek\(-1\);return;\}/.test(html));
t.ok("보기 토글은 '보기' 메뉴 하나로", /id="m-view-btn"[^>]*onclick="taskViewMenu\(this\)"/.test(html) && /#page-task \.cal-controls\{display:none\}/.test(css));
t.ok('손가락 기기는 HTML 드래그 끔', /el\.setAttribute\('draggable',rdsIsTouch\(\)\?'false':'true'\);/.test(html));
t.ok('마우스 줄 빠른 버튼', /qa\.className='ti-quick'/.test(html));

// 할일 탭 — 제스처 안전장치
{
  const i = html.indexOf('/* 할일 줄 제스처(손가락)');
  const seg = html.slice(i, i + 9000);
  t.ok('제스처 블록 존재', i > 0);
  t.ok('손가락만(pointerType touch)', /if\(e\.pointerType!=='touch'\|\|\(typeof selMode!=='undefined'&&selMode\)\)return;/.test(seg));
  t.ok('세로로 움직이면 아무 것도 안 함(스크롤)', /if\(Math\.abs\(dy\)>10&&Math\.abs\(dy\)>=Math\.abs\(dx\)\)\{ clear\(st\); st=null; return; \}/.test(seg));
  t.ok('가로 의도가 분명할 때만 밀기', /Math\.abs\(dx\)>14&&Math\.abs\(dx\)>Math\.abs\(dy\)\*1\.5/.test(seg));
  t.ok('충분히 민 뒤 손을 뗐을 때만 실행(취소 제외)', /var armed=s\.mode==='swipe'&&Math\.abs\(s\.dx\)>=lim\(s\.row\)&&e\.type==='pointerup';/.test(seg));
  t.ok('길게 누르기·밀기 뒤 클릭은 문서 전체에서 버림', /document\.addEventListener\('click',function\(e\)\{ if\(Date\.now\(\)<_rdsSuppressUntil\)/.test(seg));
  t.ok('할일 탭·나 탭 오늘 할일이 같은 제스처', /rdsBindTaskGestures\(document\.getElementById\('task-sections'\),'\.task-item,\.gti-sub'\);\s*rdsBindTaskGestures\(document\.getElementById\('home-eisen-grid'\),'\.eisen-item'\);\s*rdsBindTaskGestures\(document\.getElementById\('home-task-list'\),'\.task-item'\);/.test(seg));
  t.ok('하위·준비물 영역에선 제스처 시작 안 함', /e\.target\.closest\('\.task-children,\.task-prep-list,\.ti-quick,a,textarea,input'\)/.test(seg));
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

// 할일 탭 구조 정리 · 입력 정리
t.ok('빈 분류는 칩 한 줄(전체 보기일 때)', /var emptyCats=\[\], compactEmpty=\(activeCat==='all'\);/.test(html) && /renderEmptyCategoryChips\(container, emptyCats\);/.test(html));
t.ok('빈 분류 칩: 추가·드롭 지원', /b\.addEventListener\('click',function\(e\)\{ e\.stopPropagation\(\); openAddForCategory\(cid\); \}\);/.test(html) && /_moveTaskToCategory\(_taskById\(dragSrcId\),cid\)/.test(html));
t.ok('빈 분류로 추가하면 추가창이 칩 줄 아래', /var ec=document\.querySelector\('#task-sections \.task-empty-cats'\);/.test(html));
t.ok('분류 머리 = 상자 없는 제목 줄', /#page-task \.section-head\.cat-section-head,#page-task \.section-head\.cat-section-head:hover\{background:none;box-shadow:none;border-radius:0;border-bottom:1px solid var\(--border-subtle\)/.test(css));
t.ok('목표 하위 체크도 동그라미', /\.gti-subcheck\{border-radius:50%\}/.test(css));
t.ok('폰: 상단 입력창 숨기고 페이지 이름', /\.app-topbar \.topbar-capture\{display:none\}/.test(css) && /id="topbar-title"/.test(html) && /_tt\.textContent=RDS_PAGE_TITLES\[slug\]/.test(html));
t.ok('폰: 할일 추가는 ＋ 하나(목록 머리 ＋·맨 아래 줄 숨김)', /#page-task #btn-add,#page-task \.task-add-row\{display:none\}/.test(css));
t.ok('상단 입력창 Task 모드 실시간 인식 미리보기', /function topCapPreview\(\)\{/.test(html) && /id="capture-preview"/.test(html) && /function captureNLChipsHtml\(text\)\{/.test(html));
t.ok('폰 ＋ 시트와 같은 칩 렌더', /var chips=\(_mCapType==='task'\)\?captureNLChipsHtml\(inp\?inp\.value:''\):'';/.test(html));
t.ok('담기 기본 날짜 = 할일 탭에서 보고 있는 날', (html.match(/_captureDefaultDate\(\)/g)||[]).length>=4 && /_currentPage==='tasks'&&typeof selDate!=='undefined'&&selDate\)return selDate;/.test(html));
t.ok('폰 월 달력 칸 44px', /#page-task \.cal-day\{height:44px;/.test(css));

// 계획창
t.ok('폰 계획창 머리 두 줄(겹침 해소)', /\.plan-head\{flex-wrap:wrap;row-gap:var\(--sp-4\);/.test(css) && /\.plan-daypick\{order:3;flex:1 1 0;min-width:220px;/.test(css));
t.ok('폰 트레이가 아래 탭 막대에 가려지지 않음', /\.plan-tray\{padding-bottom:calc\(104px \+ env\(safe-area-inset-bottom\)\)\}/.test(css));
t.ok('손가락: 트레이 항목은 끌기 대신 탭(스크롤 우선)', /if\(e\.pointerType==='touch'\)\{\s*var tk=item\.getAttribute\('data-pkind'\)/.test(html) && /if\(ev\.type!=='pointerup'\|\|tmoved\|\|tlp\)return;/.test(html));
t.ok("빠른 처리에 '시간 정해서 배치'", /opt\('ptq-time','🕒','시간 정해서 배치…'/.test(html) && /_planSchedule\('task',t\.id,sm\); \/\* planner-min은 보고 있는 날/.test(html));
t.ok('트레이 분류 아이콘은 선 아이콘', /h\+=section\(PI\.clock,'다가오는 마감'/.test(html) && !/section\('⏳'/.test(html));
t.ok('빈 타임라인 안내: 손가락·좁은 화면은 탭 안내', /아래 목록에서 할일을 탭해<br>시간에 배치해요/.test(html));
// 유령 클릭 방지(전역)
{
  const i = html.indexOf('/* 유령 클릭 방지(전역)');
  const seg = html.slice(i, i + 2200);
  t.ok('유령 클릭 가드 존재', i > 0);
  t.ok('손가락 뗀 시각 기록', /if\(e\.pointerType==='touch'\)_rdsLastTouchUp=Date\.now\(\);/.test(seg));
  t.ok('창이 열린 시각 기록(MutationObserver)', /new MutationObserver\(/.test(seg));
  t.ok('코드가 부른 click은 통과', /if\(!e\.isTrusted\)return;/.test(seg));
  t.ok('뗀 뒤 열린 창 + 0.45초 안의 클릭만 버림', /box\._rdsOpenedAt>=_rdsLastTouchUp-30 && now-box\._rdsOpenedAt<450 && now-_rdsLastTouchUp<450/.test(seg));
}

// 인박스
t.ok('줄 제스처 공용화(어댑터)', /function rdsBindRowGestures\(host, rowSel, ad\)\{/.test(html) && /function rdsBindTaskGestures\(host, rowSel\)\{ rdsBindRowGestures\(host, rowSel, RDS_TASK_ROW\); \}/.test(html));
t.ok('인박스 말풍선: 길게 누르기·우클릭 = 빠른 처리, 오른쪽 밀기 = 처리 완료', /rdsBindRowGestures\(host,'\.ib2-bubble',\{idAttr:'data-jump'/.test(html));
t.ok("왼쪽은 '새로 담은 것'(프로젝트로 안 보낸 것)만", /var uns=inboxItems\.filter\(function\(it\)\{ return colIdOf\(it\)==='_uncat'; \}\);/.test(html));
t.ok('보드에서 미분류 열 숨김(한 항목은 한 곳에)', /\.ib2-col\[data-col="_uncat"\]\{display:none\}/.test(css));
t.ok('폰: 새로 담은 것 | 프로젝트 보드 전환', /data-ib2v="board"/.test(html) && /\.ib2\.ib2-v-board \.ib2-capture\{display:none\}/.test(css));
t.ok('폰: 입력창이 아래 탭 막대 위에', /\.ib2-board\{display:flex;flex:1;min-height:0;padding:var\(--sp-4\) var\(--gutter\) calc\(96px \+ env\(safe-area-inset-bottom\)\)/.test(css));

t.done();
