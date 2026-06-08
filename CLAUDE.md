# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-file personal "return system" web app (task/diary/routine/habit tracker with theme studio,
music, stickers, banners, etc.), deployed as a static site via GitHub Pages. **Everything — markup,
CSS, and ~30k lines of JS — lives in `index.html`.** There is no build step, no bundler, no
framework. `package.json` exists only to drive the test suite.

The UI language is **Korean** (`<html lang="ko">`, title "Return"). It is a single-user personal
tool: the author uses it daily on multiple devices (phone + desktop), which is why cross-device
sync reliability is the dominant engineering concern in this repo.

### Purpose & product concept ("맥락")
"Return"(돌아오기) is a self-reflection / self-management hub built around the daily loop of
**checking in → reflecting → acting → recharging**. It is not a generic todo app; the diary and
"check-in" features are the heart of it, and most of the other modules feed into or off of them.
The recurring goal across sessions has been: *make the daily data the user pours in never get
lost, silently rolled back, or duplicated across devices* — hence the heavy storage/sync stack.

### Main features (each is a "page", switched via `goPage()` / bottom nav)
- **나 / Home** (`home`) — personal landing dashboard (banner, stickers, quick routine, status).
- **인박스 / Inbox** (`inbox`) — quick capture; items flagged `needsAction` get triaged elsewhere.
- **일기 / Diary** (`diary`) — the core. Each date is one entry with 7 fixed sections:
  `SECTIONS = ['sleep','morning','resolution','timeline','accomplishment','night','recap']`
  (수면 / 아침 감사 / 오늘의 다짐 / 타임라인 / 성취 / 저녁 감사 / 하루 회고). Diary is the
  subsystem with **bidirectional Notion sync** (see below) and inline-image support.
- **루틴 / Routine** (`routine`) — habits + bundles with daily logs and weekly achievement view.
- **할일 / Tasks** (`tasks`) — tasks with categories, recurring rules, and one-way Google Calendar
  push. Recurring/generated tasks are reconciled after sync to avoid cross-device duplicates.
- **프로젝트 / Projects** (`projects`) — project CRUD.
- **시간표 / Schedule** (`schedule`) — timetable/class slots (can generate tasks).
- **취미 / Hobby** (`hobby`) — hobby tracker with its own banner.
- **음악 / Music** (`music`) — playlists with a context-aware recommender (`musicRecommend()`
  scores playlists against time-of-day, task/inbox load, and a Study/Rest/Routine mode).
- **충전과 체크 / Recharge & Check** (`recharge`) — "check-in" (체크인): the user logs state, an
  AI reads it back ("AI 읽기"), and "recharge" (충전) activities help reset. This closes the
  reflective loop with the diary.
- **기록 / Records** (`records`) — memos/insights (깨달음·메모), metrics & trends, emotion flow,
  and the user's values (내 가치관).
- **설정 / Settings** (`settings`) — theme/appearance (Theme Studio), profile, AI · API keys,
  notifications, sync & integrations (Firebase/Notion/Google), and data management.

### External integrations
- **Firebase Auth + Firestore** — Google sign-in (`signInWithPopup`/`GoogleAuthProvider`) and
  cross-device sync of nearly all app data.
- **Notion** — bidirectional diary sync: the 7 diary sections map to Notion page properties +
  page body, with a 3-way merge (see the sync section below).
- **Google Calendar** — one-way push of tasks to calendar events.
- **AI providers** — Claude (Anthropic) / OpenAI / Gemini API keys (user-supplied, kept
  device-local) power the check-in "AI 읽기" read-backs and assistance. When adding/changing AI
  features, default to the latest Claude models.

## Commands

```bash
npm test                                # run the full suite (must pass before pushing)
node tests/syntax.test.js               # just the syntax guard
node tests/merge.test.js                # just one suite — any tests/*.test.js can run standalone
```

There is no lint/build/dev-server script. To "run" the app, open `index.html` directly in a
browser (or serve the directory statically) — there's nothing to compile.

CI (`.github/workflows/ci.yml`) runs `npm test` on every push/PR to any branch.

## Architecture

### Everything is in `index.html`
Two `<script>` blocks contain the entire application. Functions are defined at module-level scope
(no modules/imports). When searching for logic, `grep`/`Grep` directly in `index.html` — there is
no other source to check. Sections are marked with banner comments like:

```
/* ════════ STAGE 6 — PER-ENTITY MERGE + TOMBSTONES ... ════════ */
```

Search for `Stage [0-9]` to navigate the major subsystems chronologically (Stage 1 = data
registry, Stage 2 = storage health, Stage 3 = stable IDs, Stage 4/5 = media/IndexedDB, Stage 6 =
per-entity sync/merge, Stage 7 = Notion guarded merge, Stage 9 = verification harness).

### How tests load code from a single HTML file
Since there's no module system, `tests/lib.js` provides `sliceBlock(html, startMarker, endMarker)`
which extracts a self-contained function body out of `index.html` by anchoring on literal text
(usually the function signature and the next declaration), then `vm.runInContext`s it against a
mocked `window`/`localStorage`/`document` sandbox. **This means refactors that move or rename a
function will break its test loudly (marker not found) — that's intentional, not a bug to silence.**
When you change a function that has a test, check whether the test's slice markers still match.

### The storage stack (read this before touching persistence)
Three layers, in order of precedence for reads:
1. **localStorage** — canonical, synchronous, fast-path for the app's own reads/writes.
2. **IndexedDB overflow** (`_idbCache`, `return_overflow_v1`) — when localStorage quota is
   exceeded, big values transparently spill here; `_idbCache` mirrors them for synchronous reads.
3. **Firebase Firestore** — cross-device sync. Historically a full-keyspace JSON blob mirror;
   Stage 6 is migrating high-churn collections to per-entity docs with tombstones (gated by the
   `RETURN_SYNC_MODEL` flag, default `'entity'`; `'legacy'` reverts to the blob-only path).

`RETURN_DATA_MAP` (search for it, ~line 12195) is the **authoritative registry** of every
persisted domain: which layer owns it, its read/write entry points, how it syncs, and known
hazards. Run `returnDataMap()` in the browser console to dump it. **Always check this map before
making storage changes** — it documents real footguns (e.g. weak `Date.now()` ids, inline
base64 quota risk, partial sync).

**Critical rule: always write through `setReturnStorageItem(key, value)`**, never
`localStorage.setItem` directly for app data. `setReturnStorageItem` is the only path that
triggers `_afterWriteSideEffects()` (Firebase/Google Calendar/Notion sync queuing), handles
quota overflow to IndexedDB, and records storage health. Bypassing it silently breaks sync —
this has been a recurring real bug (see `tests/storage-write-sideeffects.test.js`).

### Sync integrations and their guard flags
- **Firebase** (`fbSaveAll`/`fbLoadAll`/`fbApplyData`): cross-device blob+entity sync. Guarded by
  `_applyingFbData` (suppress write-triggered re-sync while applying incoming cloud data) and
  `_fbApplySkip` (never let device-local keys like `return_sync_model` get overwritten from the
  cloud — see `tests/fb-apply-skip.test.js`).
- **Notion** (`syncDiaryToNotion`/`pullDiaryFromNotion`): bidirectional diary sync with a 3-way
  merge using `entry._nbase` as the baseline (`_notionMergeSection`). Guarded by
  `_notionSyncActive`/`_notionPullActive` re-entrancy locks (with a 60s stale-lock watchdog) and
  `_notionSyncActive` window flag during apply. `getNotionCfg().autoSync` is gated by the
  **device-local** `notion_autosync_off` localStorage flag — NOT the Firebase-synced
  `diary_notion_cfg.autoSync` field, which kept getting poisoned to `false` by cross-device sync.
  `_apTrace()` writes to an `_autoPushTrace` ring buffer for runtime diagnosis (surfaced in the
  in-app Notion diagnostics tool).
- **Google Calendar** (`gcalQueueAutoSync`): one-way push of tasks to GCal events.

When debugging any of these, **don't guess** — these subsystems have caused repeated regressions
because of subtle re-entrancy and cloud-setting round-trip issues. Add trace/log output (or use
existing diagnostic tooling — search for `runNotionDiagnostics`, `returnSyncSelfTest`,
`returnSyncModelStatus`, `returnStorageReport`, `returnDataMap`) and read the actual runtime
behavior before changing merge/guard logic.

### Per-entity sync migration (Stage 6, in progress)
Entities are gaining a parallel stable id `_eid` (the legacy `id` field is deliberately left
untouched — renaming it broke past attempts because of widespread `Number(x.id)`/`data-id`
lookups). Merge is last-write-wins by `updatedAt` with tombstones (`deletedAt`) to prevent
deleted data from resurrecting. See `docs/STAGE6_DESIGN.md` for the full design and
`docs/STAGE9_VERIFICATION.md` for the manual two-device verification matrix that must pass before
flipping `RETURN_SYNC_MODEL` from `'legacy'` to `'entity'` in production.

## Working in this codebase

- **One change at a time.** This file is large and interconnected; isolate each fix/feature so
  `npm test` and the diff stay reviewable.
- **Read the actual code before changing it** — especially around storage/sync, which has many
  non-obvious guards (re-entrancy locks, device-local vs. synced flags, stale-quota state) that
  look redundant but each fix a real regression. Check `git log -p` / PR history for *why* a guard
  exists before removing it.
- **Add or extend a test when you fix a sync/merge/storage bug.** The `tests/*.test.js` files
  follow the `sliceBlock` pattern from `tests/lib.js` — load the real function out of `index.html`
  and exercise it in a mocked sandbox rather than reimplementing the logic in the test.
- `PROMPT_TEMPLATES.md` contains reusable task-prompt templates (bug-fix / feature-request) that
  encode the working style that has produced reliable fixes in this repo (no guessing, diagnose
  with runtime traces before changing guard logic, fix related call sites proactively, verify in
  a bounded loop).
