'use strict';
/* 매년(생일·기념일) 반복 고정.
   - repeatMatchesDate(rep,dkey): freq='yearly' 분기 (양력 월/일, 음력 월/일).
   - repeatYearlyOccurrences(rep, fromKey): 작년·올해·내년 기념일 양력 키.
   음력 매년은 해마다 양력 날짜가 바뀌어야 한다(음력→양력 재계산). */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const lunarBlock = sliceBlock(html, 'var LUNAR_INFO=[', '\nwindow.lunarToSolar=lunarToSolar;');
const matchBlock = sliceBlock(html, 'repeatMatchesDate=function(rep,dkey){', '\n/* 매년 반복은');
const yearlyBlock = sliceBlock(html, 'function repeatYearlyOccurrences(rep, fromKey){', '\nwindow.repeatYearlyOccurrences=repeatYearlyOccurrences;');

// shared date helpers used by the sliced functions
const helpers = `
function taskDateKeyLocal(x){ return /^\\d{4}-\\d{2}-\\d{2}$/.test(String(x||''))?x:''; }
function taskDateFromKey(k){ if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(String(k||'')))return null; var p=String(k).split('-'); return new Date(Number(p[0]),Number(p[1])-1,Number(p[2])); }
function taskDaysBetweenKeys(a,b){ var da=taskDateFromKey(a),db=taskDateFromKey(b); if(!da||!db)return 0; return Math.round((db-da)/86400000); }
function repeatWeekdays(rep){ return []; }
`;

const sb = { window: {}, console: { warn() {} }, Date, Math, Number, String, Array, parseInt, isNaN };
vm.createContext(sb);
vm.runInContext(lunarBlock, sb);      // lunarToSolar / solarToLunar
vm.runInContext(helpers, sb);
vm.runInContext(matchBlock, sb);      // repeatMatchesDate=function...
vm.runInContext(yearlyBlock, sb);     // repeatYearlyOccurrences

const t = runner('매년 반복 (생일·기념일)');
const matches = sb.repeatMatchesDate;
const occ = sb.repeatYearlyOccurrences;

// ── 양력 매년 ────────────────────────────────────────────────────────────────
{
  const rep = { freq: 'yearly', month: 5, monthDay: 9, startDate: '2020-01-01' };
  t.ok('양력 5/9 매치', matches(rep, '2027-05-09') === true);
  t.ok('다른 날 불일치', matches(rep, '2027-05-10') === false);
  t.ok('다른 달 불일치', matches(rep, '2027-06-09') === false);
  const ks = occ(rep, '2026-08-25');
  t.ok('occ에 내년 기념일', ks.indexOf('2027-05-09') >= 0, JSON.stringify(ks));
  t.ok('occ에 올해 기념일', ks.indexOf('2026-05-09') >= 0, JSON.stringify(ks));
}

// ── 양력 매년: month 없으면 startDate 월/일로 폴백 ───────────────────────────
{
  const rep = { freq: 'yearly', startDate: '2024-03-15' };
  t.ok('폴백 3/15 매치', matches(rep, '2026-03-15') === true);
  const ks = occ(rep, '2026-08-25');
  t.ok('폴백 occ 3/15', ks.every((k) => /-03-15$/.test(k)), JSON.stringify(ks));
}

// ── 2/29(윤일) 생일: 평년엔 발생 안 함 ──────────────────────────────────────
{
  const rep = { freq: 'yearly', month: 2, monthDay: 29, startDate: '2020-02-29' };
  const ks = occ(rep, '2025-06-01'); // 2024,2025,2026 → 2024만 윤년
  t.ok('평년 2/29 건너뜀', ks.indexOf('2025-02-29') < 0 && ks.indexOf('2026-02-29') < 0, JSON.stringify(ks));
}

// ── 음력 매년(음력 생일): 해마다 양력 날짜가 달라진다 ───────────────────────
{
  // 음력 1월 1일(설날) 매년. 각 해 설날 양력이 서로 달라야 하고, 그 날의 음력은 1.1.
  const rep = { freq: 'yearly', lunar: 1, lunarMonth: 1, lunarDay: 1 };
  const ks = occ(rep, '2026-08-25'); // 2025,2026,2027 설날
  t.ok('음력 occ 3개', ks.length === 3, JSON.stringify(ks));
  t.ok('설날 양력 해마다 다름', ks[0] !== ks[1] && ks[1] !== ks[2], JSON.stringify(ks));
  ks.forEach((k) => {
    const lu = sb.solarToLunar(sb.taskDateFromKey(k));
    t.ok(k + ' 는 음력 1.1', lu.m === 1 && lu.d === 1 && lu.leap === 0, k + ' → ' + JSON.stringify(lu));
    t.ok(k + ' matches(음력)', matches(rep, k) === true);
  });
  // 설날이 아닌 날은 불일치
  t.ok('설날 아닌 날 불일치', matches(rep, '2026-06-15') === false);
}

// 알려진 설날 양력이 포함되는지(2025-01-29, 2026-02-17, 2027-02-06)
{
  const rep = { freq: 'yearly', lunar: 1, lunarMonth: 1, lunarDay: 1 };
  const ks = occ(rep, '2026-08-25');
  t.ok('2026 설날 2026-02-17', ks.indexOf('2026-02-17') >= 0, JSON.stringify(ks));
  t.ok('2027 설날 2027-02-06', ks.indexOf('2027-02-06') >= 0, JSON.stringify(ks));
}

t.done();
