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

// 루틴
t.ok('줄 제스처: 선택 skip 선택자 지원', /if\(ad\.skip&&e\.target\.closest\(ad\.skip\)\)return;/.test(html));
t.ok('루틴 습관 줄: 길게·우클릭 = 습관 메뉴, 오른쪽 = 완료, 왼쪽 = 건너뜀', /rdsBindRowGestures\(root,'\.rt-habit',\{idAttr:'data-routine-habit', skip:'\.rt-check,\.rt-drag,\.menu-pop'/.test(html)
  && /right:function\(o\)\{ rtSetHabitState\(o\.id,'done'\); \}/.test(html) && /left:function\(o\)\{ rtSetHabitState\(o\.id,'skip'\); \}/.test(html));
t.ok('습관 메뉴: 상태 4개 + 강도 + 편집·순서·보관', /function rtHabitActionMenu\(id, at\)\{/.test(html) && /label:'선택 안 함',onClick:function\(\)\{ rtSetHabitState\(id,'clear'\); \}/.test(html)
  && /label:'위로 한 칸'/.test(html) && /archiveRoutineHabit\(id\);/.test(html));
t.ok('마우스: 습관 줄 ⋯ = 같은 메뉴(손가락에선 숨김)', /data-routine-more aria-label="습관 메뉴"/.test(html) && /rtHabitActionMenu\(btn\.closest\('\[data-routine-habit\]'\)\.getAttribute\('data-routine-habit'\),\{x:r\.left,y:r\.bottom\+4\}\)/.test(html) && /@media \(pointer:coarse\)\{ \.rt-more\{display:none\} \}/.test(css));
t.ok('상태 변경은 완료 잠금 경유', /function rtSetHabitState\(id,next\)\{[^\n]*rtApplyCompletionLock\(id,l\[id\],ns\);/.test(html));
t.ok('강도 슬라이더 트랙이 카드 위에서 보임', /\.stm-track\{background:color-mix\(in srgb,var\(--fg\) 10%,transparent\)\}/.test(css));
t.ok('완료 칸 길게 누른 뒤 손 뗄 때 클릭이 시트 항목을 누르지 않음', /btn\.addEventListener\('pointerup',function\(\)\{ if\(longFired\)_rdsSuppressUntil=Date\.now\(\)\+600; \}\);/.test(html));
t.ok('손가락: 완료 칸 44px 터치 영역', /\.rt-check::before\{content:"";position:absolute;left:50%;top:50%;width:44px;height:44px;/.test(css));

// Area(프로젝트)
t.ok('줄 제스처: 밀기는 어댑터에 그 동작이 있을 때만', /&&\(dx>0\?!!ad\.right:!!ad\.left\)\)\{/.test(html));
t.ok('프로젝트 카드: 길게·우클릭 = 프로젝트 메뉴(밀기 없음)', /rdsBindRowGestures\(host,'\.pj-folder\[data-open\]',\{idAttr:'data-open', skip:'\[data-pj-more\]',[\s\S]{0,200}menu:function\(pr,at\)\{ projectActionMenu\(pr,at,true\); \}\}\);/.test(html));
t.ok('프로젝트 메뉴: 할일·메모·로그 + 열기·편집·상태·Area·보관·삭제', /function projectActionMenu\(p, at, fromCard\)\{/.test(html) && /label:'파일로 보관하고 비우기'/.test(html) && /deleteProjectSafely\(p\); \}\}\);/.test(html));
t.ok('상세 머리: ⋯ + 담기(편집·보관·삭제 버튼 줄임)', /id="project-more"/.test(html) && /projectCaptureMenu\(p,\{x:r\.left,y:r\.bottom\+4\}\)/.test(html) && html.indexOf('<div class="pjd-actions"><button class="btn btn-ghost pjd-icon-btn" id="project-delete"')<0);
t.ok('담기 하나로: 할일 · 메모 · 작업 로그', /function projectCaptureMenu\(p, at\)\{/.test(html) && /bind\('project-inbox-add',function\(\)\{ projectQuickInbox\(p\); \}\);/.test(html));
t.ok('새 프로젝트 타일은 비었을 때만(머리 버튼과 중복 제거)', /var _newTile=vis\.length\?'':_pjNewFolderBtn;/.test(html));
t.ok('카드는 프로젝트 아이콘 · 진행 중 칩 생략', /p\.icon\?'<span class="pj-fic-emoji">'/.test(html) && /projectStageOf\(p\)!=='inprogress'/.test(html));
t.ok('폰: 카드 → 한 줄 목록, 상세 머리 줄바꿈', /\.pj-folder\{display:grid;grid-template-columns:40px minmax\(0,1fr\) auto;/.test(css) && /\.pjd-actions\{flex:1 1 100%;justify-content:flex-end\}/.test(css));

// 시간표
t.ok('학기 목록은 위쪽 한 줄 칩(모든 크기)', /\.tt-left\{grid-column:1\/-1;grid-row:1;width:auto;flex-direction:row;/.test(css) && /\.tt-left \.tt-sem-list\{display:flex;flex-direction:row;/.test(css));
t.ok('데스크톱: 표 | 과목 목록, 태블릿·폰: 위아래 + 페이지 한 번에 스크롤', /\.tt-page\{display:grid;grid-template-columns:minmax\(0,1fr\) 280px;/.test(css) && /#page-schedule\{overflow-y:auto;/.test(css) && /\.tt-page\{flex:1 1 auto;align-self:flex-start;/.test(css));
t.ok('머리: 학기 이름·기간 + ＋ 수업 + ⋯(편집·할일 생성·삭제)', /id="tt-add-slot" onclick="ttAddSlot\(\)"/.test(html) && /function ttMenu\(at\)\{/.test(html) && /label:'할일 생성 \(수업 일정을 할일로\)'/.test(html) && !/onclick="saveTt\(\)"/.test(html));
t.ok('학기 이름·기간 입력값은 숨겨 두고 saveTt가 그대로 읽음', /<div class="tt-meta-inputs" hidden>/.test(html) && /function ttEditMeta\(\)\{[\s\S]{0,700}saveTt\(\);/.test(html));
t.ok('항상 보이던 빠른 추가 폼 숨김(＋ 수업과 중복)', /\.tt-slot-panel \.qa-form\{display:none\}/.test(css));
t.ok('폰: 하루 보기(요일 칩 + 그날 수업) 기본, 주간 전환은 기기별', /var _ttView=\(function\(\)\{ try\{ return localStorage\.getItem\('tt_view_v1'\)==='week'\?'week':'day';/.test(html) && /\.tt-v-day \.tt-dayview\{display:block\}/.test(css));
t.ok('수업 줄·표 블록·과목 줄: 길게·우클릭 = 같은 수업 메뉴', /rdsBindRowGestures\(document\.getElementById\('tt-grid-container'\),'\.tt-dv-row,\.tt-block',TT_ROW\);/.test(html) && /rdsBindRowGestures\(document\.getElementById\('tt-slot-list'\),'\.session-row'/.test(html) && /block\.setAttribute\('data-slot-idx', si\);/.test(html));
t.ok('표 머리 날짜 9px → 토큰', /<span class="tt-dh-date">/.test(html) && html.indexOf("font-size:9px;opacity:.6\">' + colDate")<0);
t.ok('renderGrid 끝에서 하루 보기도 갱신', /try\{ ttRenderDayView\(tt\); \}catch\(_e\)\{\}\n\}/.test(html));

// 취미
t.ok('취미 항목: 길게·우클릭 = 메뉴, 오른쪽 = 완료, 왼쪽 = 다음 날로', /rdsBindRowGestures\(document\.getElementById\('hob-items-list'\),'\.hob-item',\{idAttr:'data-id', skip:'\.hob-check,\.hob-item-media',/.test(html) && /left:function\(it\)\{ hobMoveDate\(it,hobNextDayKey\(it\)\); \}/.test(html));
t.ok('언젠가 칩: 길게·우클릭 = 같은 메뉴(끌기 없이 날짜 정하기)', /rdsBindRowGestures\(document\.getElementById\('hob-someday-list'\),'\.hob-someday-chip',ROW\);/.test(html) && /function hobPickDate\(it\)\{/.test(html));
t.ok('메뉴: 완료·다음 날로·날짜 + 오늘로·언젠가로·편집·삭제', /function hobItemMenu\(it, at\)\{/.test(html) && /label:'언젠가로 \(날짜 비우기\)'/.test(html) && /function hobDeleteOne\(it\)\{/.test(html));
t.ok('손가락에선 HTML 끌기 끔(길게 누르기와 충돌 방지)', (html.match(/setAttribute\('draggable',\(typeof rdsIsTouch==='function'&&rdsIsTouch\(\)\)\?'false':'true'\)/g)||[]).length===2);
t.ok('옮기기·완료는 updatedAt 갱신 후 saveItemsData', /function hobMoveDate\(it, dk\)\{\s*if\(!it\)return; it\.date=dk\|\|''; it\.updatedAt=Date\.now\(\); saveItemsData\(items\);/.test(html));
t.ok('완료 동그라미 44px 터치 영역', /\.hob-check::before\{content:"";position:absolute;left:50%;top:50%;width:44px;height:44px;/.test(css));
t.ok('배너 버튼: 이모지 → 선 아이콘', html.indexOf('id="btn-banner">🖼</button>')<0 && /id="btn-banner"><svg/.test(html));

t.done();
