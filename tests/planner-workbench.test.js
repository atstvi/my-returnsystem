'use strict';
/* 계획창 = '오늘 상황'과 같은 미처리 집합을 한곳에서 비워나가는 작업대.
   - returnUnlinkedSchedules: 오늘 상황과 계획창이 공유하는 '연결 필요' 집합.
   - returnTriageRemain: 오늘 기준 미처리 개수(인박스+마감(준비없음)+연결+시간미정+지난) 통일.
   - 트레이: 분류 5개(마감·연결·인박스·시간미정·지난) + 진행표(정리할 것 N) + 완료 ✓.
   - 할일 탭 → 빠른 처리 시트(오늘 배치/내일로 미루기/완료). 오늘 상황 → 계획창 정리 진입. */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('계획창 작업대(정리)');

// ── 공유 집합/카운트 ──
t.ok('returnUnlinkedSchedules: 일정+미연결+미완료 정의', /function returnUnlinkedSchedules\(\)\{[\s\S]*?t\.catId==='schedule' && t\.date[\s\S]*?scheduleTargetHasLinkedTask\(t,all\)[\s\S]*?scheduleTargetCompleted\(t,all\)/.test(html));
t.ok('returnTriageRemain: 5요소 합', /function returnTriageRemain\(\)\{[\s\S]*?return inbox\+dlNoPrep\+unlinked\+unsched\+overdue;/.test(html));
t.ok('두 함수 전역 노출(공유)', /window\.returnUnlinkedSchedules=returnUnlinkedSchedules;/.test(html) && /window\.returnTriageRemain=returnTriageRemain;/.test(html));

// ── 트레이 작업대 ──
t.ok('트레이가 공유 집합 사용', /var unlinked=\(typeof returnUnlinkedSchedules==='function'\)\?returnUnlinkedSchedules\(\)/.test(html));
t.ok('진행표: 정리할 것 N / 완료', /정리할 것 '\+remain\+'개/.test(html) && /오늘 정리 완료/.test(html));
t.ok('완료 판정 remain===0', /var doneAll=\(remain===0\);/.test(html) && /remain=inbox\.length\+unlinked\.length\+unsched\.length\+overdue\.length\+dlNoPrep;/.test(html));
t.ok('분류 헤더 항상+빈 곳 ✓', /function section\(icon,label,count,bodyHtml,emptyMsg\)\{[\s\S]*?count>0\?'<span class="cnt">'\+count\+'<\/span>':'<span class="cnt ok">✓<\/span>'/.test(html));
t.ok('5개 분류(마감·연결·인박스·시간미정·지난)', /section\('⏳','다가오는 마감'[\s\S]*?section\('🔗','연결 필요'[\s\S]*?section\('📥','인박스'[\s\S]*?section\('🕘','시간 미정 할일'[\s\S]*?section\('↩︎','지난 할일'/.test(html));
t.ok('연결 필요 행은 끌어서 연결 할일 생성(kind=deadline)', /section\('🔗','연결 필요',unlinked\.length,unlinked\.map\(function\(t\)\{[\s\S]*?item2\('deadline',t\.id,'🔗'[\s\S]*?연결 할일 없음 — 끌어서 만들기/.test(html));

// ── 빠른 처리 시트 ──
t.ok('할일 탭 → 빠른 처리 시트', /if\(kind==='task'\)\{ _planTaskQuick\(pid\); return; \}/.test(html));
t.ok('빠른 처리 3동작(배치/미루기/완료)', /function _planTaskQuick\(id\)\{[\s\S]*?ptq-now[\s\S]*?오늘 지금 배치[\s\S]*?ptq-tmr[\s\S]*?내일로 미루기[\s\S]*?ptq-done[\s\S]*?완료/.test(html));
t.ok('내일로 미루기: 날짜 +1', /#ptq-tmr'\)\.addEventListener\('click',function\(\)\{ var d=new Date\(_planToday\(\)\+'T00:00'\); d\.setDate\(d\.getDate\(\)\+1\);/.test(html));

// ── 오늘 상황 → 계획창 정리 진입(레이더→작업대) ──
t.ok('오늘 상황에 계획창 정리 진입', /var _triageN = \(typeof returnTriageRemain==='function'\) \? returnTriageRemain\(\) : 0;[\s\S]*?🗂️ 계획창에서 정리 ' \+ _triageN[\s\S]*?goPage\('planner'\)/.test(html));
t.ok('계획 정리 칩 스타일 sig-plan', /\.sig-plan \{ background:var\(--accent-light\)/.test(html));

t.done();
