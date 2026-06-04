/* Entity mirror cleanup — delete orphaned memo entity docs.
 *
 * Run in the browser console while logged in (fbDb and fbUser must be set).
 * Set DRY_RUN = false only after confirming the dry-run counts look right
 * (~9050 deletions, ~36 kept).
 *
 * Usage:
 *   1. Copy/paste the entire script into the browser console.
 *   2. Run: await entityMirrorCleanup()          // dry-run
 *   3. Run: await entityMirrorCleanup(false)      // live deletion
 */
(function(win){

var DRY_RUN_DEFAULT = true;

// --- Hash helpers (mirrors the inline app logic exactly) ---

var ENVELOPE_FIELDS = ['_eid','updatedAt','createdAt','deletedAt','schemaVersion','_rev','modifiedBy'];

function _taskHash(str) {
  str = String(str || '');
  var h = 0;
  for (var i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }
  return Math.abs(h).toString(36);
}

function _payloadHash(e) {
  var c = {}, k;
  for (k in e) {
    if (Object.prototype.hasOwnProperty.call(e, k) && ENVELOPE_FIELDS.indexOf(k) < 0) c[k] = e[k];
  }
  try { return _taskHash(JSON.stringify(c)); } catch(_e) { return ''; }
}

// Derives the _eid that fbEntityBuildDocs would assign to a memo item.
function deriveMemoEid(it) {
  if (it._eid) return it._eid;
  if (it.id != null && String(it.id) !== '') return 'memo_' + String(it.id);
  return 'memo_h' + _payloadHash(it);
}

// --- Expected _eid set from current memos_v5 ---

function computeExpectedEids() {
  var raw;
  try { raw = localStorage.getItem('memos_v5'); } catch(e) { return null; }
  if (!raw) return null;
  var memos;
  try { memos = JSON.parse(raw); } catch(e) { return null; }
  if (!Array.isArray(memos)) return null;

  var expected = {};
  var dedup = {};
  for (var i = 0; i < memos.length; i++) {
    var it = memos[i];
    if (!it || typeof it !== 'object') continue;
    var id = deriveMemoEid(it);
    if (dedup[id] != null) {
      id = id + '__dup' + (++dedup[id]);
    } else {
      dedup[id] = 0;
    }
    expected[id] = true;
  }
  return expected;
}

// --- Main cleanup function ---

win.entityMirrorCleanup = async function(dryRun) {
  if (dryRun === undefined) dryRun = DRY_RUN_DEFAULT;

  if (!win.fbDb || !win.fbUser) {
    console.error('[cleanup] fbDb/fbUser not available — are you logged in?');
    return;
  }

  var expected = computeExpectedEids();
  if (!expected) {
    console.error('[cleanup] Could not read/parse memos_v5 from localStorage');
    return;
  }
  var expectedCount = Object.keys(expected).length;
  console.log('[cleanup] Expected _eids from memos_v5:', expectedCount);
  console.log('[cleanup] Expected set:', Object.keys(expected).sort().join(', '));

  // Read all entity docs for memos
  var ref = win.fbDb.collection('users').doc(win.fbUser.uid);
  var itemsCol = ref.collection('entities').doc('memos').collection('items');

  console.log('[cleanup] Fetching all entity docs from entities/memos/items …');
  var snap;
  try { snap = await itemsCol.get(); } catch(e) {
    console.error('[cleanup] Fetch failed:', e);
    return;
  }

  var toDelete = [];
  var toKeep = [];
  snap.forEach(function(d) {
    var eid = d.id;
    if (expected[eid]) {
      toKeep.push(eid);
    } else {
      toDelete.push(d.ref);
    }
  });

  console.log('[cleanup] Total docs fetched:', snap.size);
  console.log('[cleanup] Would keep:', toKeep.length, '| Would delete:', toDelete.length);

  if (toKeep.length < expectedCount) {
    console.warn('[cleanup] WARNING: only', toKeep.length, 'of', expectedCount,
      'expected _eids found in mirror. Some legitimate docs may be missing.');
  }

  // Pattern breakdown of what will be deleted
  var uuidCount = 0, numericCount = 0, otherCount = 0;
  toDelete.forEach(function(ref) {
    var id = ref.id;
    if (/^memo_[0-9a-f]{8}-/.test(id)) uuidCount++;
    else if (/^memo_\d{13,}$/.test(id)) numericCount++;
    else otherCount++;
  });
  console.log('[cleanup] Delete breakdown — UUID-format:', uuidCount,
    '| numeric-id:', numericCount, '| other:', otherCount);

  if (dryRun) {
    console.log('[cleanup] DRY RUN — no writes. Re-run as entityMirrorCleanup(false) to execute.');
    return { dryRun: true, total: snap.size, keep: toKeep.length, delete: toDelete.length };
  }

  // Batch delete (Firestore batch limit = 500; use 400 to stay well under)
  var BATCH_SIZE = 400;
  var deleted = 0;
  for (var i = 0; i < toDelete.length; i += BATCH_SIZE) {
    var batch = win.fbDb.batch();
    var chunk = toDelete.slice(i, i + BATCH_SIZE);
    chunk.forEach(function(r) { batch.delete(r); });
    try {
      await batch.commit();
      deleted += chunk.length;
      console.log('[cleanup] Deleted batch ' + Math.floor(i/BATCH_SIZE + 1) +
        ' (' + deleted + '/' + toDelete.length + ')');
    } catch(e) {
      console.error('[cleanup] Batch delete failed at offset', i, ':', e);
      console.log('[cleanup] Progress so far: deleted', deleted, 'of', toDelete.length);
      return { error: e, deleted: deleted, remaining: toDelete.length - deleted };
    }
  }

  console.log('[cleanup] Done. Deleted:', deleted, '| Kept:', toKeep.length);
  console.log('[cleanup] Entity mirror should now have', toKeep.length, 'docs (expected', expectedCount, ').');

  // Recommend clearing write shadow so next dual-write re-syncs correctly
  console.log('[cleanup] Next step: clear __entity_wshadow_memos so the next dual-write re-syncs cleanly:');
  console.log('  localStorage.removeItem("__entity_wshadow_memos")');

  return { dryRun: false, total: snap.size, deleted: deleted, kept: toKeep.length };
};

console.log('[cleanup] Script loaded. Run: await entityMirrorCleanup()  (dry-run)');
console.log('[cleanup] Then:          await entityMirrorCleanup(false)  (live)');

})(window);
