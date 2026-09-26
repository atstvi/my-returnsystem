'use strict';
/* 할일별 '몇 분 전 알림'(notifLead) — 편집창에서 할일마다 알림 시점을 지정.
   - notifLead 숫자 → 그 분만큼 앞당겨 알림(전역 lead보다 우선).
   - notifLead 'off' → 이 할일은 알림 안 함(전역이 켜져 있어도).
   - 전역 토글이 꺼져 있어도, notifLead가 있는 할일은 알림/푸시에 포함.
   - 기본(미설정) → 전역 lead를 따르고, 전역이 꺼져 있으면 제외. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('할일별 몇 분 전 알림(notifLead)');

const block = sliceBlock(html, 'function buildTaskReminderList(', 'async function pushEnable(');
const sandbox = { console, Date, Array, Number, String, isNaN };
vm.createContext(sandbox);
vm.runInContext(block, sandbox);
const { buildTaskReminderList } = sandbox;

const now = Date.parse('2026-07-01T09:00:00');
const at = (s) => Date.parse('2026-07-01T' + s + ':00');

// ── 런타임: buildTaskReminderList per-task lead ──
// 전역 lead=10, 하지만 task는 notifLead=30 → 30분 전
var l = buildTaskReminderList([{ id: 1, text:'A', date:'2026-07-01', timeStart:'11:00', notifLead:30 }], now, 10, 48, true);
t.ok('per-task notifLead가 전역 lead보다 우선(30분 전)', l.length===1 && l[0].atMs===at('11:00')-30*60000, l[0]);

// notifLead='off' → 제외
var lo = buildTaskReminderList([{ id: 2, text:'B', date:'2026-07-01', timeStart:'11:00', notifLead:'off' }], now, 10, 48, true);
t.ok("notifLead 'off' → 알림 목록에서 제외", lo.length===0);

// 전역 off + notifLead 있는 할일만 포함
var lg = buildTaskReminderList([
  { id: 3, text:'C', date:'2026-07-01', timeStart:'11:00' },            // 기본 → 전역 off라 제외
  { id: 4, text:'D', date:'2026-07-01', timeStart:'11:30', notifLead:5 } // 자체 → 포함
], now, 10, 48, false /* globalOn=false */);
t.ok('전역 off면 notifLead 있는 것만 포함', lg.length===1 && lg[0].id==='4' && lg[0].atMs===at('11:30')-5*60000, lg.map(x=>x.id));

// 전역 on + 기본 → 전역 lead 사용(호환)
var ld = buildTaskReminderList([{ id: 5, text:'E', date:'2026-07-01', timeStart:'11:00' }], now, 10, 48, true);
t.ok('기본(미설정)은 전역 lead 사용', ld.length===1 && ld[0].atMs===at('11:00')-10*60000);
// globalOn 기본값 true(기존 호출 호환)
var lc = buildTaskReminderList([{ id: 6, text:'F', date:'2026-07-01', timeStart:'11:00' }], now, 10, 48);
t.ok('globalOn 생략 시 true(기존 4-인자 호출 호환)', lc.length===1);

// ── 소스 배선 ──
t.ok('편집창에 알림 셀렉트(modal-notif-sel)', /<select class="modal-select" id="modal-notif-sel"[\s\S]*?<option value="off">끄기<\/option>[\s\S]*?<option value="30">30분 전<\/option>/.test(html));
t.ok('저장 fields에 notifLead 읽기', /notifLead:\(document\.getElementById\('modal-notif-sel'\)\|\|\{\}\)\.value,/.test(html));
t.ok('_writeTaskFromModal: off/숫자/기본 처리', /if\(fields\.notifLead==='off'\)\{ task\.notifLead='off'; \}[\s\S]*?delete task\.notifLead;[\s\S]*?parseInt\(fields\.notifLead,10\)/.test(html));
t.ok('편집창 열 때 셀렉트 채움(_setModalNotifSel)', /function _setModalNotifSel\(nl\)\{[\s\S]*?s\.value=\(nl==='off'\)\?'off':/.test(html) && /_setModalNotifSel\(task\.notifLead\);/.test(html));
t.ok('알림 tick: off는 건너뛰고 per-task lead 사용', /if \(t\.notifLead === 'off'\) return;[\s\S]*?var _lead = _hasOwnLead \? \(Number\(t\.notifLead\) \|\| 0\) : _taskLead;/.test(html));
t.ok('푸시 동기화도 전역 off일 때 globalOn 전달', /buildTaskReminderList\(\(typeof tasks!=='undefined'&&Array\.isArray\(tasks\)\)\?tasks:\[\], Date\.now\(\), lead, 48, enabled\)/.test(html));

t.done();
