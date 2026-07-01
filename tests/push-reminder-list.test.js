'use strict';
/* Web Push reminder list — buildTaskReminderList: the client computes the list of
   upcoming timed-task reminders (epoch ms = event time − lead) that it POSTs to the
   push worker. Loads the real pure function out of index.html. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'function buildTaskReminderList(', 'async function pushEnable(');

const sandbox = { console, Date, Array, Number, String, isNaN };
vm.createContext(sandbox);
vm.runInContext(block, sandbox);
const { buildTaskReminderList } = sandbox;

const t = runner('push — buildTaskReminderList');

const now = Date.parse('2026-07-01T09:00:00');
const at = (s) => Date.parse('2026-07-01T' + s + ':00');
const LEAD = 10;

const tasks = [
  { id: 1, text: '회의', date: '2026-07-01', timeStart: '11:00' },              // +2h → in
  { id: 2, text: '지난것', date: '2026-07-01', timeStart: '08:00' },            // past → out
  { id: 3, text: '마감', deadlineDate: '2026-07-02', deadlineTime: '09:00' },   // tomorrow → in
  { id: 4, text: '먼미래', date: '2026-07-05', timeStart: '09:00' },            // >48h → out
  { id: 5, text: '완료됨', date: '2026-07-01', timeStart: '12:00', done: true },// done → out
  { id: 6, text: '시간없음', date: '2026-07-01' },                              // no time → out
];

const list = buildTaskReminderList(tasks, now, LEAD, 48);

t.ok('only upcoming timed tasks included', list.length === 2, list.map((x) => x.id));
t.ok('sorted by atMs (today then tomorrow)', list[0].id === '1' && list[1].id === '3', list.map((x) => x.id));
t.ok('atMs = event − lead', list[0].atMs === at('11:00') - LEAD * 60000, list[0].atMs);
t.ok('carries title + evTime', list[0].title === '회의' && list[0].evTime === '11:00', list[0]);
t.ok('deadline task uses deadlineTime', list[1].evTime === '09:00', list[1]);

// lead 0 → exactly at event time
const l0 = buildTaskReminderList([{ id: 9, date: '2026-07-01', timeStart: '11:00' }], now, 0, 48);
t.ok('lead 0 → at event time', l0.length === 1 && l0[0].atMs === at('11:00'), l0[0]);

// done / no-time / non-array
t.ok('empty when nothing timed', buildTaskReminderList([{ id: 1, date: '2026-07-01' }], now, 0, 48).length === 0);
t.ok('non-array safe', buildTaskReminderList(null, now, 0, 48).length === 0);

t.done();
