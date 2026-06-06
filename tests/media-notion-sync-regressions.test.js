'use strict';
/* Regression coverage for the user-visible sync failures:
   1. Theme Studio images/icons/stickers use return_media_sync_v1 as their
      cross-device byte transport. It must be part of DATA_KEYS and the
      SyncManager meaningful-key set, or refs arrive on another device without
      bytes.
   2. Notion diary autosave must not force pullFirst:false. The default
      syncDiaryToNotion path pulls first and merges, preventing Return from
      overwriting Notion-side edits/images during background saves. */
const { readIndex, runner } = require('./lib');

const html = readIndex();
const t = runner('Media + Notion sync regressions');

function slice(start, end) {
  const a = html.indexOf(start);
  if (a < 0) throw new Error('start marker not found: ' + start);
  const b = html.indexOf(end, a + start.length);
  if (b < 0) throw new Error('end marker not found: ' + end);
  return html.slice(a, b);
}

const dataKeysBlock = slice('var DATA_KEYS = [', '/* Firebase and Notion runtime restored */');
t.ok('return_media_sync_v1 is in DATA_KEYS', /['"]return_media_sync_v1['"]/.test(dataKeysBlock));

const syncManagerBlock = slice('var SyncManager=(function(){', 'function shouldFbSyncKey(k){');
t.ok('return_media_sync_v1 is a SyncManager meaningful key', /meaningfulKeys=\[[\s\S]*['"]return_media_sync_v1['"]/.test(syncManagerBlock));

const notionSaveBlock = slice('function queueDiaryNotionSave(dateKey){', 'function queueDiaryNotionPull(dateKey, reason, delay){');
t.ok('queueDiaryNotionSave uses default pull-first merge path', !/pullFirst\s*:\s*false/.test(notionSaveBlock));

const aiTimelineBlock = slice('async function runDiaryAiTimeline(dateKey, silent){', 'function scheduleDiaryAutoSync(){');
t.ok('runDiaryAiTimeline uses default pull-first merge path', !/pullFirst\s*:\s*false/.test(aiTimelineBlock));

t.done();
