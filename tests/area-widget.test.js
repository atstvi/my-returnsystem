'use strict';
/* 나 탭 Area 위젯(예전 프로젝트 위젯 자리) — Area는 '꾸준히 관리해야 하는 영역'.
   다음 할 일이 잡혀 있으면 '굴러가는 중', 할 일은 있는데 날짜가 없으면 '날짜 미정', 아예 없으면
   '할 일 없음' → 점검. 일부러 멈춘 영역은 '쉬는 중'(점검 안 함). + 마감 레이더의 활성 규칙 표시(⚙). */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('나 탭 Area 위젯 · 레이더 활성 규칙 표시');

const block = sliceBlock(html, 'function homeAreaHealth(o){', '\nfunction homeAreaAddTask(area){');
const ctx = { Math, String, Number, Date, Object }; vm.createContext(ctx); vm.runInContext(block, ctx);
const TK = '2026-10-09';
const areas = [
  { id:'a1', name:'건강', order:0 }, { id:'a2', name:'공부', order:1 }, { id:'a3', name:'관계', order:2 },
  { id:'a4', name:'재테크', order:3, pausedAt: 1 }, { id:'a5', name:'취미', order:4 },
];
const projects = [
  { id:'p1', areaId:'a1', status:'active' }, { id:'p2', areaId:'a2', status:'active' }, { id:'p3', areaId:'a3', status:'active' },
  { id:'p5', areaId:'a5', status:'active' }, { id:'p6', areaId:'a5', status:'archived' },
];
const tasks = [
  { id:1, projectId:'p1', date:'2026-10-10', done:false },              // 건강: 곧 할 일 → 굴러가는 중
  { id:2, projectId:'p1', date:'2026-10-07', done:true },
  { id:3, projectId:'p2', date:'', done:false },                         // 공부: 날짜 없는 할 일 → 날짜 미정
  { id:4, projectId:'p2', date:'2026-10-05', done:true },
  { id:5, projectId:'p5', date:'2026-10-07', done:false },               // 취미: 밀린 할 일 → 굴러가지만 점검
  { id:6, projectId:'p6', date:'2026-10-12', done:false },               // 보관 프로젝트 → 안 셈
  { id:7, projectId:'p1', date:'2026-10-30', done:false },
];
const H = ctx.homeAreaHealth({ areas, projects, tasks, todayKey: TK });
const by = n => H.find(h => h.area.name === n);
t.ok('곧 할 일 있음 → 굴러가는 중(점검 아님)', by('건강').state === 'active' && !by('건강').attention && by('건강').next.id === 1);
t.ok('할 일은 있는데 날짜 없음 → 날짜 미정(점검)', by('공부').state === 'unscheduled' && by('공부').attention);
t.ok('할 일 없음 → 점검', by('관계').state === 'empty' && by('관계').attention);
t.ok('일부러 쉬는 중 → 점검 안 함', by('재테크').state === 'paused' && !by('재테크').attention);
t.ok('밀린 할 일 → 굴러가지만 점검', by('취미').state === 'active' && by('취미').overdue === 1 && by('취미').attention);
t.ok('보관된 프로젝트의 할 일은 안 셈', by('취미').open === 1);
t.ok('마지막 활동은 끝낸 할일 날짜 기준(2일 전/4일 전)', by('건강').idleDays === 2 && by('공부').idleDays === 4);
t.ok('최근 7일 완료한 날 표시', by('건강').week.length === 7 && by('건강').weekDone === 1);
t.ok('정렬: 점검(할 일 없음 → 날짜 미정 → 밀림) 먼저, 쉬는 중 맨 뒤', H.map(h => h.area.name).join() === '관계,공부,취미,건강,재테크', H.map(h => h.area.name).join());

// 배선
t.ok('프로젝트 위젯 자리에 Area 위젯', /<section class="card home-projects-card home-area-card" id="home-projects-card"/.test(html) && /Area<span class="ha-badge" id="home-area-badge"/.test(html) && /var H=homeAreaHealth\(\{ areas:/.test(html));
t.ok('점검 Area: 다음 할 일 · 쉬어가기 / 쉬는 Area: 다시 시작', /data-ha="add"/.test(html) && /data-ha="pause"/.test(html) && /data-ha="resume"/.test(html));
t.ok('쉬기 상태는 Area에 저장(동기화 키 areas_v1)', /live\.pausedAt=Date\.now\(\); live\.pauseNote=/.test(html) && /if\(typeof saveAreas==='function'\)saveAreas\(\);/.test(html));
t.ok('프로젝트 탭 Area ⋯ 메뉴에도 쉬기/다시 시작', /id="aa-pause"/.test(html) && /homeAreaSetPaused\(area,!area\.pausedAt\)/.test(html));
t.ok('다음 할 일은 그 Area 프로젝트의 할일로(없으면 프로젝트 먼저)', /projectId:String\(p\.id\), date:d\.date\|\|TK/.test(html) && /openProjectEditor\(null, area\.id\)/.test(html));

// 마감 레이더: 활성 규칙(키워드) 표시
const rb = sliceBlock(html, 'var RADAR_DEADLINE_RE=', 'window.returnDeadlineRadar=returnDeadlineRadar;');
const c2 = { Math, String, Object, Array, Date, isNaN, parseInt }; vm.createContext(c2); vm.runInContext(rb, c2);
const r = c2.returnDeadlineRadar({ todayKey: TK, tasks: [
  { id:1, text:'화학 퀴즈', date:'2026-10-13', deadlineDate:'2026-10-13' },
  { id:2, text:'준비: 퀴즈', date:'2026-10-11', _ruleGen:true, _ruleId:'rk', sourceTaskId:'1', deadlineDate:'2026-10-13' },
], rules: [{ id:'rk', triggerType:'keyword', matchText:'퀴즈', taskText:'준비: 퀴즈', offsetDays:2 }] });
t.ok('키워드 활성 규칙이 만든 준비 → ⚙ 표시', r.items[0].ruleTag === '“퀴즈” → 2일 전 준비', r.items[0].ruleTag);
t.ok('레이더 줄·타임그리드 알약에 활성 규칙 표시', /class="rr-recur rule" title="활성 규칙이 자동으로 만든 준비">⚙ /.test(html) && /pill\.classList\.add\('cpill--rulegen'\)/.test(html));
t.done();
