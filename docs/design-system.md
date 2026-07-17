# Return — Design System

> **Status: DRAFT — all sections drafted; §2 (tokens/color) shipped.** §3 (components) and §6
> (application process) document existing reality + decided rules. §4 (patterns) and §5 (page
> notes) are the intent layer and carry **open decisions** — most notably the app-shell change in
> §4.1 — which get their own scoped approval before any code. Do not treat an open-decision item
> as settled.
>
> **This document is a constraint, not a mood board.** Every component and pattern below must
> name the exact page/control in `docs/UI_FUNCTION_INVENTORY.md` it replaces. If a redesign pass
> can't point to that mapping, it is not ready to ship — see "적용 프로세스" (§6).

---

## 0. Source materials this document is built from

- **Anti-Slop UI/UX Design Constitution** — the binding constraint set. Usability beats
  aesthetics whenever they conflict. Referenced throughout as "원칙 N."
- **Reference set 1 (primary reference — 4 images)**: sidebar + top search bar + icon cluster
  dashboard, calm muted mauve/cream palette, long-press-to-edit stickers, Timer tab (big digital
  display + record list + hour-grid heatmap). **Weighted heaviest, but never copied directly** —
  every borrowed idea below is restated in Return's own terms, not lifted as-is.
- **Reference set 2 (나기메모 floating memo widget)**: two-zone header (view controls left /
  document actions right), icon-only utility bar, labeled rich-text toolbar groups.
- **Reference set 3 (DayFlow)**: not a visual reference (explicitly rejected) — only the
  Matrix → Flow → Review daily-flow *information architecture*, especially the end-of-day
  Done/Left/Hold review step Return doesn't currently have.
- **Reference set 4/5 (Projects folder grid; braindump SNS widget)**: folder-card + progress-bar
  + favorite pattern for Projects; compose-box icon row / attachment chips / inline reply pattern
  for possible Inbox or Diary use — **conceptual fit (SNS framing, storage model) still open**,
  do not resolve by default.
- **`docs/UI_FUNCTION_INVENTORY.md` / `docs/ui-inventory.json`** — the ground truth for what
  currently exists. Any component defined here must trace to real entries there.
- **Existing `:root` tokens** (`index.html:204-264`) and the live Theme Studio customization
  layer (density/radius/skin/intensity/accent, user-controlled) — this system is not being
  replaced; it's being refined and then respected as a hard constraint (Theme Studio must keep
  working exactly as it does today).

---

## 1. Principles (project-specific reading of the Anti-Slop Constitution)

These restate the constitution in terms of decisions we've already made or are about to make —
not a re-print of the source document.

1. **Structure beats surface.** (원칙 3, 4, 5) Where Return's current information architecture
   already reflects hard-won judgment — e.g. the Calendar and Tasks pages' category sidebar,
   view-switcher, and to-do panel — the structure is kept. Only the visual execution (spacing,
   alignment, secondary-action placement) is cleaned up. A prettier layout that removes a
   feature or changes where things live is not a valid redesign of these pages.
2. **One visual language, named.** (원칙 8) The language for this pass is **Calm Warm Minimal**:
   warm, low-saturation neutrals; restrained accent use; flat surfaces (elev-1 by default,
   elev-2/3 reserved for true overlays); hierarchy from type/space, not boxes. Every visual
   decision below is checked against this name, not against "does it look like the reference."
3. **Color blocks are earned, not default.** (원칙 9, 13) Reference set 1 leans on tinted card
   blocks for most content. The constitution explicitly warns against relying on colored boxes
   for hierarchy. Resolution: tinted surfaces are reserved for genuinely distinct states
   (emphasis/highlight, status, a specific call-to-attention like a D-day or quoted reflection) —
   never the default container for ordinary content. Plain surfaces + type/space hierarchy is
   the default; color is the exception that must justify itself.
4. **Discoverability, not minimalism, fixes clutter.** (원칙 6) The user's own diagnosis — "as
   features got added, paths got messy" — is a hierarchy problem, not a hiding problem. Advanced/
   rare actions may be tucked away; core workflows never get harder to find than they are today.
5. **Theme Studio is in scope for improvement (updated).** Users customize accent/density/radius/
   skin/intensity at runtime, and the design system still defines the *default* state Theme Studio
   starts from and the token names it hooks into. But Theme Studio itself needs work — its
   mechanism (apply pipeline, defaults, generated-CSS override, icon system, presets) **may be
   changed or refactored** when the redesign calls for it; it is no longer a frozen constraint.
   The remaining duty is to **preserve user-customization intent** — don't silently discard
   someone's saved settings; reconcile stale/retired values via read-chokepoint migrations (as
   done for accent/category/icon defaults). Removing a customization *capability* falls under the
   feature-removal rule (§6).
6. **Real content only.** (원칙 12) Any mockup or spec produced from this document uses actual
   Return data shapes (real task/diary/playlist examples), never Lorem Ipsum or "Feature One"
   placeholders — this project already has sample-seed-gate/demo-cleanup tests precisely because
   placeholder vs. real content has been a real bug source here before.

---

## 2. Tokens

Baseline is the existing `:root` block (`index.html:204-264`) — audited, not replaced. Changes
below are deltas with reasoning, not a new palette.

### 2.1 Color — no structural change, one deliberate shift

**Keep unchanged:** the semantic success/warning/danger scale and the elevation shadow *values*
(see §2.4 for usage guidance instead). _(The accent scale and dark-mode blocks were originally
scoped as "unchanged" here, but the accent recolor in §2.1.1 supersedes that — see there.)_

**Shift: neutral scale undertone**, `--n-50` through `--n-150` only:

| Token | Current | Proposed | Why |
|---|---|---|---|
| `--n-50` | `#FAF9F7` (warm cream) | `#FAF7F6` | Nudges the undertone from yellow-warm toward a barely-there warm mauve — the "calm" read in reference 1 comes from this undertone, not from saturation. Kept subtle on purpose (원칙 9: restraint) rather than adopting the reference's actual saturated blush. |
| `--n-100` | `#F3F1EE` | `#F4EEEC` | Same undertone shift, one step up. |
| `--n-150` | `#EAE8E4` | `#ECE3E0` | Same. |

`--n-200` through `--n-800` (borders, body text, headings) are **unchanged** — they're already
warm-neutral and reference 1's dark text is close to Return's existing `--n-700`. No reason to
touch what isn't the problem.

**New semantic token, not a new palette:** `--bg-tint: var(--a-50)` (alias, same value as the
existing `--accent-light`/`--bg-active`). Named separately so component specs can say "use
`--bg-tint` for an emphasis surface" without implying "use the accent-light token," even though
today they resolve to the same color — keeps the emphasis-surface *usage rule* (principle 3
above) visible in the token name itself, independent of what hue backs it.

**Status: applied.** Shipped in `index.html` (`:root`, `html[data-mode="light"]`, and
`THEME_STUDIO_DEFAULT.colors.page`) — `npm test` passes unchanged (pure CSS value swap, no logic
touched). Confirmed conservative-first via the token preview artifact before applying.

### 2.1.1 Accent — dusty rose (applied)

The old red default (`--a-400:#D9524C`) read saturation-sharp against the calmer ground, and the
user doesn't like red. Decision (Direction 나, "warm multi-pastel"): move the whole register to a
**warm, muted rose** and drop true-black inks. Red candidates were discarded.

**Contrast-first caveat (원칙: usability > aesthetics):** `--accent` is used as a *fill with white
text* (`.btn-primary{color:var(--n-0)}`) in ~30+ places. The soft `#C8848A` rose from the mockup
only hits ~3:1 against white (fails WCAG 4.5:1 for 13px). So the shipped `--a-400` is deepened to
**`#A75F66`** (white-text contrast **4.70:1** ✓), while the *light tints* stay soft.

Applied ramp (light `:root`):

| Token | Value | Role |
|---|---|---|
| `--a-50` | `#F6E7E8` | accent-light / bg-active tint |
| `--a-100` | `#EBD0D2` | |
| `--a-200` | `#D8A6AB` | |
| `--a-400` | `#A75F66` | **`--accent`** — fills with white text (4.70:1) |
| `--a-500` | `#95545B` | `--accent-hover` (5.68:1) |
| `--a-600` | `#7E464D` | `--accent-press` |
| `--a-700` | `#5E333A` | deepest |

Dark mode (`--n-0` becomes dark, so accent fills carry *dark* text): `--a-400:#D89AA0`
(dark-text contrast 7.14:1 ✓), tints as `rgba(200,132,138,·)`.

### 2.1.2 Soft ink — "no true black" (applied)

`--fg` (161 text uses; all headings+body route through it — `color:var(--n-700)` direct = 0 uses)
retargeted from `var(--n-700)` to a new `--ink` token = **`#3E362F`** (warm, lifted; contrast on
page **11.1:1**, still crisp for 13px Korean). `--n-700`'s 4 dark *fills* (toast, selected-day
strip, dark badge) are intentionally left untouched — only the text path softened. Deliberately
did **not** go as light as reference-1's grey inks (#74747f) — readability first.

### 2.1.3 Where it was applied (all layers kept consistent)

Both the base CSS layer and the runtime Theme Studio layer were updated together so the app shows
the same result whichever is active:
- `:root` accent ramp + `--ink`; `--a-700` override at line ~243.
- Dark overrides in **both** `@media (prefers-color-scheme:dark)` **and** `html[data-mode="dark"]`
  (there are two — missing one leaves OS-dark users on red).
- `THEME_STUDIO_DEFAULT.colors` (`accent`→`#A75F66`, `text`→`#3E362F`, `sidebarActive` softened),
  since `themeStudioApply()` injects a `:root{}` literal override on every boot deriving tints
  from these via `color-mix`.
- `<meta name="theme-color">`, the two OAuth-popup buttons, and 3 JS `--accent` read-fallbacks.

**Saved-state migration (important):** the real app didn't visibly change at first — a
**saved + Firebase-synced** Theme Studio state still carried the old red, and the merge is
`default ← saved`, so the stale value shadowed the new default. Fix lives at the read chokepoint
`themeStudioNormalizeState` → `themeStudioUpgradeLegacyColorDefaults`: any color still equal to an
*exact retired default* (`accent #C2433D`, `page #FAF9F7`, `text #352B2B`, `sidebarActive
#FBE5EC`) is upgraded to the new default on every read. Because it runs on read, it stays correct
even after a Firebase cloud round-trip re-writes the old state (the poisoning pattern CLAUDE.md
documents). A genuinely custom color is untouched. Those four exact hexes are consequently no
longer selectable as custom values — acceptable, they're the retired brand defaults. Covered by
`tests/theme-studio-legacy-color-upgrade.test.js`.

**Verified:** `npm test` (now incl. the new suite); headless render confirms rose logo/button +
soft ink, no breakage; and two seeded-state boots pass — an old-red saved state heals to
`#A75F66`, a custom blue accent (`#5B9BD5`) is preserved. No manual reset needed.

### 2.1.5 Category colors — muted pastel (applied)

The task and hobby categories were a saturated rainbow (task cats mapped to *semantic* tokens —
`--danger` red, `--p-400` indigo, `--t-400` teal — which is also conceptually wrong: category ≠
status; hobby cats were raw saturated hex). Remapped every *exact retired default* to a
harmonized muted-pastel hex drawn from the same register as the app's already-pastel
`TT_DEFAULT_PALETTE` (rose `#BE727A`, periwinkle `#7E7BC0`, mint `#4E9A84`, amber `#B0863F`, sage
`#6E9463`, lilac `#9985C2`, warm-grey `#897E74`, + plum/caramel/clay/deep-sage for hobby's 12).

Same read-chokepoint pattern as Theme Studio, so it reaches existing synced categories and
survives cloud round-trips:
- `upgradeCatColor(hex)` + `LEGACY_CAT_COLOR_MAP` — applied in `normalizeTaskCatColor` (the task
  color chokepoint; all task color renders route through it) and `hobGetCat` (hobby, which uses
  raw `cat.color`). Custom colors pass through untouched; the retired exact hexes are no longer
  selectable.
- `CATS` defaults and the hobby `CAT_COLORS` swatch options rewritten to the muted set;
  `taskCategoryColorInputValue` fallback moved off the old red.
- Left as-is (already soft): inbox `.cat-*` chips (token `-50` tints) and `TT_DEFAULT_PALETTE`.

Contrast note: muted category labels land ~3–4:1 on white — the *same band as the original*
colors (old teal `#38B2AC` was 2.8:1), and they render mostly as tint-bg + short colored label,
so this matches the app's existing bar rather than lowering it. Covered by
`tests/category-color-pastel-upgrade.test.js`.

**Still deferred:** emotion/mood tag colors (if any carry saturated hex) — verify in the Records
page pass.

**Flagged, not touched (pre-existing, out of scope):** Theme Studio's boot override pins
`--bg-page`/`--bg-card`/`--fg` to its (light) color state as literals, which largely supersedes
the separate dark-mode blocks when active. This is existing architecture, not introduced here —
noted for a future "does dark mode actually reach the user?" investigation.

### 2.1.4 `--bg-tint` (deferred naming aid)

Still intend to add `--bg-tint: var(--a-50)` as a named emphasis-surface token (see §3 principle
3) when components are specced — not yet added.

### 2.2 Typography — no change

`Pretendard Variable` already reads clean/neutral in the way reference 1's system sans does, and
it's the correct choice for Korean text density. The `text-2xs…2xl` scale is untouched.

### 2.3 Spacing & radius

`--sp-*` already covers reference 1's proportions (generous padding, `r-full` pills). Its gap is
*which* value gets used where after features accreted — a per-component/per-page fix (§3/§5).

**Radius — rounded the default up (applied).** The `:root` radius scale (the Theme Studio "soft"
default; `sharp`/`bubble` presets override it) was bumped a step: `--r-sm` 4→6, `--r-md` 8→10,
`--r-lg` 12→14, `--r-xl` 16→20. Softer, calmer corners everywhere on the default preset. Users on
`sharp`/`bubble` keep their choice, and the `sharp < soft < bubble` ordering is preserved.

**Small profile tweaks (applied):** sidebar profile enlarged (avatar 56→72px, name `text-lg`,
handle/status `text-sm`); Settings status-field placeholder → `Location` to match its
location-pin display.

### 2.4 Elevation — usage rule, not a value change

Default to `--elev-1` (barely-there) for standing surfaces; reserve `--elev-2`/`--elev-3` for
things that are actually floating above content (modals, dropdowns, dragged items). Reference
1's flat-card look is really "everything defaults to elev-1, nothing defaults to elev-2" —
codifying that as a rule stops "add a shadow to make it pop" creeping back in later.

### 2.5 Motion — no change

`--t-snap`/`--t-enter`/`--t-ease`/`--t-exit` are untouched; the constitution explicitly warns
against decorative/meaningless animation (원칙 10), and nothing in reference 1 asked for new
motion.

---

## 3. Components

This documents the **component vocabulary that already exists** in `index.html` (usage counts from
the codebase), and the rules that make it one coherent language. The goal of a redesign pass is to
make every page use *these* components consistently — not to invent new ones. New components are
added here only when a real need can't be met by an existing one.

### 3.1 Buttons — one base, a clear hierarchy

Canonical classes (do not create page-local button styles): `.btn` (base, ~450 uses) + one intent
modifier.

| Class | Role | When | Fill / text |
|---|---|---|---|
| `.btn-primary` | **Primary action** (one per view/section) | the single most-likely next action — Save, Add, Sync now | `--accent` bg, white text (contrast-safe, see §2.1.1) |
| `.btn-ghost` | **Secondary / neutral** (the default, ~214 uses) | Cancel, secondary actions, toolbar buttons | transparent/subtle bg, `--fg-2`, `1px --border` |
| `.btn-danger` | **Destructive** | Delete, Clear all | `--danger` |
| `.btn-success` | Rare affirmative | reserve; don't use as a second primary | `--success` |

Rules: **at most one `.btn-primary` per view** (원칙 5 hierarchy — two primaries = no primary).
Settings uses a parallel `.set-btn` family; keep it visually identical to `.btn` (same radius,
padding rhythm, states). Every button needs a visible `:focus-visible` ring and a hover state.

### 3.2 Surfaces — cards & panels, flat by default

`.card` / `.sit-card` / `.home-card` / `.panel-*` are the surface family. Rules:
- Default elevation is **`--elev-1`** (§2.4). A card inside a card drops to `--elev-0` + a
  `1px --border`/`--hair` hairline instead of stacking shadows.
- Radius from `--r-lg`/`--r-xl`; padding from the `--sp-*` scale — never ad-hoc px.
- **Colored/tinted card backgrounds are earned, not default** (§1 principle 3, 원칙 9): a plain
  `--bg-card` surface + type/space hierarchy is the default; a `--bg-tint`/`--accent-light` surface
  is only for a genuinely distinct emphasis (D-day, a quoted reflection, an active state).

### 3.3 Chips & tags — the tint + ink pattern

Category/status/emotion chips follow one pattern: **soft tint background + darker same-hue ink
text** (as the inbox `.cat-*` classes and the new muted category colors do — §2.1.5). Never a
saturated solid fill with white text for a *category* (that reads as a primary action / status,
not a label — 원칙 7, separate concepts). Pills use `--r-full`.

### 3.4 Inputs — `.set-inp` / `.field-inp` / `.set-select`

One input look across the app: `1px --border`, `--r-md`, `--bg-card`/`--bg-raised` fill,
`--focus-ring` on focus. Labels sit above or inline-left at `--text-xs`/`--fg-3`. Placeholder text
is `--fg-4`. A field that's editable must *look* editable (원칙 1 "is this editable?").

### 3.5 Modal / overlay

`.overlay` (scrim) + `.modal` with `.modal-head` / `.modal-body` / `.modal-foot`. This is the only
floating-panel pattern — `--elev-3`, `--r-xl`. Footer holds actions right-aligned: `.btn-ghost`
Cancel then `.btn-primary` confirm (consistent order = predictability, 원칙 2). Esc + scrim-click
close; focus moves into the modal.

### 3.6 Toggle

`.toggle-wrap` / `.toggle-track` / `.toggle-thumb` — the single switch component. On = `--accent`
track. Don't substitute a checkbox where a toggle is the established control, or vice-versa
(consistency).

---

## 4. Patterns

### 4.1 App shell & navigation

Return's shell was a **narrow 68px icon rail** (icon + tiny label), no top bar. Approved
direction (reference 1): a **labeled sidebar** on desktop, mobile kept usable.

**Sidebar — DONE.** Widened to a 216px labeled sidebar. The app-logo slot became a **centered
Twitter-style profile header** (`.sb-profile`): circular avatar, display name, `@handle`, and a
status line shown with a location-pin icon (📍) — click opens Settings › Profile
(`openProfileSettings()`). Backed by `profile_data` extended with `handle`/`status`/`photo`
(custom avatar upload, compressed square, synced); new fields + photo picker live in Settings ›
Profile; logout stays in Settings. The orbit logo is retained only as the favicon/app-icon.
Then line-icon nav (icon + full label), generous spacing, calm active state (`--bg-card` card +
rose text + `--elev-1`). Responsive, reconciled with the app's existing breakpoints:
- **≥900px**: full labeled sidebar.
- **640–899px**: collapses to a 64px icon rail (labels hidden).
- **<639px**: the app's pre-existing fixed **bottom bar** takes over (kept; just taught it to
  hide `.sb-brand` and stack the new `.tab-btn` icon-over-label).

Binding contract held: every `.tab-btn` keeps its `id` + `data-page` + `aria-label`; `goPage()`
untouched. Verified — 13 tabs present with `data-page` + icons, inventory diff **0 functions
lost**, `npm test` green, headless render at all three widths.

Icons: emoji → built-in **SVG line icons** (24px grid, 1.7 stroke, `currentColor`). Reconciled
with Theme Studio's per-tab icon customization: `THEME_STUDIO_DEFAULT.icons` emptied and
`themeStudioApplyIcons` skips the retired emoji defaults (`THEME_STUDIO_RETIRED_ICONS`) so SVGs
show for everyone, while a genuinely custom tab icon still overrides.

**Top bar — DEFERRED (next pass).** Pages are 14 `height:100vh` flex siblings of the sidebar; a
top bar needs a structural wrapper + per-page height reconciliation, so it's its own step. Also:
reference 1's **search has no backend** in Return yet — a real global search is a separate
feature, and we will **not** ship a non-functional search box (원칙 13). The top bar's `+` can
wire to the existing `openGlobalCapture()`.

Logged for the top-bar pass: two-zone layout (view controls | doc actions — 나기메모), profile
block + clock (reference 1), notifications, long-press-to-edit stickers.

### 4.2 List ↔ board / view-switcher

Tasks and Inbox already switch views (list / priority / deadline / timeblock; feed / board). Keep
the switch control in one consistent place and style across pages; the *content* structure of each
view is kept (the user rated it above the references) — only spacing/alignment/secondary-action
placement gets cleaned up.

### 4.3 Compose → capture flow

The nagi-memo compose pattern (icon row above the input: image/emoji/attach + a clear primary
Send; attachment thumbnails with per-item remove; inline reply expanding under the source) is the
reference for Inbox capture and Quick Notes — **UI/interaction only**. Whether Inbox adopts an
SNS/timeline framing is still open (it's a fast idea/task capture, not a feed) and any image
attachment MUST reuse the existing media-store path (localStorage→IndexedDB→Firebase), never a new
one (recurring quota/sync hazard — see CLAUDE.md).

### 4.4 Daily-flow / end-of-day review (candidate)

DayFlow's Matrix → Flow → Review IA is a strong fit for Return's core loop (check-in → reflect →
act → recharge), which currently lacks a task-side end-of-day review (Done / Left / Hold). Candidate
for the Tasks page or a bridge into Recharge/Diary. Structure only — DayFlow's visuals are rejected.
Not started; needs its own proposal.

---

## 5. Page-by-page application notes

Per page: **keep** (structure the user validated — don't touch) / **fix** (surface cleanup) /
**refs** (which reference informs it). Detailed control lists live in
`docs/UI_FUNCTION_INVENTORY.md`; this is the intent layer. Nothing here is built yet.

- **나/Home** — *keep* the dashboard composition (banner, stickers, quick routine, signals). *fix*
  spacing rhythm, one clear primary per card, empty states. *refs* ref-1 calm dashboard.
- **인박스/Inbox** — *keep* fast-capture intent + feed/board views. *fix* compose bar (§4.3),
  category chip consistency. *open* SNS framing (§4.3).
- **일기/Diary** — *keep* the 7 fixed sections + Notion sync. *fix* section headers/spacing,
  editability affordance, image block controls. *refs* nagi-memo toolbar grouping if rich text grows.
- **루틴/Routine** — *keep* habits/bundles + weekly view. *fix* the dot-tracker rhythm & density.
- **할일/Tasks** — *keep* category sidebar, view-switcher, recurring rules (rated above refs).
  *fix* messy secondary-action placement accreted over time; consider §4.4 review step.
- **프로젝트/Projects** — *fix* toward ref-4 folder-card + progress-bar + favorite grid.
- **시간표/Schedule** — *keep* timetable grid. palette already pastel. *fix* slot edit affordances.
- **취미/Hobby** — *keep* tracker + banner. category colors now muted (§2.1.5).
- **음악/Music** — *keep* recommender + playlists. *fix* card/grid consistency with §3.2.
- **충전과 체크/Recharge** — *keep* check-in → AI read → recharge loop (the heart). *fix* calm
  palette already exists (`--calm-*`); align to the muted register.
- **기록/Records** — *fix* memo/insight cards, emotion-tag colors (verify saturation), trend charts
  (apply dataviz care). *refs* nagi-memo rich-text toolbar.
- **설정/Settings** — *keep* tabbed structure. *fix* nothing urgent; it's the most orderly page.

---

## 6. Application process (mandatory)

This section exists because past redesigns of this app **silently dropped features and broke rules
when a page was rewritten wholesale**. These steps are not optional.

**0. Adding vs. removing features (owner's rule).** The redesign scope is large — re-layouts and
new logic are expected. **New features may be added freely** (including reworking Theme Studio's
mechanism, §1.5). But **removing or disabling any existing feature — even partially — requires
asking the owner first.** The inventory-diff in step 4 is how you *detect* an unintended removal;
this rule is what you do about an intended one: surface it and wait for a yes before shipping.

1. **One page/component at a time — strangler-fig, never big-bang.** Redesign the markup/CSS of a
   single page while its JS functions and `id`/`data-*` hooks stay in place. Do not "pour in" a
   finished mockup.
2. **The binding contract is `id` + `data-*` + `onclick`.** A redesigned element keeps the same
   `id`, `data-*` attribute, or `onclick` target as its old counterpart. As long as that holds, the
   JS behind it needs no change — only the surrounding HTML/CSS does. Every entry in
   `docs/UI_FUNCTION_INVENTORY.md` for that page is a checklist item: it must still exist and be
   reachable afterward.
3. **Prefer read-chokepoint migrations over data rewrites** for anything that touches saved/synced
   state (colors, prefs). See the two shipped examples: `themeStudioUpgradeLegacyColorDefaults`
   (§2.1.3) and `upgradeCatColor` (§2.1.5) — they upgrade *on read* so they reach existing users
   and survive Firebase cloud round-trips, without mutating stored data or fighting a re-sync.
4. **Re-run the inventory + diff.** After the pass: `node scripts/generate-ui-inventory.js`, then
   `git diff docs/ui-inventory.json`. A hook or function that vanished from a page's section (and
   wasn't intentionally moved) is a **regression — block the merge and fix it.**
5. **Run `npm test` — never skip it.** Several suites load real functions out of `index.html` via
   `tests/lib.js`'s `sliceBlock`, anchored on literal text; moving/renaming a covered function
   breaks its test loudly. That is the safety net working, not a test to silence (CLAUDE.md). Add a
   test whenever you fix a sync/merge/storage/migration bug.
6. **Verify in the real app before merging** what the change actually renders (headless screenshot
   or the running PWA), and confirm contrast for any new color-on-color pairing (원칙: usability >
   aesthetics). Deploy = merge to `main` (GitHub Pages serves `main`; the service worker is
   network-first, so a merged change reaches the installed PWA on next online open).
7. **Every component/pattern in this doc must trace to a real inventory entry.** If a proposed
   component can't point to what it replaces, it isn't ready.
