'use strict';
/* 마감 레이더 — 마감·일정 준비는 논리적으로 하나도 놓치지 않게.
   - 이번 주·다음 주 마감(반복 과제·요일 규칙 포함)과 그 준비 할일이 언제 잡혀 있는지 판정
   - 준비 없음/밀림/촉박(마감 직전)을 잡아내고, 미리 해 두는 쪽(마감 N일 전, 덜 바쁜 날)으로 제안
   - '꼭 챙길 것'은 컨디션·다른 선택과 무관하게 브리핑에 남는다
   - 인박스 ♥: 누를 때마다 +1, 많이 누른 것부터 처리 */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('마감 레이더 · 꼭 챙길 것 · 인박스 ♥');

const radarBlock = sliceBlock(html, 'var RADAR_DEADLINE_RE=', 'window.returnDeadlineRadar=returnDeadlineRadar;');
const planBlock = sliceBlock(html, 'function _krJosa(w,a,b){', 'window.homeBriefPlan=homeBriefPlan;');
const ctx = { Math, String, Object, Array, Date, isNaN, parseInt };
vm.createContext(ctx); vm.runInContext(radarBlock, ctx); vm.runInContext(planBlock, ctx);

const TK = '2026-10-09'; /* 금요일 */
const R = (tasks, extra) => ctx.returnDeadlineRadar(Object.assign({ tasks, todayKey: TK }, extra || {}));
const find = (r, title) => r.items.find(i => i.title === title);

// 1) 상태 판정
{
  const r = R([
    { id:1, text:'보고서 제출', date:'2026-10-14', deadlineDate:'2026-10-14' },                       // 준비 없음
    { id:2, text:'영어 에세이', date:'2026-10-12', deadlineDate:'2026-10-12' },
    { id:3, text:'에세이 개요', date:'2026-10-08', sourceTaskId:'2' },                                 // 밀림
    { id:4, text:'발표 자료', date:'2026-10-11', deadlineDate:'2026-10-13' },                         // 자기 자신을 미리 잡음
    { id:5, text:'세미나', catId:'schedule', date:'2026-10-16' },
    { id:6, text:'세미나 논문 읽기', date:'2026-10-16', deadlineId:'5', sourceTaskId:'5' },            // 촉박(일정 당일)
    { id:7, text:'면접', catId:'schedule', date:'2026-10-15', deadlineId:'8' },                         // 역방향 링크
    { id:8, text:'면접 예상 질문', date:'2026-10-13', done:true },                                     // → 준비 끝
    { id:9, text:'장학금 신청', date:'2026-10-07', deadlineDate:'2026-10-08' },                        // 마감 지남
    { id:10, text:'끝난 과제', date:'2026-10-01', deadlineDate:'2026-10-02', done:true },               // 지난주 완료 → 제외
    { id:12, text:'이번 주 완료', date:'2026-10-06', deadlineDate:'2026-10-07', done:true },            // 이번 주 완료 → ✓로 보임
    { id:11, text:'먼 마감', date:'2026-11-20', deadlineDate:'2026-11-20' },                           // 다음 주 이후 → 제외
  ]);
  t.ok('준비 없음', find(r,'보고서 제출').state === 'none');
  t.ok('준비 밀림(지난 날짜 미완료)', find(r,'영어 에세이').state === 'behind' && /에세이 개요/.test(find(r,'영어 에세이').msg));
  t.ok('자기 자신을 마감 전에 잡아 두면 계획됨', find(r,'발표 자료').state === 'planned' && find(r,'발표 자료').work[0].self === true);
  t.ok('준비가 일정 당일 → 촉박', find(r,'세미나').state === 'tight' && /일정 직전/.test(find(r,'세미나').msg));
  t.ok('일정 쪽에서 연결한 준비(역방향)도 인식 → 준비 끝', find(r,'면접').state === 'ready');
  t.ok('마감 지남', find(r,'장학금 신청').state === 'overdue' && find(r,'장학금 신청').sev === 5);
  t.ok('지난주 완료·먼 마감은 레이더 밖', !find(r,'끝난 과제') && !find(r,'먼 마감'));
  t.ok('이번 주에 끝낸 마감은 완료로 보임(잔소리 없음)', find(r,'이번 주 완료').state === 'done' && find(r,'이번 주 완료').sev === 0);
  t.ok('준비 할일 자체는 대상이 아님', !find(r,'에세이 개요') && !find(r,'세미나 논문 읽기'));
  t.ok('이번 주/다음 주 구분(월요일 시작)', find(r,'영어 에세이').week === 'next' && find(r,'장학금 신청').week === 'this' && r.strip.length === 14 && r.strip[0].date === '2026-10-05');
  t.ok('꼭 챙길 것: 심각한 순', r.must[0].title === '장학금 신청' && r.must.some(i => i.title === '영어 에세이'));
}

// 2) 제안: 미리(마감 2일 전 근처, 덜 바쁜 날) · 늦추지 않음 · 오늘보다 앞 불가
{
  const r = R([{ id:1, text:'보고서', date:'2026-10-14', deadlineDate:'2026-10-14' }]);
  const it = find(r,'보고서');
  t.ok('마감이 날짜인 할일은 자기 자신을 미리 하기로 당김', it.fix.type === 'pullTarget' && it.alt.type === 'makePrep');
  t.ok('2일 전과 그 전날 중 이른 날(부담 같음)', it.fix.date === '2026-10-11', it.fix.date);
  const busy = R([{ id:1, text:'보고서', date:'2026-10-14', deadlineDate:'2026-10-14' },
    { id:2, text:'a', date:'2026-10-11' }, { id:3, text:'b', date:'2026-10-11' }]);
  t.ok('그 전날이 바쁘면 2일 전', find(busy,'보고서').fix.date === '2026-10-12');
  const spread = R([{ id:1, text:'과제1', date:'2026-10-14', deadlineDate:'2026-10-14' }, { id:2, text:'과제2', date:'2026-10-14', deadlineDate:'2026-10-14' }]);
  t.ok('제안끼리 같은 날로 몰리지 않음', find(spread,'과제1').fix.date !== find(spread,'과제2').fix.date);
  const soon = R([{ id:1, text:'내일 마감', date:'2026-10-10', deadlineDate:'2026-10-10' }]);
  t.ok('여유가 없으면 오늘', find(soon,'내일 마감').fix.date === TK && find(soon,'내일 마감').sev === 4);
  const today = R([{ id:1, text:'오늘 마감', date:TK, deadlineDate:TK }]);
  t.ok('오늘 마감 → 지금 하기(최우선)', find(today,'오늘 마감').fix.type === 'doNow' && find(today,'오늘 마감').sev === 5);
  const schToday = R([{ id:1, text:'오늘 회의', catId:'schedule', date:TK, timeStart:'16:00' }]).items[0];
  t.ok('오늘 일정은 일정을 옮기지 않고 준비 할일(오늘)만 제안', schToday.fix.type === 'makePrep' && schToday.fix.date === TK && schToday.sev === 3);
  const sch = R([{ id:1, text:'팀 회의', catId:'schedule', date:'2026-10-13' }]);
  t.ok('일정은 준비 할일 만들기 + 필요 없음', find(sch,'팀 회의').fix.type === 'makePrep' && find(sch,'팀 회의').alt.type === 'skip');
  const tight = R([{ id:1, text:'시험', date:'2026-10-15', deadlineDate:'2026-10-15' }, { id:2, text:'시험 공부', date:'2026-10-15', sourceTaskId:'1' }]);
  t.ok('촉박한 준비 → 당기기(준비 날짜보다 앞)', find(tight,'시험').fix.type === 'pull' && find(tight,'시험').fix.date < '2026-10-15' && find(tight,'시험').fix.tasks[0].id === 2);
}

// 3) 설정: 준비 시점·여유·꼭 챙길 범위
{
  const tk = [{ id:1, text:'보고서', date:'2026-10-16', deadlineDate:'2026-10-16' }];
  t.ok('준비는 5일 전 → 더 이르게 제안', R(tk, { prefs:{ prepLeadDays:5 } }).items[0].fix.date === '2026-10-10');
  const sameDay = [{ id:1, text:'시험', date:'2026-10-15', deadlineDate:'2026-10-15' }, { id:2, text:'시험 공부', date:'2026-10-15', sourceTaskId:'1' }];
  t.ok('여유 0(당일 OK)이면 촉박 아님', R(sameDay, { prefs:{ prepMarginDays:0 } }).items[0].state === 'planned');
  const d4 = [{ id:1, text:'보고서', date:'2026-10-13', deadlineDate:'2026-10-13' }];
  t.ok('꼭 챙길 범위 D-3: D-4는 미리 챙기면 좋은 것(2)', R(d4).items[0].sev === 2);
  t.ok('꼭 챙길 범위 D-5: D-4도 꼭 챙길 것(3)', R(d4, { prefs:{ guardDays:5 } }).items[0].sev === 3);
}

// 4) 반복 과제 · 요일 규칙
{
  const reps = [{ id:'r1', freq:'weekly', weekdays:'3', text:'화학 과제 제출' }, { id:'r2', freq:'weekly', weekdays:'3', text:'운동' }, { id:'r3', freq:'daily', text:'과제 체크' }];
  const rules = [{ id:'ru1', triggerType:'weekday', weekdays:'3', taskText:'통계 퀴즈 준비', offsetDays:2 }];
  const r = R([
    { id:1, text:'화학 과제 제출', date:'2026-10-14', _repeatId:'r1' },
    { id:2, text:'운동', date:'2026-10-14', _repeatId:'r2' },
    { id:3, text:'과제 체크', date:'2026-10-10', _repeatId:'r3' },
    { id:4, text:'통계 퀴즈 준비', date:'2026-10-12', _ruleId:'ru1', _ruleGen:true, sourceTaskId:'weekday:2026-10-14', deadlineDate:'2026-10-14' },
  ], { repeatItems: reps, rules });
  t.ok('과제류 반복 회차는 마감으로 + 반복 표시', find(r,'화학 과제 제출') && find(r,'화학 과제 제출').recur === '매주 수');
  t.ok('과제가 아닌 반복·매일 반복은 제외', !find(r,'운동') && !find(r,'과제 체크'));
  const q = find(r,'통계 퀴즈 준비');
  t.ok('요일 규칙 → 가상 마감 + 준비 날짜', q && q.virtual && q.recur === '매주 수 · 2일 전 자동' && q.state === 'planned' && q.work[0].date === '2026-10-12');
  const merged = R([
    { id:1, text:'통계 퀴즈', date:'2026-10-14', _repeatId:'r9' },
    { id:4, text:'통계 퀴즈 준비', date:'2026-10-12', _ruleId:'ru1', _ruleGen:true, sourceTaskId:'weekday:2026-10-14', deadlineDate:'2026-10-14' },
  ], { repeatItems:[{ id:'r9', freq:'weekly', weekdays:'3', text:'통계 퀴즈' }], rules });
  t.ok('같은 날 이름이 겹치는 반복 과제에 규칙 준비를 붙임(중복 줄 없음)', merged.items.length === 1 && merged.items[0].title === '통계 퀴즈' && merged.items[0].state === 'planned');
}

// 5) '필요 없음'은 잔소리만 끄고, 밀린 준비·오늘 마감은 계속 챙김
{
  const sch = [{ id:1, text:'팀 회의', catId:'schedule', date:'2026-10-10' }];
  const r = R(sch, { skipped: { '1': 1 } });
  t.ok('필요 없음 → skipped(꼭 챙길 것 아님)', r.items[0].state === 'skipped' && !r.must.length);
  const late = [{ id:1, text:'시험', date:'2026-10-13', deadlineDate:'2026-10-13' }, { id:2, text:'공부', date:'2026-10-07', sourceTaskId:'1' }];
  t.ok('밀린 준비는 필요 없음과 무관하게 챙김', R(late, { skipped: { '1': 1 } }).items[0].state === 'behind');
  const lateFar = [{ id:1, text:'먼 시험', date:'2026-10-30', deadlineDate:'2026-10-30' }, { id:2, text:'먼 시험 공부', date:'2026-10-07', sourceTaskId:'1' }];
  t.ok('다음 주 이후 마감이라도 준비가 밀렸으면 잡아냄', R(lateFar).items[0].state === 'behind');
}

// 6) 브리핑: 꼭 챙길 것은 컨디션과 무관하게 먼저
{
  const base = { todayKey: TK, weekAgoKey:'2026-10-02', daysAgo: d => (new Date(TK) - new Date(d)) / 86400000, nowMin: 14*60 };
  const r = R([{ id:1, text:'내일 마감', date:'2026-10-10', deadlineDate:'2026-10-10' }, { id:2, text:'메일', date:TK }]);
  const p = ctx.homeBriefPlan(Object.assign({ tasks: [], guard: r.must, energyLow: true }, base));
  t.ok('D-1 준비 없음(4) → 지금 할 일 1순위, 쉬기보다 먼저', p.now.kind === 'guard' && p.now.guard.title === '내일 마감' && p.now.eyebrow.indexOf('D-1') > 0, JSON.stringify(p.now));
  t.ok('컨디션 낮아도 쉬기 제안이 끼어들지 않음', !p.alts.some(a => a.eyebrow === '컨디션 먼저'));
  const r3 = R([{ id:1, text:'D3 과제', date:'2026-10-12', deadlineDate:'2026-10-12' }]);
  const p3 = ctx.homeBriefPlan(Object.assign({ tasks: [{ id:9, text:'시간 미정 할일', date:TK }], guard: r3.must }, base));
  t.ok('꼭 챙길 것(3)은 빈 시간에 시간 미정 할일보다 먼저', p3.now.kind === 'guard' && p3.alts[0].kind === 'untimed');
  const pi = ctx.homeBriefPlan(Object.assign({ tasks: [{ id:9, text:'시간 미정 할일', date:TK }], inboxNeed: [{ id:1, text:'자주 떠올린 것', likes:4 }] }, base));
  t.ok('♥ 3 이상 인박스는 바로 처리 후보(시간 미정 할일보다 먼저)', pi.now.kind === 'inbox' && pi.now.inbox.id === 1 && /♥ 4/.test(pi.now.eyebrow) && pi.now.actions.join() === 'inboxTask,inboxDone');
  const pg = ctx.homeBriefPlan(Object.assign({ tasks: [], inboxNeed: [{ id:1, text:'메모', likes:0 }] }, base));
  t.ok('♥ 없는 인박스도 개수 대신 하나를 바로 처리하게', pg.now.kind === 'inbox' && /“메모” 정리/.test(pg.now.title) && pg.now.actions[0] === 'inboxTask');
}

// 7) 인박스 ♥
{
  const ib = sliceBlock(html, 'function inboxLikeCount(i){', 'function inboxLikeButton(item, onChange){');
  const saved = [];
  const c2 = { Math, Date, Array, parseInt, saveInboxItems: () => saved.push(1) }; vm.createContext(c2); vm.runInContext(ib, c2);
  const items = [
    { id:1, text:'a', unread:true, ts:1 }, { id:2, text:'b', unread:true, ts:2, likes:3, lastLikedAt:5 },
    { id:3, text:'c', unread:true, ts:3, likes:3, lastLikedAt:9 }, { id:4, text:'d', unread:false, done:true, likes:9 },
  ];
  t.ok('♥ 많은 순 → 최근에 누른 순 → 오래된 순, 완료 제외', c2.inboxPriorityList(items).map(i => i.id).join() === '3,2,1');
  const x = { id:5, text:'e', unread:false };
  c2.inboxLike(x); c2.inboxLike(x);
  t.ok('누를 때마다 +1 · 처리 필요로 다시 올림 · 기록', x.likes === 2 && x.unread === true && x.likeTs.length === 2 && saved.length === 2);
  c2.inboxLike(x, -1);
  t.ok('−1(우클릭·길게 누르기)', x.likes === 1 && x.likeTs.length === 1);
  t.ok('♥ 필터는 ♥ 있는 미완료만', c2.inboxPriorityList(items, { liked:true }).map(i => i.id).join() === '3,2');
}

// 8) 배선
t.ok('나 탭: 꼭 챙길 것·하나씩 정리·마감 레이더 카드', /id="sit-must"/.test(html) && /id="sit-tidy"/.test(html) && /id="home-radar-card"/.test(html));
t.ok('renderHomeSituation → 레이더 계산·브리핑 guard·카드 렌더', /_radar = returnDeadlineRadar\(\{/.test(html) && /guard: _radar \? _radar\.must : \[\]/.test(html) && /renderHomeRadar\(_radar\)/.test(html));
t.ok('인박스는 ♥ 순으로 브리핑에 전달', /var inboxNeed = \(typeof inboxItems !== 'undefined'\) \? \(\(typeof inboxPriorityList==='function'\)/.test(html));
t.ok('설정: 마감 준비(준비 시점·여유·꼭 챙길 범위)', /prepLeadDays:2, prepMarginDays:1, guardDays:3/.test(html) && /sel\('prepLeadDays'/.test(html) && /sel\('prepMarginDays'/.test(html) && /sel\('guardDays'/.test(html));
t.ok('인박스 피드 ♥ 버튼 + ♥ 많은 순 필터', /metaRow\.appendChild\(inboxLikeButton\(item\)\)/.test(html) && /liked\.dataset\.filter = 'liked'/.test(html));
t.ok('인박스 2단 화면(스레드·보드)에도 ♥ + 보드는 ♥ 많은 순', /\(typeof inboxLikeHtml==='function'\?inboxLikeHtml\(it\):''\)\+'<button type="button" class="ib2-bub-more"/.test(html) && /\(_lk\(b\)-_lk\(a\)\)/.test(html) && (html.match(/if\(typeof inboxBindLikes==='function'\)inboxBindLikes\(host\)/g)||[]).length === 2);
t.ok('미리 하기로 당겨도 마감일 보존', /if\(!T\.deadlineDate\)T\.deadlineDate=it\.due;/.test(html));
t.done();
