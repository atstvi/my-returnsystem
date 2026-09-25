'use strict';
/* gcalEventFromTask — 구글 캘린더 푸시용 이벤트 시간 생성이 견고해야 한다.
   증상(콘솔 로그): 계획 취소 시 캘린더 재동기화가 여러 할일에서 400을 뱉음 —
   "The specified time range is empty"(빨래하기), "Invalid start time"(환기).
   원인:
   - 30분 기본 종료시각을 toISOString()으로 만들어 UTC(−9h)로 밀려 end<start →
     빈 시간대(400).
   - 한 자리 시각("9:00")·빈/잘못된 날짜를 그대로 dateTime에 이어붙여 400.
   수정: 시각을 HH:MM으로 정규화(불가하면 종일로), 종료는 로컬 시각으로 포맷하고
   start+30분 보장, 쓸 날짜가 없으면 null 반환(호출부가 스킵 → 잘못된 푸시 없음). */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('gcal 이벤트 시간 생성');

const block = sliceBlock(html, 'function _gcalNormTime(x){', 'async function gcalApiCal(method,path,body,calId){');
const ctx = { Date, String, Number, isNaN, _gcalCfg: {}, gcalTaskStableKey: function(){ return 'k'; } };
vm.createContext(ctx);
vm.runInContext(block, ctx);
const { gcalEventFromTask, _gcalNormTime, _gcalFmtLocal } = ctx;

// ── 시각 정규화 ──
t.ok('한 자리 시각 → 09:00', _gcalNormTime('9:00') === '09:00');
t.ok('9:0 → 09:00', _gcalNormTime('9:0') === '09:00');
t.ok('빈/잘못된 시각 → null', _gcalNormTime('') === null && _gcalNormTime('환기') === null && _gcalNormTime('25:00') === null);

// ── 로컬 포맷(UTC 변환 없음) ──
const d = new Date(2026, 8, 25, 9, 0, 0); // 2026-09-25 09:00 local
t.ok('로컬 포맷은 벽시계 그대로', _gcalFmtLocal(d) === '2026-09-25T09:00:00');

function parseLocal(s){ return new Date(s); } // dateTime 문자열은 로컬로 파싱

// ── 빈 시간대 방지: 종료 없음 → start+30분(로컬), end>start ──
let ev = gcalEventFromTask({ text:'빨래하기', date:'2026-09-25', timeStart:'09:00' }, 'k');
t.ok('종료 없으면 start+30분', ev.start.dateTime === '2026-09-25T09:00:00' && ev.end.dateTime === '2026-09-25T09:30:00');
t.ok('end > start (빈 시간대 아님)', parseLocal(ev.end.dateTime).getTime() > parseLocal(ev.start.dateTime).getTime());

// ── 종료가 시작보다 빠르면(교차/오류) start+30분으로 보정 ──
let ev2 = gcalEventFromTask({ text:'x', date:'2026-09-25', timeStart:'23:00', timeEnd:'01:00' }, 'k');
t.ok('end<=start면 30분 보정', parseLocal(ev2.end.dateTime).getTime() === parseLocal(ev2.start.dateTime).getTime()+30*60000);

// ── 한 자리 시각도 유효 이벤트 ──
let ev3 = gcalEventFromTask({ text:'환기', date:'2026-09-25', timeStart:'9:00' }, 'k');
t.ok('한 자리 시각 → 정규화된 timed 이벤트', ev3.start.dateTime === '2026-09-25T09:00:00');

// ── 잘못된 시각 → 종일 폴백 ──
let ev4 = gcalEventFromTask({ text:'환기', date:'2026-09-25', timeStart:'환기' }, 'k');
t.ok('시각 파싱 불가 → 종일(all-day)', ev4.start.date === '2026-09-25' && !ev4.start.dateTime && ev4.end.date === '2026-09-26');

// ── 쓸 날짜 없음 → null(호출부 스킵) ──
t.ok('날짜 없음 → null', gcalEventFromTask({ text:'x', timeStart:'09:00' }, 'k') === null);
t.ok('잘못된 날짜 → null', gcalEventFromTask({ text:'x', date:'oops', timeStart:'09:00' }, 'k') === null);

// ── 소스 배선: 호출부가 null이면 스킵, 410도 삭제 완료로 처리 ──
t.ok('sync 루프: ev 없으면 continue', /var ev=gcalEventFromTask\(t,taskKey\);[\s\S]*?if\(!ev\)\{ continue; \}/.test(html));
t.ok('삭제 큐: 404·410 모두 완료 처리', /_dm\.indexOf\('404'\)<0 && _dm\.indexOf\('410'\)<0\)remainingDeletes\.push\(del\);/.test(html));
t.ok('API 오류에 상태코드 포함', /throw new Error\('Google Calendar 오류 '\+res\.status\+\(_em\?': '\+_em:''\)\);/.test(html));

t.done();
