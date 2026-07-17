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
- **5a-2 (next):** desktop grid → v2 composition (banner moved into grid for banner|situation top
  row; habits extracted from the situation card into their own right-column card; grid positions
  retuned; raise `max-width`). CSS + small safe markup moves.
- **5b:** flexible widget slot (빠른 메모 default) filling the layout gap.
- **5c:** relocate 활성 규칙·반복 할일 to the Tasks page (move the `rules-box` markup — ids intact
  so the id-bound listeners + desc updaters follow; add a Tasks entry point).
- **5d:** global top bar (capture in search slot + settings icon; remove sidebar settings tab).
  Structural — wrap the 14 `height:100vh` page-containers + reconcile heights; done last & alone.
