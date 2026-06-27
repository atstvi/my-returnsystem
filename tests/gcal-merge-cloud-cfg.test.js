'use strict';
/* GCal config cloud-apply merge — gcalMergeCloudCfg: preserve device-local-only
   fields (client secret, OAuth tokens, event-id map) when applying the sanitized
   cloud cfg, so a locally-saved Google client secret isn't wiped on every sync.
   Regression: "구글 시크릿 키가 저장 안됨". Loads the real pure function out of
   index.html and exercises the merge in a mocked sandbox. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'function gcalMergeCloudCfg(', 'function fbCollectCloudSettings(');

const sandbox = { console, Object };
vm.createContext(sandbox);
vm.runInContext(block, sandbox);
const { gcalMergeCloudCfg } = sandbox;

const t = runner('gcal — gcalMergeCloudCfg');

// The cloud doc is sanitized (fbSanitizeGcalCfg) so it never carries the secret.
const cloud = { clientId: 'cid', calendarId: 'primary', taskCalendarId: '', autoSync: true, reminderMin: 5, eventMeta: {} };
const local = {
  clientId: 'cid', calendarId: 'primary', taskCalendarId: 'tasks@cal',
  clientSecret: 'GOCSPX-secret', _savedToken: 'tok', _savedTokenExp: 123,
  _savedRefreshToken: 'rtok', eventIds: { a: 'e1' }, deletedEvents: ['x'],
};

// 1. THE BUG: client secret survives a cloud apply
let r = gcalMergeCloudCfg(cloud, local);
t.ok('clientSecret preserved', r.clientSecret === 'GOCSPX-secret', r.clientSecret);

// 2. OAuth tokens preserved (auto-refresh keeps working)
t.ok('_savedToken preserved', r._savedToken === 'tok', r._savedToken);
t.ok('_savedTokenExp preserved', r._savedTokenExp === 123, r._savedTokenExp);
t.ok('_savedRefreshToken preserved', r._savedRefreshToken === 'rtok', r._savedRefreshToken);

// 3. Device-local event map preserved (the R6 duplicate-events hazard)
t.ok('eventIds preserved', r.eventIds && r.eventIds.a === 'e1', r.eventIds);
t.ok('deletedEvents preserved', Array.isArray(r.deletedEvents) && r.deletedEvents[0] === 'x', r.deletedEvents);

// 4. taskCalendarId: local kept when cloud is empty
t.ok('taskCalendarId from local when cloud blank', r.taskCalendarId === 'tasks@cal', r.taskCalendarId);

// 5. Cloud-provided fields come through
t.ok('cloud clientId applied', r.clientId === 'cid', r.clientId);
t.ok('cloud reminderMin applied', r.reminderMin === 5, r.reminderMin);
t.ok('cloud autoSync applied', r.autoSync === true, r.autoSync);

// 6. Cloud wins when it actually has a value for a normally-local field
r = gcalMergeCloudCfg({ taskCalendarId: 'cloud@cal', clientSecret: 'CLOUD' }, local);
t.ok('cloud taskCalendarId wins when present', r.taskCalendarId === 'cloud@cal', r.taskCalendarId);
t.ok('cloud clientSecret wins when present', r.clientSecret === 'CLOUD', r.clientSecret);

// 7. Fresh device (no local secret) → stays absent (secret is device-local by design)
r = gcalMergeCloudCfg(cloud, { clientId: 'cid' });
t.ok('no local secret → absent', r.clientSecret == null, r.clientSecret);

// 8. Null / undefined inputs are stable
r = gcalMergeCloudCfg(null, null);
t.ok('null inputs → empty object', r && typeof r === 'object' && r.clientSecret == null, r);
r = gcalMergeCloudCfg(undefined, local);
t.ok('undef cloud → local secret preserved', r.clientSecret === 'GOCSPX-secret', r.clientSecret);

// 9. Does not mutate the passed-in cloud object
const c2 = { clientId: 'z' };
gcalMergeCloudCfg(c2, local);
t.ok('cloud arg not mutated', c2.clientSecret === undefined && Object.keys(c2).length === 1, JSON.stringify(c2));

t.done();
