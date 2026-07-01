'use strict';
/* Task time reminders — taskNotifEventTime / taskNotifReminderHHMM: compute the
   reminder clock time for a timed task (start time or today's deadline time),
   offset by the configured lead minutes. Loads the real pure functions out of
   index.html. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'function _notifHHMMToMin(', 'var _notifShown = {};');

const sandbox = { console, String, Number, Math, parseInt };
vm.createContext(sandbox);
vm.runInContext(block, sandbox);
const { _notifHHMMToMin, _notifMinToHHMM, taskNotifEventTime, taskNotifReminderHHMM } = sandbox;

const t = runner('notif — task time reminder');
const TODAY = '2026-07-01';

// HH:MM ↔ minutes
t.ok('hhmm→min', _notifHHMMToMin('09:30') === 570, _notifHHMMToMin('09:30'));
t.ok('min→hhmm', _notifMinToHHMM(570) === '09:30', _notifMinToHHMM(570));
t.ok('min→hhmm pads', _notifMinToHHMM(65) === '01:05', _notifMinToHHMM(65));
t.ok('negative wraps to previous day', _notifMinToHHMM(-5) === '23:55', _notifMinToHHMM(-5));

// event time resolution
t.ok('timed task today → timeStart', taskNotifEventTime({ date: TODAY, timeStart: '14:00' }, TODAY) === '14:00');
t.ok('deadline today → deadlineTime', taskNotifEventTime({ deadlineDate: TODAY, deadlineTime: '18:00' }, TODAY) === '18:00');
t.ok('deadline today falls back to timeStart', taskNotifEventTime({ deadlineDate: TODAY, timeStart: '08:00' }, TODAY) === '08:00');
t.ok('done task → none', taskNotifEventTime({ date: TODAY, timeStart: '14:00', done: true }, TODAY) === '');
t.ok('no time → none', taskNotifEventTime({ date: TODAY }, TODAY) === '');
t.ok('different day → none', taskNotifEventTime({ date: '2026-07-02', timeStart: '14:00' }, TODAY) === '');

// reminder time = event − lead
t.ok('lead 0 → 정시', taskNotifReminderHHMM({ date: TODAY, timeStart: '14:00' }, TODAY, 0) === '14:00');
t.ok('lead 10 → 10분 전', taskNotifReminderHHMM({ date: TODAY, timeStart: '14:00' }, TODAY, 10) === '13:50');
t.ok('lead 30 crosses hour', taskNotifReminderHHMM({ date: TODAY, timeStart: '14:15' }, TODAY, 30) === '13:45');
t.ok('lead 60 → 1시간 전', taskNotifReminderHHMM({ date: TODAY, timeStart: '09:00' }, TODAY, 60) === '08:00');
t.ok('near-midnight lead wraps', taskNotifReminderHHMM({ date: TODAY, timeStart: '00:05' }, TODAY, 10) === '23:55');
t.ok('no time → empty reminder', taskNotifReminderHHMM({ date: TODAY }, TODAY, 10) === '');

t.done();
