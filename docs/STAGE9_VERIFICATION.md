# Stage 9 — Verification Harness & Flag-Flip Gate

**Purpose:** prove the per-entity sync (Stages 6a–6d) before `RETURN_SYNC_MODEL`
is flipped from `legacy` → `entity` in production. Nothing in 6d runs until that
flip, so this gate is what protects the flip.

## Layers

| Layer | What it covers | How to run |
|---|---|---|
| **CI** (`.github/workflows/ci.yml`) | syntax + merge/migration logic on every push/PR | automatic; `npm test` locally |
| **`tests/*.test.js`** | 6c dual-write/migration (mock Firestore), 6d merge matrix (§3/§7 logic) | `npm test` |
| **`returnSyncSelfTest()`** | live merge functions in the real bundle, single-device subset | browser console |
| **Two-device matrix (below)** | real Firestore, real propagation/conflict/delete | manual, two profiles |

## Automated coverage (green today)

- `node tests/syntax.test.js` — inline script parses.
- `node tests/entity-sync.test.js` — 17 checks: migration idempotent + no data
  delta; changed-only dual-write; delete→tombstone with registry `deletedAt`;
  read-back counts; deterministic `_eid`; non-synced shadows.
- `node tests/merge.test.js` — 16 checks: LWW both directions + tie→cloud;
  stale-suppressed-by-tombstone vs newer-edit-survives; delete-vs-edit by
  timestamp; cloud-only adopt + R3 suppression; diary per-date; conflict cap.

## Console helpers (run the matrix without editing code)

In the browser console on each device:

- `returnSyncModelStatus()` — current flag, dual-write, conflict count, tombstone
  count, and (async) live entity-mirror counts. Run this first on both devices.
- `returnSyncModelSet('entity')` — opt **this device** into the per-entity merge
  and reload. `returnSyncModelSet('legacy')` reverts instantly.
- `returnSyncSelfTest()` — runs the single-device logic subset against the live
  merge functions.
- `returnSyncConflicts()` — dump the conflict ring buffer (winners/losers logged
  during merges).
- `fbEntityReadAll()` — per-collection live/tombstone counts in the cloud mirror.

The code default stays `legacy`, so a device joins the new path only via the
explicit `returnSyncModelSet('entity')` call — and any device can drop back with
`returnSyncModelSet('legacy')` at any moment.

## Two-device matrix (must be green before flipping the flag)

Run with two browser profiles signed into the **same** account. On both, run
`returnSyncModelSet('entity')` (auto-reloads) to exercise the new path.

1. save survives refresh / browser restart
2. A creates task → appears on B
3. B edits task while A idle → A reflects it (no self-echo loss)
4. A and B edit the **same** task offline → reconnect → newer `updatedAt` wins,
   loser in `returnSyncConflicts()`, neither silently lost
5. A deletes task → B (stale) reconnects → task **stays deleted**
6. A deletes, B edits same entity concurrently → resolved by timestamp
7. project / inbox / routine create-edit-delete propagate
8. diary date entry edits merge per date
9. theme change still syncs (settings path unaffected)
10. media still resolves cross-device (Stage 4/5 path unaffected)
11. recurring/generated tasks: no duplicates after sync
12. offline → failed sync shows accurate status (Stage 2 health)
13. migration: legacy-only account loads, migrates, loses nothing; reverting the
    flag to `legacy` still works

## Flip procedure (only after 1–13 green)

1. Confirm `npm test` + `returnSyncSelfTest()` green and matrix 1–13 verified.
2. Flip default in `RETURN_SYNC_MODEL` (6a) from `'legacy'` to `'entity'` — a
   one-word change, instantly revertible.
3. Ship; watch `returnSyncConflicts()` and the SyncManager status in real use.
4. Only after the flag is proven solid: **Stage 6e** retires the legacy blob
   *writes* (per design §10.4, on explicit approval — the safety net stays
   until then).

## Rollback

Revert the relevant commit, or set `return_sync_model=legacy` (and, if needed,
`return_entity_dualwrite=0`). The legacy blob and all dual-written data remain
intact; the entity mirror and `meta/sync` marker are inert under `legacy`.
