'use strict';
/* 브리핑 개인화(설정 › 브리핑 · 개인화) + 나의 패턴 통계.
   - 설정값(말투·빈 시간 기준·포함 항목·한 마디)이 판단 엔진에 실제로 반영되는지
   - 최근 28일 할일로 평소 업무량/요일 평균/시간대를 계산하고, 오늘이 평소보다 많으면 주의
   - 데이터가 부족하면(5일 미만) 섣불리 경고하지 않음, 완료 정리로 지운 날도 로그로 유지 */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('브리핑 개인화 · 나의 패턴 통계');

const prefsBlock = sliceBlock(html, "var BRIEF_PREFS_KEY='return_brief_prefs_v1';", 'window.loadBriefPrefs=loadBriefPrefs;');
const statsBlock = sliceBlock(html, "var BRIEF_STATS_KEY='brief_day_stats_v1';", 'window.returnTaskStats=returnTaskStats;');
const planBlock = sliceBlock(html, 'function _krJosa(w,a,b){', 'window.homeBriefPlan=homeBriefPlan;');

function makeCtx(){
  const ls = {}; let rendered = 0; const writes = [];
  const ctx = { Math, String, parseInt, Array, Object, JSON, Date, isNaN,
    localStorage: { getItem: k => (k in ls ? ls[k] : null) },
    setReturnStorageItem: (k, v) => { ls[k] = v; writes.push(k); return true; },
    renderHomeSituation: () => { rendered++; } };
  vm.createContext(ctx);
  vm.runInContext(prefsBlock, ctx); vm.runInContext(statsBlock, ctx); vm.runInContext(planBlock, ctx);
  return { ctx, ls, writes, rendered: () => rendered };
}
const TK = '2026-10-09', M = (h, m) => h*60 + (m||0);
function dk(n){ const d = new Date(TK+'T00:00'); d.setDate(d.getDate()-n); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }

// 1) 설정 저장/불러오기: 기본값 채움, 모르는 키는 버림, 저장은 setReturnStorageItem(동기화) + 브리핑 다시 그림
{
  const e = makeCtx();
  const p0 = e.ctx.loadBriefPrefs();
  t.ok('기본값: 다정 말투·20분·업무량 주의 켬', p0.tone === 'warm' && p0.gapMin === 20 && p0.loadWarn === true && p0.loadSensitivity === 'normal');
  e.ctx.saveBriefPrefs(Object.assign({}, p0, { tone:'coach', gapMin:40, junk:1 }));
  const raw = JSON.parse(e.ls.return_brief_prefs_v1);
  t.ok('저장은 return_ 키(기기 간 동기화)로 setReturnStorageItem 경유', e.writes[0] === 'return_brief_prefs_v1');
  t.ok('모르는 키 버림 + updatedAt', !('junk' in raw) && raw.updatedAt > 0);
  t.ok('저장 후 브리핑 다시 그림', e.rendered() === 1);
  const p1 = e.ctx.loadBriefPrefs();
  t.ok('다시 읽으면 바뀐 값 + 나머지는 기본값', p1.tone === 'coach' && p1.gapMin === 40 && p1.includeInbox === true);
}

// 2) 하루 요약: 일정·수업·이동·취소 제외, 시간대·분량 기록
{
  const e = makeCtx();
  const s = e.ctx.briefDaySummary([
    { date:TK, text:'과제', timeStart:'09:00', timeEnd:'10:30', done:true },
    { date:TK, text:'메일' },
    { date:TK, text:'회의', catId:'schedule', timeStart:'11:00' },
    { date:TK, text:'수업', _isTt:true },
    { date:TK, text:'이동', _travelOnly:true },
    { date:TK, text:'취소됨', canceled:true },
    { date:dk(1), text:'어제 것' },
  ], TK);
  t.ok('할 일만 셈(2개, 완료 1)', s.p === 2 && s.d === 1, JSON.stringify(s));
  t.ok('시간대·분량', s.h.join() === '9' && s.dh.join() === '9' && s.m === 90);
}

// 3) 통계: 평소 업무량·요일 평균·완료율·잘 끝내는 시간대, 로그(완료 정리로 지운 날)와 병합
function history(){
  const tasks = [];
  for (let i = 1; i <= 14; i++) {
    for (let j = 0; j < 3; j++) tasks.push({ date: dk(i), text:'일'+j, timeStart: j === 0 ? '09:00' : (j === 1 ? '14:00' : ''), done: j !== 1 });
  }
  return tasks;
}
{
  const e = makeCtx();
  const log = { [dk(20)]: { p:5, d:5, m:0, h:[9,9], dh:[9,9] } };
  const st = e.ctx.returnTaskStats({ tasks: history(), todayKey: TK, log });
  t.ok('활동일 15(할일 14일 + 로그 1일)', st.activeDays === 15, st.activeDays);
  t.ok('평균 계획 ≈ 3.1개', st.avgPlanned === 3.1, st.avgPlanned);
  t.ok('완료율 계산', st.completionRate === Math.round((14*2+5)/(14*3+5)*100), st.completionRate);
  t.ok('요일별 표본', st.byWeekday[new Date(dk(7)+'T00:00').getDay()].n >= 2);
  t.ok('잘 끝내는 시간대 = 9시(14시는 늘 못 함 → 제외)', st.bestHours.join() === '9', JSON.stringify(st.bestHours));
  t.ok('주로 배치하는 시간대에 9·14시', st.topHours.indexOf(9) >= 0 && st.topHours.indexOf(14) >= 0);
  t.ok('평소 첫 일 시작 9시', st.typicalStartHour === 9);
  const st2 = e.ctx.returnTaskStats({ tasks: [], todayKey: TK, log: { [dk(2)]: { p:4, d:2, m:60, h:[], dh:[] } } });
  t.ok('할일이 지워져도 로그로 통계 유지', st2.activeDays === 1 && st2.avgPlanned === 4);
}

// 4) 오늘 업무량 주의
{
  const e = makeCtx();
  const st = e.ctx.returnTaskStats({ tasks: history(), todayKey: TK });
  const wd = new Date(TK+'T00:00').getDay();
  const L = e.ctx.returnTodayLoad(st, { p:7, open:6 }, { loadWarn:true, loadSensitivity:'normal' }, wd);
  t.ok('평소(3개)보다 많은 7개 → 주의', L && L.over === true && L.baseline === 3, JSON.stringify(L));
  t.ok('요일 표본 2일 → 요일 평균 대신 전체 평균', L.label === '평소');
  t.ok('남은 일 6개 > 평소 처리량(2개) → remainingOver', L.remainingOver === true && L.capacity === 2);
  const L2 = e.ctx.returnTodayLoad(st, { p:4, open:1 }, { loadSensitivity:'normal' }, wd);
  t.ok('조금 많은 정도(4개)는 주의 안 함', L2.over === false && L2.remainingOver === false);
  const L3 = e.ctx.returnTodayLoad(st, { p:4, open:1 }, { loadSensitivity:'high' }, wd);
  const L4 = e.ctx.returnTodayLoad(st, { p:5, open:1 }, { loadSensitivity:'low' }, wd);
  t.ok('민감도: 민감은 4개에도 주의, 느슨은 5개도 안 함', L3.over === true && L4.over === false);
  t.ok('업무량 주의 끔 → null', e.ctx.returnTodayLoad(st, { p:9, open:9 }, { loadWarn:false }, wd) === null);
  const few = e.ctx.returnTaskStats({ tasks: history().filter(x => x.date >= dk(4)), todayKey: TK });
  t.ok('데이터 5일 미만 → 판단 보류', e.ctx.returnTodayLoad(few, { p:20, open:20 }, {}, wd) === null);
  // 같은 요일 표본이 3일 이상이면 그 요일 평균과 비교
  const heavy = history();
  for (const w of [7, 21, 28]) for (let j = 0; j < 8; j++) heavy.push({ date: dk(w), text:'금'+j });
  const st3 = e.ctx.returnTaskStats({ tasks: heavy, todayKey: TK });
  const L5 = e.ctx.returnTodayLoad(st3, { p:7, open:7 }, {}, wd);
  t.ok('같은 요일 평균이 높으면(바쁜 요일) 7개도 주의 안 함', L5.label === '평소 금요일' && L5.over === false, JSON.stringify(L5));
}

// 5) 오늘 요약 로그: 바뀔 때만 쓰고 120일 넘은 날은 정리, 기기 로컬 키
{
  const e = makeCtx();
  e.ls.brief_day_stats_v1 = JSON.stringify({ '2026-01-01': { p:1 } });
  t.ok('처음 기록', e.ctx.briefRecordDayStats(TK, { p:3, d:1, m:30, h:[9], dh:[] }) === true);
  t.ok('같은 값이면 다시 쓰지 않음', e.ctx.briefRecordDayStats(TK, { p:3, d:1, m:30, h:[9], dh:[] }) === false && e.writes.length === 1);
  t.ok('120일 넘은 날짜 정리', !('2026-01-01' in JSON.parse(e.ls.brief_day_stats_v1)));
  const sb = {}; vm.createContext(sb); vm.runInContext(sliceBlock(html, 'function shouldFbSyncKey(k){', 'function fbConfig(){'), sb);
  t.ok('통계 로그는 기기 로컬, 설정은 동기화', sb.shouldFbSyncKey('brief_day_stats_v1') === false && sb.shouldFbSyncKey('return_brief_prefs_v1') === true);
}

// 6) 설정이 판단 엔진에 반영
{
  const e = makeCtx();
  const base = { todayKey: TK, weekAgoKey:'2026-10-02', daysAgo: d => (new Date(TK) - new Date(d)) / 86400000 };
  const plan = (tasks, extra) => e.ctx.homeBriefPlan(Object.assign({ tasks }, base, extra || {}));
  const tk = [
    { id:1, text:'메일 답장', date:TK, timeStart:'09:00', timeEnd:'09:30' },
    { id:2, text:'세미나', catId:'schedule', date:TK, timeStart:'14:00', timeEnd:'15:00' },
  ];
  const now = M(13, 30);
  t.ok('빈 시간 30분 ≥ 기본 20분 → 놓친 일 지금', plan(tk, { nowMin: now }).now.kind === 'missed');
  t.ok('빈 시간 기준 45분이면 → 기다리기', plan(tk, { nowMin: now, prefs: { gapMin:45 } }).now.kind !== 'missed');
  const brief = plan(tk, { nowMin: now, prefs: { tone:'brief' } }).headline;
  t.ok('간결 말투: 짧은 요약', /^못 한 일 1 · 14:00 세미나까지 30분/.test(brief), brief);
  const coach = plan(tk, { nowMin: now, prefs: { tone:'coach' } }).headline;
  t.ok('코치 말투: 지시형', /밀렸어요/.test(coach) && /부터 하세요/.test(coach), coach);
  const inb = plan([], { nowMin: now, inboxNeed: [1,2,3] });
  const inbOff = plan([], { nowMin: now, inboxNeed: [1,2,3], prefs: { includeInbox:false } });
  t.ok('인박스 추천 끄기', inb.now.kind === 'inbox' && inbOff.now.kind !== 'inbox', inb.now.kind + '/' + inbOff.now.kind);
  const rt = plan([], { nowMin: now, routineDueCount: 2, prefs: { includeRoutine:false } });
  t.ok('습관 추천 끄기', rt.now.kind !== 'routine' && !rt.alts.some(a => a.kind === 'routine'));
  const rest = plan([], { nowMin: now, energyLow: true, prefs: { suggestRest:false } });
  t.ok('컨디션 낮아도 쉬기 제안 끄기', rest.now.eyebrow !== '컨디션 먼저');
  const peak = plan(tk, { nowMin: now, bestHours: [13] });
  t.ok('평소 잘 끝내는 시간대 이유에 표시', /평소 잘 끝내는 시간대예요/.test(peak.now.reason), peak.now.reason);
  const buf = plan([{ id:3, text:'면접', catId:'schedule', date:TK, timeStart:'15:00', travelMin:20 }], { nowMin: now, prefs: { leaveBuffer:10 } });
  t.ok('출발 여유(10분) → 출발 준비 시각 14:30', buf.nextLeaveMin === M(14, 30), buf.nextLeaveMin);
  const L = { over:true, today:7 };
  const withMotto = plan([], { nowMin: now, load: L, prefs: { motto:'  천천히, 하나씩  ' } });
  t.ok('업무량·한 마디 전달', withMotto.load === L && withMotto.motto === '천천히, 하나씩');
}

// 7) 배선: 설정 탭·브리핑 카드
t.ok('설정 탭 버튼·패널', /data-panel="brief"[\s\S]{0,400}브리핑 · 개인화/.test(html) && /id="panel-brief"/.test(html) && /id="brief-settings-root"/.test(html));
t.ok('탭 전환 시 설정 그림', /if\(id==='brief'\)[^;]*renderBriefSettings\(\)/.test(html) || /'brief'[^\n]{0,80}renderBriefSettings\(\)/.test(html));
t.ok('브리핑 카드에 업무량 줄·한 마디', /id="sit-load"/.test(html) && /id="sit-motto"/.test(html));
t.ok('renderHomeSituation이 설정·통계·업무량을 엔진에 전달', /prefs:\s*_bp,\s*load:\s*_load,\s*bestHours:\s*_stats\.bestHours/.test(html));
t.ok('미룰 거 고르기 → 내일로', /function _briefOpenTrim\(L\)/.test(html) && /미룰 거 고르기/.test(html));
t.done();
