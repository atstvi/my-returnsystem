'use strict';
/* 기록(루틴·일기)의 '오늘' 경계 — 자정이 아니라 새벽 RETURN_DAY_CUTOFF_HOURS시(4시).
   그 시각 전까지는 전날을 '오늘'로 본다(밤샘 기록이 자정 넘자마자 다음날로 안 넘어가게).
   returnLogicalDayKey(nowMs)를 index.html에서 떼어와 시각별로 고정한다. 로컬 타임존과
   무관하도록 nowMs를 로컬 Date로 만들어 넣고(헬퍼도 로컬 getter 사용) 확인한다. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'var RETURN_DAY_CUTOFF_HOURS = 4;', '\n/* Whether hardcoded');

const sb = { Date };
vm.createContext(sb);
vm.runInContext(block, sb);

const t = runner('logical-day cutoff (기록 오늘 경계)');

function at(y, m, d, hh, mm) { return new Date(y, m - 1, d, hh, mm, 0, 0).getTime(); }

t.ok('cutoff constant = 4h', sb.RETURN_DAY_CUTOFF_HOURS === 4, sb.RETURN_DAY_CUTOFF_HOURS);
t.ok('02:00 → 전날', sb.returnLogicalDayKey(at(2026,8,13,2,0)) === '2026-08-12', sb.returnLogicalDayKey(at(2026,8,13,2,0)));
t.ok('03:59 → 전날', sb.returnLogicalDayKey(at(2026,8,13,3,59)) === '2026-08-12', sb.returnLogicalDayKey(at(2026,8,13,3,59)));
t.ok('04:00 → 당일', sb.returnLogicalDayKey(at(2026,8,13,4,0)) === '2026-08-13', sb.returnLogicalDayKey(at(2026,8,13,4,0)));
t.ok('05:00 → 당일', sb.returnLogicalDayKey(at(2026,8,13,5,0)) === '2026-08-13', sb.returnLogicalDayKey(at(2026,8,13,5,0)));
t.ok('23:00 → 당일', sb.returnLogicalDayKey(at(2026,8,13,23,0)) === '2026-08-13', sb.returnLogicalDayKey(at(2026,8,13,23,0)));
t.ok('00:00 자정 직후 → 전날', sb.returnLogicalDayKey(at(2026,8,13,0,0)) === '2026-08-12', sb.returnLogicalDayKey(at(2026,8,13,0,0)));
/* 월 경계: 9/1 02:00 → 8/31 */
t.ok('월 경계 09-01 02:00 → 08-31', sb.returnLogicalDayKey(at(2026,9,1,2,0)) === '2026-08-31', sb.returnLogicalDayKey(at(2026,9,1,2,0)));
/* 정오는 당연히 당일 */
t.ok('정오 → 당일', sb.returnLogicalDayKey(at(2026,8,13,12,0)) === '2026-08-13', sb.returnLogicalDayKey(at(2026,8,13,12,0)));

t.done();
