'use strict';
/* 프로젝트 상세 '할일' 목록 칸 + Area 화면 폭.
   - 목록: 빠른 추가(날짜·시간 인식) · 남은/완료 · 날짜 묶음(밀림/오늘/내일/이번 주/나중에/날짜 없음)
     · 체크 · 공용 줄 제스처(밀기 완료/미루기 · 길게 누르기/우클릭/⋯ 메뉴)
   - 폭: 상세 여백 규칙이 없는 토큰(--sp-14)을 써서 선언 전체가 무효(여백 0)였고, 빈 상태용
     .project-empty(점선 + 10px)가 상세 화면에도 남아 그 자리를 메우던 것 → --gutter로, 최대 폭 1120 → 1680. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('프로젝트 할일 목록 · Area 폭');

const ctx = {
  Date, String, Array, Object, Number, Math, JSON,
  TK: '2026-11-10', tasks: [], saved: 0,
  dk: (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'),
  projectEsc: (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
  projectTaskItems: (p) => ctx.tasks.filter((x) => String(x.projectId || '') === String(p.id)),
  _taskDayLabel: (k) => (k === '2026-11-10' ? '오늘' : k.slice(5).replace('-', '/')),
  saveTaskData() { ctx.saved++; },
  captureParseNL: (txt) => (/내일 3시/.test(txt) ? { text: txt.replace('내일 3시 ', ''), date: '2026-11-11', timeStart: '15:00' } : { text: txt }),
};
vm.createContext(ctx);
vm.runInContext(sliceBlock(html, "var _pjtFilter='open';", 'function projectWeekTimelineHtml(project){'), ctx);

{
  const L = [{ date: '2026-11-08', text: 'a' }, { date: '2026-11-10', text: 'b' }, { date: '2026-11-11', text: 'c' }, { date: '2026-11-15', text: 'd' }, { date: '2026-11-30', text: 'e' }, { text: 'f' }];
  const bs = ctx.projectTaskBuckets(L, '2026-11-10');
  t.ok('날짜 묶음: 밀림/오늘/내일/이번 주/나중에/날짜 없음', bs.map((b) => b[1] + b[2].length).join(',') === '밀림1,오늘1,내일1,이번 주1,나중에1,날짜 없음1');
  const pr = ctx.projectTaskBuckets([{ date: '2026-11-10', text: 'x', priority: 'low' }, { date: '2026-11-10', text: 'y', priority: 'high' }, { date: '2026-11-10', text: 'z', timeStart: '09:00' }], '2026-11-10');
  t.ok('같은 날: 시간 있는 것 먼저, 그다음 우선순위', pr[0][2].map((x) => x.text).join('') === 'zyx');
}
{
  ctx.tasks = [
    { id: 1, projectId: 'p', text: '오늘 할 것', date: '2026-11-10', done: false },
    { id: 2, projectId: 'p', text: '끝낸 것', date: '2026-11-09', done: true, updatedAt: 5 },
    { id: 3, projectId: 'p', text: '<b>마감</b>', date: '2026-11-12', deadlineDate: '2026-11-11', done: false },
    { id: 4, projectId: 'q', text: '다른 프로젝트', date: '2026-11-10' },
  ];
  ctx._pjtFilter = 'open';
  const h = ctx.projectTaskListHtml({ id: 'p' });
  t.ok('남은 할일만, 이 프로젝트 것만', /오늘 할 것/.test(h) && !/끝낸 것/.test(h) && !/다른 프로젝트/.test(h));
  t.ok('남은/완료 개수', /남은 2</.test(h) && /완료 1</.test(h));
  t.ok('마감 임박 표시 + 이스케이프', /pjt-chip warn">마감 D-1/.test(h) && /&lt;b&gt;마감/.test(h));
  t.ok('줄 = 체크 · 열기 · ⋯ (공용 제스처용 data-id)', /class="pjt-row" data-id="1"><button type="button" class="pjt-ck" data-pjt-ck/.test(h) && /data-pjt-open/.test(h) && /data-pjt-more/.test(h));
  ctx._pjtFilter = 'done';
  const d = ctx.projectTaskListHtml({ id: 'p' });
  t.ok('완료 보기', /끝낸 것/.test(d) && !/오늘 할 것/.test(d));
  ctx._pjtFilter = 'open';
}
{
  ctx.tasks = []; ctx.saved = 0;
  const made = ctx.projectQuickAddTask({ id: 'p9' }, '내일 3시 자료 정리');
  t.ok('빠른 추가: 이 프로젝트 · 날짜·시간 인식 · 저장', made && made.projectId === 'p9' && made.catId === 'project' && made.date === '2026-11-11' && made.timeStart === '15:00' && made.text === '자료 정리' && ctx.saved === 1);
  const m2 = ctx.projectQuickAddTask({ id: 'p9' }, '메모만');
  t.ok('날짜 없으면 오늘', m2.date === '2026-11-10');
  t.ok('빈 입력은 무시', ctx.projectQuickAddTask({ id: 'p9' }, '   ') === null);
}

/* 배선 */
t.ok('할일 칸이 상세 맨 위(흐름 첫 칸)', /'<div class="pjd-flow">'\s*\+'<section class="section-card pjt-section" id="pjt-section">/.test(html));
t.ok('줄 제스처는 할일 탭과 같은 공용 어댑터', /rdsBindTaskGestures\(document\.getElementById\('project-detail'\),'\.pjt-row'\);/.test(html) && /@media \(pointer:coarse\)\{ \.pjt-row\{touch-action:pan-y;/.test(html));
t.ok('다른 곳에서 할일을 바꿔도 열린 프로젝트에 반영(쓰는 중이면 건너뜀)', /_pg\.classList\.contains\('pj-detail-mode'\)[\s\S]{0,400}if\(inDet&&String\(ae\.value\|\|''\)\.trim\(\)\)return;/.test(html)
  && /function _taskRefreshViews\(\)\{ try\{ if\(typeof _currentPage!=='undefined'&&_currentPage==='projects'/.test(html));
t.ok('폭: 최대 1680 · 여백은 --gutter(없는 토큰 제거)', /\.project-workspace\{width:100%;max-width:1680px;/.test(html) && /\.project-studio \.project-detail-pane\{max-width:none;margin:0;padding:var\(--sp-12\) var\(--gutter\) var\(--sp-16\);/.test(html));
t.ok('상세 화면에선 빈 상태 테두리 제거', /detail\.classList\.remove\('project-empty'\);/.test(html) && /if\(!p\)\{detail\.classList\.add\('project-empty'\);/.test(html));

t.done();
