'use strict';
/* 계획창 = '오늘 상황'과 같은 미처리 집합을 한곳에서 비워나가는 작업대.
   - returnUnlinkedSchedules: 오늘 상황과 계획창이 공유하는 '연결 필요' 집합.
   - returnTriageRemain: 오늘 기준 미처리 개수(인박스+연결+지난) 통일. 시간 미정 할일은
     이제 타임라인 맨 위 '종일' 줄에 칩으로 올라가므로 트레이 목록/카운트에서 제외.
   - 트레이: 분류 4개(마감·연결·인박스·지난) + 진행표(정리할 것 N) + 완료 ✓.
   - 할일 탭 → 빠른 처리 시트(오늘 배치/내일로 미루기/완료). 오늘 상황 → 계획창 정리 진입. */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('계획창 작업대(정리)');

// ── 공유 집합/카운트 ──
t.ok('returnUnlinkedSchedules: 일정+미연결+미완료 정의', /function returnUnlinkedSchedules\(\)\{[\s\S]*?t\.catId==='schedule' && t\.date[\s\S]*?scheduleTargetHasLinkedTask\(t,all\)[\s\S]*?scheduleTargetCompleted\(t,all\)/.test(html));
t.ok('returnTriageRemain: 미처리 합(마감·시간미정 제외)', /function returnTriageRemain\(\)\{[\s\S]*?return inbox\+unlinked\+overdue;/.test(html));
t.ok('두 함수 전역 노출(공유)', /window\.returnUnlinkedSchedules=returnUnlinkedSchedules;/.test(html) && /window\.returnTriageRemain=returnTriageRemain;/.test(html));

// ── 트레이 작업대 ──
t.ok('트레이가 공유 집합 사용', /var unlinked=\(typeof returnUnlinkedSchedules==='function'\)\?returnUnlinkedSchedules\(\)/.test(html));
t.ok('진행표: 정리할 것 N / 완료', /정리할 것 '\+remain\+'개/.test(html) && /오늘 정리 완료/.test(html));
t.ok('완료 판정 remain===0', /var doneAll=\(remain===0\);/.test(html) && /remain=inbox\.length\+unlinked\.length\+overdue\.length;/.test(html));
t.ok('분류 헤더 항상+빈 곳 ✓', /function section\(icon,label,count,bodyHtml,emptyMsg\)\{[\s\S]*?count>0\?'<span class="cnt">'\+count\+'<\/span>':'<span class="cnt ok">✓<\/span>'/.test(html));
t.ok('4개 분류(마감·연결·인박스·지난)', /section\('⏳','다가오는 마감'[\s\S]*?section\('🔗','연결 필요'[\s\S]*?section\('📥','인박스'[\s\S]*?section\('↩︎','지난 할일'/.test(html));
t.ok('시간 미정 트레이 섹션 제거(종일 줄로 이동)', !/section\('🕘','시간 미정 할일'/.test(html));
// 종일 할일: 탭=편집창, 길게=현재 조작창(빠른 처리), 드래그=시간 배치
t.ok('_planBindTrayDrag가 onTap/onLongPress 옵션 지원', /function _planBindTrayDrag\(item, ?opts\)\{\s*opts=opts\|\|\{\};/.test(html));
t.ok('길게 누르면 onLongPress(460ms) 발동', /if\(typeof opts\.onLongPress==='function'\)\{ lpTimer=setTimeout\(function\(\)\{ lpTimer=null; if\(!moved\)\{ lpFired=true;[\s\S]*?opts\.onLongPress\(\);[\s\S]*?\}, ?460\);/.test(html));
t.ok('탭은 onTap 우선(없으면 기존 동작)', /else if\(!moved\)\{ if\(typeof opts\.onTap==='function'\)opts\.onTap\(\); else _planOpenTrayItem\(kind,pid\); \}/.test(html));
t.ok('종일 칩: 탭→편집창, 길게→빠른 처리', /_planBindTrayDrag\(c,\{\s*onTap:function\(\)\{ if\(typeof tasksOpenModal==='function'\)tasksOpenModal\(t\); \},\s*onLongPress:function\(\)\{ if\(typeof _planTaskQuick==='function'\)_planTaskQuick\(t\.id\); \}/.test(html));
t.ok('우클릭(contextmenu)=롱프레스와 같은 조작 진입', /if\(typeof opts\.onLongPress==='function'\)\{ item\.addEventListener\('contextmenu',function\(e\)\{ e\.preventDefault\(\); opts\.onLongPress\(\); \}\); \}/.test(html));
t.ok('우클릭은 탭/드래그 로직 제외(버튼 가드)', /item\.addEventListener\('pointerdown',function\(e\)\{\s*if\(e\.button&&e\.button!==0\)return;/.test(html));
t.ok('연결 필요 행: 탭 연결 + 끌어서 시간 배치(kind=link)', /section\('🔗','연결 필요',unlinked\.length,unlinked\.map\(function\(t\)\{[\s\S]*?item2\('link',t\.id,'🔗'[\s\S]*?연결 할일 없음 — 탭해서 연결 · 끌어서 시간 배치/.test(html));

// ── 오늘 상황처럼 계획창에서도 인라인 '연결' (탭 → 이름·날짜 → homeMakeLinkedTask) ──
t.ok('link 탭은 인라인 연결 시트로', /if\(kind==='link'\)\{ _planConnectSheet\(pid\); return; \}/.test(html));
t.ok('연결 시트: 이름+날짜 입력 후 homeMakeLinkedTask', /function _planConnectSheet\(pid\)\{[\s\S]*?id="pc-name"[\s\S]*?id="pc-date"[\s\S]*?homeMakeLinkedTask\(t, ?nm, ?\{date:dt\}\)/.test(html));
t.ok('연결 시트 기본 날짜: 마감 전날(과거로는 안 감)', /function _planPrepDefDate\(t\)\{[\s\S]*?dd\.setDate\(dd\.getDate\(\)-1\);[\s\S]*?if\(prev>=TK\)return prev;/.test(html));
t.ok('연결 시트에 연결 패스 버튼(오늘 상황과 동일)', /id="pc-pass"[\s\S]*?🚫 연결 패스/.test(html));
t.ok('패스는 공유 skip 맵(homeSkipDeadlineLink) 사용', /function pass\(\)\{ if\(typeof homeSkipDeadlineLink==='function'\)homeSkipDeadlineLink\(t\); close\(\); try\{ renderPlanner\(\); \}catch\(_e\)\{\} \}/.test(html));
t.ok('연결 필요 집합이 skip 맵을 반영', /function returnUnlinkedSchedules\(\)\{[\s\S]*?!\(skipped&&skipped\[String\(t\.id\)\]\)/.test(html));
t.ok('link 드래그는 연결 준비 할일 생성(deadline과 동일 경로)', /else if\(kind==='deadline'\|\|kind==='link'\)\{/.test(html));

// ── 빠른 처리 시트 ──
t.ok('할일 탭 → 빠른 처리 시트', /if\(kind==='task'\)\{ _planTaskQuick\(pid\); return; \}/.test(html));
t.ok('빠른 처리 3동작(배치/미루기/완료)', /function _planTaskQuick\(id\)\{[\s\S]*?ptq-now[\s\S]*?오늘 지금 배치[\s\S]*?ptq-tmr[\s\S]*?내일로 미루기[\s\S]*?ptq-done[\s\S]*?완료/.test(html));
t.ok('내일로 미루기: 날짜 +1', /#ptq-tmr'\)\.addEventListener\('click',function\(\)\{ var d=new Date\(_planToday\(\)\+'T00:00'\); d\.setDate\(d\.getDate\(\)\+1\);/.test(html));

// ── 오늘 상황 → 계획창 정리 진입(레이더→작업대) ──
t.ok('오늘 상황에 계획창 정리 진입', /var _triageN = \(typeof returnTriageRemain==='function'\) \? returnTriageRemain\(\) : 0;[\s\S]*?🗂️ 계획창에서 정리 ' \+ _triageN[\s\S]*?goPage\('planner'\)/.test(html));
t.ok('계획 정리 칩 스타일 sig-plan', /\.sig-plan \{ background:var\(--accent-light\)/.test(html));

t.done();
