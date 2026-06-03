# Stage 6 — Per-Entity Merge + Tombstones (Design)

**Status:** proposed (design review before implementation)
**Decision inputs:** target model = *per-entity docs + tombstones*; review the design *before* any code.
**Goal:** permanently fix the worst reliability symptoms — *stale overwrite*, *deleted data reappears*, *cross-device rollback* — by replacing the full-state blob mirror with per-entity records that merge by real timestamps and honor deletes.

This is the high-risk centerpiece. It is **sub-staged (6a–6e)** so each step is independently shippable, verifiable, and reversible. Nothing here is implemented yet.

---

## 1. Problem recap (root causes this stage closes)

| Ref | Root cause | Today |
|---|---|---|
| R1 | No single source of truth | localStorage canonical; Firebase is a full-keyspace blob mirror |
| R2 | Batch-level timestamps | every key in a save shares one `updatedAtMs = Date.now()`; merge can't tell which *entity* is newer |
| R3 | No tombstones | deletes = absence from blob; merge re-absorbs cloud-only keys → **deletes resurrect** |

The current cloud layout is **per-localStorage-key**, where each key (`task_items_v1`) is an *entire collection* serialized as one JSON string. "Per-entity" today really means "per-collection." We will push the granularity down to the individual item.

---

## 2. Canonical model (target)

- **Firebase Firestore = canonical cross-device truth**, stored as **per-entity documents**.
- **IndexedDB** = local durable cache + binary media (unchanged; Stages 4/5).
- **localStorage** = the app's fast in-memory mirror + tiny settings (unchanged for the app's read path).
- **Notion / Google** = integrations, not sync peers (Stages 7/8).

### 2.1 The key de-risking decision: add `_eid`, do **not** rename `id`

The blocker for per-entity sync is that entities use weak/numeric ids (`id: Date.now()`), and **the task-search modal does `Number(x.id)` lookups** (`index.html:~14600`) plus countless `String(x.id)===…` matches and `data-id` round-trips. Renaming `id` is exactly what regressed past attempts.

**We will not migrate `id`.** Instead every synced entity gains a parallel **stable entity id `_eid`**:

- backfilled non-destructively on load: `if(!e._eid) e._eid = returnNewId(type+'_')` (uses the Stage 3 primitive);
- assigned at creation for new entities;
- **`_eid` is the Firestore doc id and the merge key.** The legacy `id` stays untouched, so every existing lookup/match/`Number(id)`/`data-id` path keeps working.

This isolates the sync identity from the app's display identity — the single most important safety move in this stage.

### 2.2 Entity envelope

Each synced entity carries (added non-destructively):

```
_eid          stable id (sync identity; never reused)
updatedAt     ms; real per-entity modification time
createdAt     ms
deletedAt     ms | absent   (tombstone marker)
schemaVersion int
_rev          optional monotonic counter per device (tiebreaker)
modifiedBy    deviceId (FB_CLIENT_ID) — for conflict logging
```

`id`, and all existing domain fields, are preserved as-is.

### 2.3 Firestore layout

```
users/{uid}
  meta: { syncModel:'entity-v1', updatedAtMs, clientId, deviceCount? }

users/{uid}/entities/{collection}/items/{_eid}
  → { collection, _eid, payload:{…the entity JSON…}, updatedAt, createdAt, deletedAt?, schemaVersion, modifiedBy }

users/{uid}/settings/main            (unchanged — theme/notion/gcal config)
users/{uid}/data/{key}               (LEGACY blob/split docs — read during transition, then retired)
```

Collections in scope (ordered by pain): `tasks`, `projects`, `inbox`, `routines(habits/bundles)`, then `diary` (date-keyed; each date is an entity keyed by date), `memos`, `metrics`. **Out of scope** (stay as settings/blob): theme studio state, presets, palettes — these are single-object config, not collections, and are low-conflict.

---

## 3. Merge semantics (per entity, deterministic)

For each `_eid` seen in local and/or cloud:

```
L = local entity (or local tombstone), C = cloud entity (or cloud tombstone)

1. both present, neither deleted      → winner = max(updatedAt); equal → max(_rev) → modifiedBy tiebreak
2. one deleted (tombstone)            → the side with the greater (deletedAt vs other.updatedAt) wins:
                                         a delete only "wins" if it happened AFTER the surviving edit
3. only in cloud                      → adopt cloud (UNLESS a local tombstone says we deleted it later)
4. only local                         → push to cloud (UNLESS a cloud tombstone says it was deleted later)
```

- **No more "absorb cloud-only key" blind resurrection** (the R3 bug): a cloud-only entity is adopted *only* if no newer local tombstone exists.
- **Last-write-wins is per entity**, by real `updatedAt`, not batch time (fixes R2).
- Conflicts (both edited since last sync) are resolved by LWW and **logged** to a `__sync_conflicts` ring buffer (already have the pattern from Stage 2 health) so they are observable.

### 3.1 Where does real `updatedAt` come from?

We will **not** edit dozens of mutation sites. Instead, a **shadow-diff**:

- Keep a per-collection "last-synced shadow" (the JSON of each entity at last successful sync) in IndexedDB.
- On save, diff current array vs shadow by `_eid`. For each entity whose serialized payload changed, stamp `updatedAt = now`. Removed `_eid`s become tombstones. Added ones get `createdAt=updatedAt=now`.
- This derives correct per-entity timestamps from the existing whole-array save path with zero mutation-site churn.

---

## 4. Tombstones

- A delete stamps `deletedAt = now` and writes a tombstone doc (payload dropped, envelope kept).
- Local tombstone set persisted (`return_tombstones_v1`, itself synced) so a delete is not undone by a stale cloud copy before the tombstone propagates.
- **GC:** tombstones older than **90 days** are pruned (both local and cloud) — long enough that no live device still holds the pre-delete entity, short enough to bound growth. GC runs in the existing prune pass.

---

## 5. Transition & backward compatibility (no flag-day)

Existing users have cloud data in the **legacy blob/split-doc** format. We must not strand them.

- **Dual-read on load:** read legacy `data/{key}` blobs **and** new `entities/**`. Merge: legacy blob entities are treated as `updatedAt = legacy doc updatedAtMs`, so a newer per-entity doc wins.
- **One-time migration (guarded):** on first Stage 6 load with `syncModel != 'entity-v1'`, convert each in-scope collection's blob into per-entity docs (backfilling `_eid`), then set `meta.syncModel='entity-v1'`. Idempotent; re-runnable; never deletes legacy docs in the same pass (they're retired only after a cooldown).
- **Feature flag** `RETURN_SYNC_MODEL` (`'legacy' | 'entity'`), default starts `legacy`, flipped to `entity` only after 6c verifies migration. Lets us revert instantly without a deploy.
- **Legacy writer stays intact** until per-entity is proven in production; during overlap we **dual-write** (blob + entities) so a rollback loses nothing.

---

## 6. Sub-stages (each its own PR, draft → review → merge)

| Sub | Scope | Risk | Verify |
|---|---|---|---|
| **6a** | `_eid` backfill (non-destructive) on all in-scope collections; entity envelope helpers; shadow-diff `updatedAt` stamping. **No cloud format change.** | 🟡 low–med | `_eid` stable across reloads; existing `id`/`Number(id)`/matching untouched; diff stamps only changed entities |
| **6b** | Local tombstone registry + delete plumbing (deletes record tombstones; loads filter them). Still legacy cloud. | 🟠 med | deleted item stays gone across reload; tombstone GC works |
| **6c** | Per-entity Firestore docs + **dual-read** + guarded one-time migration; **dual-write**; `syncModel` marker. Flag still `legacy` for merge. | 🔴 high | migration idempotent; both layouts readable; no data delta after migrate |
| **6d** | Flip merge to **per-entity LWW + tombstones**; retire blob *overwrite* (keep blob dual-write a while). | 🔴 high | full two-device matrix (§7) green |
| **6e** | Retire legacy blob writes + cooldown cleanup; conflict log UI in SyncManager panel. | 🟠 med | no regression after legacy path removed |

Pause for review at **6c** and **6d** specifically (the format change and the merge flip).

---

## 7. Verification matrix (must pass before 6d merges)

Two real devices (or two browser profiles) on the same account:

1. save survives refresh / browser restart
2. A creates task → appears on B
3. B edits task while A idle → A reflects it (no self-echo loss)
4. **A and B edit the *same* task offline → reconnect → newer `updatedAt` wins, other logged, neither silently lost**
5. **A deletes task → B (stale) reconnects → task stays deleted (no resurrection)**
6. A deletes, B edits same entity concurrently → delete-vs-edit resolved by timestamp deterministically
7. project / inbox / routine create-edit-delete propagate
8. diary date entry edits merge per date
9. theme change still syncs (settings path unaffected)
10. media still resolves cross-device (Stage 4/5 path unaffected)
11. recurring/generated tasks: no duplicates after sync; generated keep source metadata
12. offline → failed sync shows accurate status (Stage 2 health)
13. migration: legacy-only account loads, migrates, loses nothing; rollback to `legacy` flag still works

Each gets a semi-automated check in the in-app diagnostics panel (Stage 9).

---

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| `_eid` backfill collides / double-assigns | UUID-based `returnNewId`; assign only-when-missing; shadow keyed by `_eid` |
| Shadow-diff mis-stamps (misses a change) | payload JSON equality; on any doubt, stamp (false-positive stamp is harmless) |
| Migration corrupts data | idempotent, never deletes legacy in same pass, dual-write, instant flag rollback |
| Merge flip loses an edit | feature flag default legacy until matrix green; conflict logging; dual-write safety net |
| Tombstone unbounded growth | 90-day GC |
| Firestore read/write volume ↑ (per-entity) | batch commits (already used); only changed entities written (shadow-diff) |
| Numeric `id` coupling | sidestepped entirely — `id` never changes; `_eid` is separate |

**Rollback at every sub-stage:** revert the sub-stage commit; flag back to `legacy`; legacy blob path and dual-written data remain intact.

---

## 9. Explicitly NOT in Stage 6

- No UI/feature changes.
- Theme/preset/palette config stays in the settings doc (not per-entity).
- Notion one-way (Stage 7) and recurring/suppression hardening (Stage 8) are separate.
- Firebase Storage for large media is out of scope (manifest handles sync media).

---

## 10. Resolved decisions (review complete)

1. **Diary granularity:** **per date** — each calendar day's entry is one synced entity; same-day concurrent edits resolve by LWW.
2. **Conflict policy:** **LWW + log everywhere** — newer `updatedAt` wins; the losing version is written to the `__sync_conflicts` buffer (recoverable/observable). No per-type "keep both" prompt for now.
3. **Tombstone retention:** **90 days**, then GC (local + cloud).
4. **Dual-write duration:** legacy blob writes are retired in 6e **only on explicit approval** — the legacy safety net stays until per-entity sync is confirmed solid in real use. No automatic cutover.
