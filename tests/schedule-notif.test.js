'use strict';
/* 시간표(수업) 슬롯 시간 알림.
   회귀 배경: 시간표 수업은 렌더 시점에 timetables_v1에서 만든 pseudo 할일(_isTt)이라
   tasks[]에 없다. 알림 스케줄러(_notifSchedulerTick)는 tasks[]만 훑어서 시간표 수업
   알림이 폰/패드/노트북 어디에서도 발송되지 않았다. tick이 오늘 요일의 시간표 슬롯을
   직접 훑어 시작(또는 lead분 전) 시각에 알림하도록 배선한다. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const t = runner('시간표 알림');

// ── 소스 배선 ──
t.ok('tick이 timetables_v1를 읽음',
  /var _ttNow = JSON\.parse\(localStorage\.getItem\('timetables_v1'\) \|\| '\[\]'\)/.test(html));
t.ok('오늘 요일(일→6, 월→0…) 계산',
  /_ttSlotDay = _ttJsDow === 0 \? 6 : _ttJsDow - 1/.test(html));
t.ok('학기 날짜 범위(startDate/endDate) 밖 슬롯 제외',
  /if \(tt\.startDate && today < tt\.startDate\) return;[\s\S]{0,80}if \(tt\.endDate && today > tt\.endDate\) return;/.test(html));
t.ok('슬롯 요일·시작시각 가드',
  /if \(!s \|\| s\.day !== _ttSlotDay \|\| !s\.timeStart\) return;/.test(html));
t.ok('lead분 전 리마인더 시각 계산',
  /var rem = _notifMinToHHMM\(_notifHHMMToMin\(s\.timeStart\) - _taskLead\);/.test(html));
t.ok('실제 할일로 이미 존재하면 중복 알림 방지',
  /_taskList\.some\(function\(t\)\{ return t && !t\._isTt && !t\.done && t\.date === today && t\.text === s\.title && t\.timeStart === s\.timeStart; \}\)/.test(html));
t.ok('슬롯별·날짜별 1회만(_notifShown 키)',
  /var key = 'tt:' \+ tt\.id \+ '\|' \+ s\.title \+ '\|' \+ s\.timeStart \+ ':' \+ today;/.test(html));
t.ok('📚 수업 알림 발송',
  /_showNotif\('📚 ' \+ \(s\.title \|\| '수업'\)/.test(html));

// ── lead 계산 로직(순수 헬퍼 재사용) 검증 ──
const helpers = sliceBlock(html, 'function _notifHHMMToMin(', '\nfunction taskNotifEventTime(');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(helpers + '\nthis._h2m=_notifHHMMToMin;this._m2h=_notifMinToHHMM;', ctx);
const rem = (ts, lead) => ctx._m2h(ctx._h2m(ts) - lead);
t.ok('정시 알림: 09:00, lead 0 → 09:00', rem('09:00', 0) === '09:00');
t.ok('10분 전: 14:30, lead 10 → 14:20', rem('14:30', 10) === '14:20');
t.ok('자정 넘김 방어: 00:05, lead 10 → 23:55', rem('00:05', 10) === '23:55');

t.done();
