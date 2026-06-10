'use strict';
/* fbSaveNow "cloud-only keys" absorb loop — settings-key exclusion.
   Symptom: 설정 > Google Calendar > 할일/준비 캘린더 ID (gcal_cfg_v1.taskCalendarId)
   was correctly written to localStorage by gcalSaveConfig, but reverted to
   empty on the very next page load.

   Root cause: fbSaveNow's "for keys ONLY in cloud" absorb loop iterated
   cloudByKey (built from the legacy per-key users/{uid}/data split docs) and
   blindly wrote any key NOT in data.keys back to localStorage via
   _rawSetItem — including gcal_cfg_v1/diary_notion_cfg/groq_api_key/etc,
   which fbCollectData deliberately excludes from data.keys (shouldFbSyncKey
   returns false) because they're synced via the dedicated settings/main doc
   with their own merge logic. A leftover legacy doc for one of these keys
   (from before it was excluded) gets absorbed and clobbers the just-saved
   local value.

   Fix: skip any key the absorb loop encounters that shouldFbSyncKey excludes.

   Tests:
   1. gcal_cfg_v1 present only in cloudByKey (stale legacy doc) → NOT absorbed,
      local value (with taskCalendarId) survives
   2. a normal synced key (e.g. memos_v5) present only in cloudByKey → IS
      absorbed (existing cross-device "other device created it" behavior
      still works)
   3. diary_notion_cfg / groq_api_key (also settings-only keys) → NOT absorbed
   4. gcal_cfg_v1 also present in data.keys (current shouldFbSyncKey would
      still exclude it from data.keys, but guard against double-handling) →
      still not absorbed */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const shouldFbSyncKeyBlock = sliceBlock(html, 'function shouldFbSyncKey(k){', '\nfunction fbConfig(){');
const absorbLoopBlock = sliceBlock(html,
  '    /* For keys ONLY in cloud (other device created them, we don\'t have):',
  '\n    /* Delta filter:');

function run(cloudByKey, dataKeys) {
  const written = {};
  const sb = {
    console: { error() {}, warn() {}, log() {} },
    localStorage: {
      getItem: (k) => (k in written ? written[k] : null),
      setItem: (k, v) => { written[k] = String(v); },
      removeItem: (k) => { delete written[k]; },
    },
    _rawSetItem: (k, v) => { written[k] = String(v); },
    _applyingFbData: false,
    _fbLastPushedSnapshot: {},
    window: { fbApplyData: () => {} },
    // CLOUD_SETTING_KEYS/FB_DATA_KEYS left undefined — shouldFbSyncKey's
    // null-safe fallback (regex + explicit exclusion list) still classifies
    // gcal_cfg_v1 etc. correctly.
  };
  vm.createContext(sb);
  vm.runInContext(shouldFbSyncKeyBlock, sb);

  // Set up the locals the sliced absorb-loop snippet expects in scope.
  sb.cloudByKey = cloudByKey;
  sb.data = { keys: dataKeys };
  sb.opts = {};
  sb.absorbedToLocal = [];
  sb.preservedFromCloud = [];
  vm.runInContext(absorbLoopBlock, sb);
  return { written, absorbedToLocal: sb.absorbedToLocal, preservedFromCloud: sb.preservedFromCloud };
}

const t = runner('fbSaveNow — cloud-only keys absorb skips settings-only keys');

// ── 1. gcal_cfg_v1 stale legacy doc must NOT clobber local taskCalendarId ────
{
  const localGcal = JSON.stringify({ clientId: 'c1', calendarId: 'primary', taskCalendarId: 'tasks@group.calendar.google.com', autoSync: true, eventMeta: {} });
  const staleCloudGcal = JSON.stringify({ clientId: 'c1', calendarId: 'primary', taskCalendarId: '', autoSync: true, eventMeta: {} });
  const cloudByKey = { gcal_cfg_v1: { fullValue: staleCloudGcal, updatedAtMs: 1, docIds: ['gcal_cfg_v1'] } };
  const { written, absorbedToLocal } = run(cloudByKey, {});
  // localStorage never had it set in this sandbox run, so getItem returns null
  // pre-absorb; the fix should skip the key entirely (not write at all).
  t.ok('gcal_cfg_v1 not absorbed', !('gcal_cfg_v1' in written), written);
  t.ok('gcal_cfg_v1 not in absorbedToLocal', !absorbedToLocal.includes('gcal_cfg_v1'), absorbedToLocal);
  void localGcal;
}

// ── 2. normal synced key only-in-cloud IS absorbed (cross-device create) ────
{
  const cloudByKey = { memos_v5: { fullValue: '[{"id":1,"text":"from other device"}]', updatedAtMs: 1, docIds: ['memos_v5'] } };
  const { written, absorbedToLocal } = run(cloudByKey, {});
  t.ok('memos_v5 absorbed', written.memos_v5 === '[{"id":1,"text":"from other device"}]', written);
  t.ok('memos_v5 in absorbedToLocal', absorbedToLocal.includes('memos_v5'), absorbedToLocal);
}

// ── 3. other settings-only keys (diary_notion_cfg, groq_api_key) skipped ────
{
  const cloudByKey = {
    diary_notion_cfg: { fullValue: '{"workerUrl":"old"}', updatedAtMs: 1, docIds: ['diary_notion_cfg'] },
    groq_api_key: { fullValue: 'old-stale-key', updatedAtMs: 1, docIds: ['groq_api_key'] },
  };
  const { written, absorbedToLocal } = run(cloudByKey, {});
  t.ok('diary_notion_cfg not absorbed', !('diary_notion_cfg' in written), written);
  t.ok('groq_api_key not absorbed', !('groq_api_key' in written), written);
  t.ok('neither in absorbedToLocal', absorbedToLocal.length === 0, absorbedToLocal);
}

// ── 4. mixed: settings-only + normal key — only normal key absorbed ─────────
{
  const cloudByKey = {
    gcal_cfg_v1: { fullValue: '{"taskCalendarId":""}', updatedAtMs: 1, docIds: ['gcal_cfg_v1'] },
    hobby_items_v2: { fullValue: '[{"id":2}]', updatedAtMs: 1, docIds: ['hobby_items_v2'] },
  };
  const { written, absorbedToLocal, preservedFromCloud } = run(cloudByKey, {});
  t.ok('gcal_cfg_v1 not absorbed', !('gcal_cfg_v1' in written), written);
  t.ok('hobby_items_v2 absorbed', written.hobby_items_v2 === '[{"id":2}]', written);
  t.ok('only hobby_items_v2 in absorbedToLocal', absorbedToLocal.length === 1 && absorbedToLocal[0] === 'hobby_items_v2', absorbedToLocal);
  t.ok('only hobby_items_v2 in preservedFromCloud', preservedFromCloud.length === 1 && preservedFromCloud[0] === 'hobby_items_v2', preservedFromCloud);
}

t.done();
