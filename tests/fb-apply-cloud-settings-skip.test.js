'use strict';
/* fbApplyData — skip shouldFbSyncKey-excluded keys from a stale full blob.
   Symptom: 설정 > Google Calendar > 할일/준비 캘린더 ID (gcal_cfg_v1.taskCalendarId)
   was correctly written by gcalSaveConfig and even correctly merged by
   fbApplyCloudSettings (settings/main doc), but became undefined again moments
   later — traced to fbApplyData (full blob load on login / onSnapshot) running
   right after, with a STALE blob whose data.keys still contains gcal_cfg_v1
   from before it was excluded from shouldFbSyncKey. fbApplyData wrote that
   key unconditionally via _fbWriter, clobbering the just-merged local value.

   Fix: fbApplyData's per-key write loop (and the _fbLastPushedSnapshot
   refresh loop) now skip any key shouldFbSyncKey excludes — gcal_cfg_v1,
   diary_notion_cfg, groq_api_key, etc. — mirroring the push-side filter in
   fbCollectData and the earlier fix to fbSaveNow's cloud-only-keys absorb
   loop.

   Tests:
   1. gcal_cfg_v1 in a stale data.keys blob → NOT written, local value survives
   2. diary_notion_cfg / groq_api_key in data.keys → NOT written
   3. normal sync key (task_items_v1) in data.keys → IS written (unaffected)
   4. gcal_cfg_v1 not added to _fbLastPushedSnapshot */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const shouldFbSyncKeyBlock = sliceBlock(html, 'function shouldFbSyncKey(k){', '\nfunction fbConfig(){');
const block = sliceBlock(html, 'function fbApplyData(data){', '\nfunction fbStatusTime(');

function makeSandbox(initialStore) {
  const written = Object.assign({}, initialStore || {});
  const win = {};
  const sb = {
    window: win,
    console: { error() {}, warn() {}, log() {} },
    _rawSetItem: (k, v) => { written[k] = v; },
    localStorage: {
      getItem: (k) => (k in written ? written[k] : null),
      setItem: (k, v) => { written[k] = String(v); },
      removeItem: (k) => { delete written[k]; },
    },
    _applyingFbData: false,
    _lastRemoteApplyMs: 0,
    _lastRepairSaveMs: 0,
    MEDIA_SYNC_KEY: 'return_media_sync_v1',
    _mediaSyncManifest: null,
    _fbLastPushedSnapshot: {},
    setTimeout: () => {},
    clearTimeout: () => {},
    Date,
    fbSaveAll: () => {},
  };
  vm.createContext(sb);
  vm.runInContext(shouldFbSyncKeyBlock, sb);
  vm.runInContext(block, sb);
  return { sb, written, win };
}

const t = runner('fbApplyData — skips shouldFbSyncKey-excluded keys (stale blob)');

// ── 1. gcal_cfg_v1 in stale blob must NOT clobber local taskCalendarId ──────
{
  const localGcal = JSON.stringify({ clientId: 'c1', calendarId: 'primary', taskCalendarId: 'tasks@group.calendar.google.com', autoSync: true, eventMeta: {} });
  const staleCloudGcal = JSON.stringify({ clientId: 'c1', calendarId: 'primary', taskCalendarId: '', autoSync: true, eventMeta: {} });
  const { sb, written } = makeSandbox({ gcal_cfg_v1: localGcal });
  sb.fbApplyData({
    keys: { gcal_cfg_v1: staleCloudGcal, task_items_v1: '[{"id":1}]' },
    updatedAtMs: Date.now(),
  });
  t.ok('gcal_cfg_v1 not overwritten', written.gcal_cfg_v1 === localGcal, written.gcal_cfg_v1);
}

// ── 2. diary_notion_cfg / groq_api_key in stale blob → not written ──────────
{
  const localCfg = JSON.stringify({ workerUrl: 'current' });
  const { sb, written } = makeSandbox({ diary_notion_cfg: localCfg, groq_api_key: 'current-key' });
  sb.fbApplyData({
    keys: { diary_notion_cfg: '{"workerUrl":"stale"}', groq_api_key: 'stale-key', task_items_v1: '[]' },
    updatedAtMs: Date.now(),
  });
  t.ok('diary_notion_cfg not overwritten', written.diary_notion_cfg === localCfg, written.diary_notion_cfg);
  t.ok('groq_api_key not overwritten', written.groq_api_key === 'current-key', written.groq_api_key);
}

// ── 3. normal sync key still written ────────────────────────────────────────
{
  const { sb, written } = makeSandbox({});
  sb.fbApplyData({
    keys: { gcal_cfg_v1: '{"taskCalendarId":""}', memos_v5: '[{"id":1,"text":"x"}]' },
    updatedAtMs: Date.now(),
  });
  t.ok('memos_v5 written', written.memos_v5 === '[{"id":1,"text":"x"}]', written.memos_v5);
  t.ok('gcal_cfg_v1 not written', !('gcal_cfg_v1' in written), written);
}

// ── 4. _fbLastPushedSnapshot does not absorb gcal_cfg_v1 ────────────────────
{
  const { sb } = makeSandbox({});
  sb.fbApplyData({
    keys: { gcal_cfg_v1: '{"taskCalendarId":""}', task_items_v1: '[]' },
    updatedAtMs: Date.now(),
  });
  t.ok('gcal_cfg_v1 not in _fbLastPushedSnapshot', !('gcal_cfg_v1' in sb._fbLastPushedSnapshot), sb._fbLastPushedSnapshot);
  t.ok('task_items_v1 in _fbLastPushedSnapshot', 'task_items_v1' in sb._fbLastPushedSnapshot);
}

t.done();
