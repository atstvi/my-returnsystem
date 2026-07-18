# Home (나) — Redesign Working Doc

Follows `docs/REDESIGN_WORKFLOW.md`. Phases 1–3 (understand / functional audit / UX audit) below;
Phase 4+ (visual / implement) appended as they happen. Nothing here ships until the functional
map is 1:1 and validated per §6.

## Phase 1 — Understand

**What Home is for:** the daily landing dashboard — the "나" (me) page. On open, the user should
answer, in seconds: *what day is it, how am I doing, what needs my attention, what's my day shaped
like* — and be able to **capture** a stray thought without navigating away. It's the hub the
whole check-in → reflect → act → recharge loop returns to.

- **Primary goal:** at-a-glance daily orientation + one-tap capture.
- **Secondary goals:** triage what needs action (inbox/deadlines), see & shape today's time, quick
  habit check, jump into the relevant page.
- **Edge cases:** brand-new user (no data), a day with nothing due, a day overloaded, no banner
  set, not logged in (local-only), very long task/inbox lists.

## Phase 2 — Functional audit (1:1 map — nothing may disappear)

Runtime section order (from `normalizeHomeLayoutOrder`): context bar → situation → timeblock →
tasks → timegrid → inbox → ops-panel.

| # | Feature (current) | Key hooks / handlers | Redesign intent |
|---|---|---|---|
| 1 | **Banner** (image + stickers + position) | `home-banner-file`, `home-sticker-file`, `home-banner-btn`🖼️, `home-banner-pos-btn`↔, `home-sticker-btn`🎭 · fileToBannerDataUrl, applyHomeBannerVisual, saveHomeBanner, sticker fns | Keep. Move the 3 edit affordances out of the always-visible date row into a hover/overflow control (rarely used vs. daily). Long-press-to-edit stickers (ref-2) later. |
| 2 | **Context bar** — date | `js-date` · updateDateHeader | Keep the date as a quiet page header; fold banner icons into it. |
| 3 | **Capture bar** — Inbox/Task quick capture | `capture-inbox-btn`/`capture-task-btn` (setHomeCaptureType), `capture-inp`, `capture-send` · homeCapture | **Keep, elevate** — it's a core daily action. Refine to one clean composer (ref-2 compose pattern, UI only). |
| 4 | **Situation card** — avatar + AI read + signals + quick habit | `sit-*`, signals `sig-danger/warn/ok` (openHomeSignalList: data-idx/inbox-done/inbox-clear/open/pass/unpass), `home-routine-quick` · renderHomeSituation | Keep as the emotional anchor ("heart"). Signals should be the *single* attention surface (see UX audit — dedupe deadlines/inbox that repeat elsewhere). |
| 5 | **D-day card** (hidden until set) | `home-dday-card` · renderHomeDdayCard, homeSkip/UnskipDeadlineLink, data-task-id | Keep. Consider merging into the situation/attention area rather than a separate stacked card. |
| 6 | **Timegrid** — week canvas linking deadlines↔tasks | `tg-prev/next`, `tg-range-label`, `tgCanvas`, `tgPillLayer`, legend | Keep (unique, deliberate). Give it real width on desktop instead of a cramped single column. |
| 7 | **Timeblock** — today's vertical hour schedule | `htb-range-btn` (openHomeTimeBlockPrefs), `htb-now-btn` (scrollHomeTimeBlockToNow), all-day chips (openModal), `htb-axis`/`htb-slots` (renderHomeTimeBlocks, data-hour), drag-to-retime | Keep. This is "today"; pair it with tasks as the day's action column. |
| 8 | **Today's tasks** — Eisenhower / list toggle + rules | `home-eisen-btn`/`home-list-btn` (setHomeTaskView), `home-task-count`, `home-eisen-grid` (data-eisen-box) / `home-task-list`, edit ✏️ (openModal), `home-more-tasks` | Keep both views + toggle. Clean the task-row secondary actions. |
| 8b | **Rules / repeat management** | `home-rule-btn` (openHomeRuleModal), `home-repeat-btn` (openHomeRepeatModal) + editHomeRule/deleteHomeRule/editHomeRepeat/deleteHomeRepeat/openHomeRuleEditor | Keep. These are management entry points — demote from the main task card into a quieter "manage" affordance. |
| 8c | **Ops panel** (dynamic) | ensureHomeOpsPanel, renderHomeOpsPanel | Keep; audit what it surfaces and fold into the attention area if redundant. |
| 9 | **Inbox signal** — needs-action list | `inbox-section`, `home-inbox-count`, `home-inbox-list` (inbox-item, 처리, 전체) · renderHomeInbox, openInboxItemFromHome | Keep. **Dedupe** with situation signals (both say "인박스 N개 처리 필요"). |
| 10 | **Habit quick-check** | `home-routine-quick` (inside situation) | Keep — one-tap habit ticking without leaving Home. |
| — | Global capture FAB | `global-capture-fab` (openGlobalCapture) | App-wide, not Home-specific; leave (may reconcile with top-bar `+` later). |

## Phase 3 — UX audit (assume every decision is questionable)

1. **Deadlines are shown in ~5 places** — situation signal, D-day card, timegrid, timeblock
   all-day chip, and each task's `dl-badge`. That's cognitive noise. → One canonical "what's due"
   surface (the attention area); the others reference it, not repeat it.
2. **Inbox count appears twice** — situation `sig-warn` ("인박스 N개 처리 필요") and the inbox
   card. → Signals become the *entry*, the inbox card is the *list*; don't state the count twice.
3. **Long single-column stack** — 6 heavy cards stacked vertically. The new shell gives ~1000px+
   of width that Home currently wastes; the page is all scroll. → **Desktop 2-column dashboard**:
   a left "today / act" column (capture, situation+attention, tasks, timeblock) and a right
   "at-a-glance / plan" column (timegrid, inbox, habits) — collapses to one column on mobile
   (where the current stack is actually fine).
4. **Emoji section labels** (⏱ 타임그리드, ⬛ 타임블록) clash with the new line-icon system. →
   Replace with the line icons + consistent `.sec-label` type.
5. **Banner-edit icons live in the daily date row** though they're used rarely. → Tuck them.
6. **Weak primary hierarchy** — every card looks equally weighted; nothing says "start here."
   → Capture + situation lead; management (rules/repeat) demoted; type/space hierarchy, not more
   boxes (DESIGN §3.2, 원칙 9).

## Phase 4 — Visual direction (confirmed)

Confirmed v2 mockup: top bar with the quick-capture in the search slot + settings icon; header as a
big **banner card** with **오늘 상황 to its right** (reference structure); calm **two-column
dashboard** folding to one column on mobile; dedupe deadline/inbox repetition; emoji labels → line
icons; **활성 규칙·반복 할일 moved to the Tasks tab**; empty space filled by a **flexible, useful
widget slot** (default 빠른 메모; pickable: 음악 추천 / 사진 데코 / 가치관) rather than pure
decoration (per a masonry/bento-grid search).

## Phase 5 — Implementation (in careful tested steps, §6)

**Key discovery that de-risks this:** on wide desktop (`@media min-width:1180px`) Home is already a
**CSS grid on flat section children** (`grid-column`/`grid-row` per section, lines ~1602-1635);
`normalizeHomeLayoutOrder` keeps sections as flat children of `.home-content`. So most of the
2-column composition is **CSS**, not a markup rewrite. The banner sits *outside* `.home-content`
(cleared via `padding-top`), so the banner+situation row needs the banner moved into the grid.

Steps (each: keep every `id`/`data-*`/`onclick`; inventory diff 0-lost; npm test; render):
- **5a-1 (done):** emoji section labels ⏱/⬛ → line icons (`.sec-ico`). Verified render targets
  (`.sit-msg`, `home-eisen-grid`, `tgCanvas`) intact, no console errors.
- **5a-2 (done):** banner converted from an absolute top-strip to an **in-flow rounded card**
  (`position:relative;border-radius:var(--r-xl)`, `.banner-fade` hidden) and moved *inside*
  `.home-content` as its first child; all `padding-top` clearance hacks removed. Desktop grid
  (≥1180px) now places **banner (col1) | 오늘 상황 (col2)** as the top content row, then
  tasks|timegrid, then inbox|timeblock, ops full-width. Banner heights: 150px mobile / 200px
  tablet / stretch≥220px desktop. Verified: all banner JS is class-based (`querySelector`) +
  `getBoundingClientRect` so the DOM move is transparent; render at 1440/900/390 shows the
  banner|situation top row and correct single-column collapse; `.sit-msg`/`home-eisen-grid`/
  `tgCanvas` intact; only network (Firebase) console errors; npm test green; 0 functions lost.
  (Habit extraction deferred — kept inside the situation card to hold scope tight.)
- **5b (done):** **flexible widget slot** filling the desktop gap under 오늘 상황. New
  `.home-widget-card` (id `home-widget-card`) with a 4-way segmented switch — **메모 (default) ·
  가치관 · 사진 · 음악** — persisted in `home_widget_type`:
  - *메모*: autosaved + synced textarea (`home_widget_memo`, debounced through
    `setReturnStorageItem`).
  - *가치관*: reads existing `philCards`, one card at a time with a `1 / N ›` pager; empty state
    links to 기록(records).
  - *사진 데코*: image slot storing a media ref (`home_widget_photo`) via
    `returnMediaStoreDataUrl`/`returnMediaResolveUrlWithFallback` (same media stack as the
    banner), with a remove control.
  - *음악 추천*: reads `musicPlaylists` count and links to the 음악 page (no coupling to the
    fragile music-page DOM).
  Wired into `_initHome` (`renderHomeWidget`) and `normalizeHomeLayoutOrder` (placed right after
  the situation card, so mobile order is date → situation → widget → …). Desktop grid: the banner
  now spans rows 3–4 in col1 beside the situation(row3)+widget(row4) stack in col2. Verified: all
  4 states render with content and zero page errors at 1440; mobile order correct at 390; npm
  test green; 0 functions lost.
- **5c (done):** relocated **활성 규칙 · 반복 할일** to the Tasks page. Discovery: on Home this
  card was the *dynamically-built* ops panel (`ensureHomeOpsPanel`) that moves the static
  `.rules-box` seed into a `#home-ops-section` card and hides the seed — so the move = re-seed the
  rules-box on the Tasks page and let the same code build the panel there. Done by (1) cutting the
  `.rules-box` markup out of the Home tasks card and inserting it (ids intact:
  `home-rule-btn`/`home-repeat-btn`/`home-rule-desc`/`home-repeat-desc`) into the Tasks list
  column after `#task-sections`; (2) making `ensureHomeOpsPanel` mount robustly when there's no
  `section.card` ancestor (inserts the panel right after the seed cards); (3) calling
  `renderHomeOpsPanel()` from `_initTasks`. Verified: Home shows no ops/rules card; the panel
  renders on the Tasks page (empty state + working 규칙 추가/반복 추가); id-bound listeners follow;
  zero page errors; npm test green; 0 functions lost. (A relocation, not a removal — the feature
  stays fully accessible, so it's within the ADD/relayout freedom.)
- **5d (done):** **global top bar**. Wrapped all 14 page-containers in a new content column
  `.app-main` = `.app-topbar` (fixed 60px / 52px mobile) + `.page-stack` (flex:1), so the top bar
  is persistent across every page. The top bar holds the **quick-capture in the search slot**
  (the Home `.capture-bar` markup moved here verbatim — same `capture-inbox-btn`/`capture-task-btn`/
  `capture-inp`/`.capture-send` ids/classes, so the load-time listeners + `homeCapture` work
  app-wide) and a **settings gear** (`topbar-settings-btn` → `goPage('settings')`). Removed the
  sidebar **설정** tab; settings stays reachable via the gear *and* the sidebar profile button
  (`openProfileSettings`). Height model: `.page-container` `height:100vh`→`100%` (desktop and the
  `100dvh` mobile rule → `100%`) so pages fit under the bar with no overflow; focus-mode hides the
  bar like the sidebar. Home grid renumbered (capture row removed). Verified: **all 14 pages** at
  1440 & 390 render with the bar, correct heights (0 overflow), 0 page errors; capturing from a
  non-Home page adds an inbox item; the gear navigates to settings; the sidebar 설정 tab is gone;
  npm test green; 0 functions lost. (Relocations only — capture and settings both stay fully
  accessible — so within the ADD/relayout freedom.)

## Phase 6 — Design every state (in progress)

- **Empty / first-use banner (done):** with no image the banner was a large blank gradient whose
  only edit affordances were the hover-hidden icons in the date row — undiscoverable. Added a
  centered inline **`＋ 배너 추가`** CTA (`home-banner-add`) shown only on `.home-banner:not(.has-image)`
  and hidden in edit/position modes; it opens the existing banner file picker. Removed the banner's
  `aria-hidden` (it now holds an interactive control). Verified: CTA visible when empty, `display:none`
  once `.has-image`, 0 page errors.
- **Widget a11y (done):** tabs get `aria-controls="hw-body"`; the body is `role="tabpanel"
  aria-live="polite"` so type switches are announced. (Widget empty states — 가치관 none / 사진 none /
  음악 no-playlists — were built in 5b.)
- **Removed the global quick-capture FAB (owner-approved):** the bottom-right `＋` FAB + its
  `#global-capture` overlay were redundant once the global top bar hosts capture on every page.
  Removed both markup blocks; the now-orphaned `openGlobalCapture`/`submitGlobalCapture`/
  `updateGlobalCaptureVisibility` functions already null-guard their elements, so they no-op safely
  (kept to avoid touching unrelated call sites). Verified: no `.global-capture-fab`/`#global-capture`
  in the DOM, functions no-op without throwing, 0 page errors, 0 functions lost.
- **Still open (owner reviewing):** focus-mode reveals the top bar on any content-area hover, which
  softens focus-mode's "hide chrome" intent — left as-is pending the owner's decision.

## Post-merge refinements (mockup ↔ real-app parity)

After PR #200 merged, the owner compared the Phase-4 mockup vs. the live app and flagged three
gaps. Addressed on a fresh branch off `main`:
- **Search-box width:** the top-bar capture stretched nearly full-width. Capped
  `.app-topbar .capture-inner` at 560px, left-aligned, gear on the right — reads as a search box,
  matching the mockup.
- **habits → own card (owner-approved, keep function):** the habit quick-check was crammed inside
  오늘 상황, making it dense. Moved `#home-routine-quick` out into a dedicated **오늘 습관**
  (`home-habits-card`) — keeping the full chip UI (완료/건너뜀/휴식 + menu), no function lost. The
  card auto-hides when there are no habits (toggled in `renderHomeRoutineQuick`); added to
  `normalizeHomeLayoutOrder` after 오늘 상황.
- **얼마 남지 않은 일정 list (owner-approved):** 오늘 상황 now shows the nearest ≤3 upcoming
  deadlines (`#sit-upcoming`, reuses the `deadlines` already computed in `renderHomeSituation`);
  rows open the existing signal-list dialog. Hidden when none.
- **Desktop grid rebalanced** to clean 2-cards-per-row: banner|상황, 습관|위젯, 할일|타임그리드,
  인박스|타임블록 (banner stretches to the situation row height).
- **Color/색감:** base tokens are the agreed warm dusty-rose palette; the extra sidebar pink in the
  live app traces to the owner's saved Theme Studio state, not the base CSS — left for the owner to
  confirm whether the *base* should shift airier.
Verified: all 14 pages render at 1440 & 390 (0 overflow, 0 errors); new cards render with seeded
data; npm test green; 0 functions lost.

## Card design ↔ mockup parity pass

Owner compared live cards vs. the Phase-4 mockup and found the card designs/spacing still off. Ported
the mockup's card system into the live Home:
- **Card visual language:** unified all Home cards to the mockup's hairline border
  (`.5px solid var(--border-subtle)`) + flat `--elev-1` + `--r-xl` (was mixed borderless `--elev-2`/
  `--r-lg`). Applied to `.card`, `.sit-card`, `.home-habits-card`, `.home-widget-card`.
- **Mockup composition + gap fix:** rebuilt the ≥1180px grid to the mockup arrangement with a wider
  left column (`1.32fr / 1fr`) and **stretch-fill** so card bottoms align (no leftover gaps):
  row1 날짜 | 오늘 상황(span 2) · row2 배너 | (상황) · row3 오늘 할일(span 2) | 오늘 습관 ·
  row4 (할일) | 처리 필요(fill) · row5 타임블록 | 빠른 메모(fill) · row6 타임그리드(full).
  오늘 상황's `.sit-body` is now a flex column with `.sit-upcoming` pinned to the bottom
  (`margin-top:auto`) so it fills the banner-row height like the mockup.
- **처리 필요 restored on Home:** removed the old `display:none!important` that hid the standalone
  inbox card — the mockup shows it as the actionable *list* (the 오늘 상황 signal is the compact
  *entry/count*). `renderHomeInbox` now hides the card only when there's nothing to process.
- **Mobile order** updated to the mockup reading order: 날짜 → 상황 → 할일 → 습관 → 처리 → 타임블록
  → 위젯 → 타임그리드.
Still different by design (owner's earlier call): 오늘 습관 keeps the rich chip UI (완료/건너뜀/휴식)
rather than the mockup's plain checklist. Verified: all 14 pages 0 overflow / 0 errors at 1440 & 390;
npm test green; 0 functions lost.
