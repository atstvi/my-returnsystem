# Return — Design System

> **This is the authoritative "DESIGN.md"** referenced by `docs/REDESIGN_WORKFLOW.md` — the
> highest-priority source of truth for all UI/UX decisions. Source hierarchy for any redesign:
> **(1) this document → (2) `docs/UI_FUNCTION_INVENTORY.md` (functional truth) → (3) reference
> materials (§0, inspire don't copy).** The workflow governs *how* a redesign is carried out; this
> governs *what* the design is.
>
> **Status — §2 (tokens/color), the app shell (§4.1), and the 나/Home + 할일/Tasks tabs are SHIPPED.** §3
> (components) documents the real, current vocabulary (updated as Home was built). §6 (application
> process) is the decided workflow. §5 is now part intent / part done-record: the **나/Home** (§5.1)
> and **할일/Tasks** (§5.2) entries are built records; the other tabs are still the intent layer and
> get scoped approval before code. Reference §7 for the distilled **one-tab redesign playbook**.
>
> **This document is a constraint, not a mood board.** Every component and pattern below must
> name the exact page/control in `docs/UI_FUNCTION_INVENTORY.md` it replaces. If a redesign pass
> can't point to that mapping, it is not ready to ship — see "적용 프로세스" (§6).
>
> **Design north-star (owner's mood keywords, reference only):** `#생산성` ·
> `#SNS(X)-앱st` · `#MZ·20대 여성st` · `#세련·깔끔`. Read as: a **productivity** tool that feels as
> effortless and modern as a well-made social app (clean feed/card rhythm, light-touch interactions —
> *the polish of X/SNS, not its noise or vanity metrics*), tuned to a **20s-women / MZ** sensibility
> (soft dusty-rose palette, rounded, airy, tactile), landing on **refined + clean** over busy or
> cute. These are vibe cues to weigh against §1 principles (usability always wins), **not** a license
> to add social features or decoration for its own sake.

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

**Dark mode — FIXED (was: flagged).** Theme Studio's boot override used to pin
`--bg-page`/`--bg-card`/`--fg`/`--border`/`--sidebar-*` on `:root` as light literals, which
overrode `html[data-mode="dark"]` — so choosing 다크 changed almost nothing. Fix (in
`themeStudioApply`): the accent + typography + card-media vars stay on `:root` and self-adapt
(their `color-mix()` refs resolve `--bg-card`/`--fg` to the dark palette); the **neutral
surface/ink/sidebar colors are emitted under `html:not([data-mode="dark"])`** so dark falls
through to the dark palette + the base `var(--n-*)` fallbacks. The dark block also got explicit
`--border-subtle` / `--sidebar-bg` / `--sidebar-fg` / `--sidebar-active`. Light mode is
byte-identical; verified light + dark headlessly across pages. **Rule going forward:** never emit
a user's light color literal on bare `:root` — scope surface/ink literals to `:not([data-mode="dark"])`.

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

One input look across the app: `1px --border`, `--r-md`, `--bg-card`/`--bg-raised` fill. Labels
sit above or inline-left at `--text-xs`/`--fg-3`. Placeholder text is `--fg-4`. A field that's
editable must *look* editable (원칙 1 "is this editable?").

**Focus highlight — accent, not the teal ring.** The legacy `--focus-ring`
(`0 0 0 3px rgba(58,155,133,.22)`) is **teal** and clashes with the rose theme. The direction
(applied to the capture bar) is a clean **accent** focus: `border-color:var(--accent)` +
`box-shadow:0 0 0 3px var(--accent-light)`. New/redesigned fields should use the accent focus;
migrate `--focus-ring` usages as pages are touched (don't mass-replace blindly — it's used
widely, so change per-page with a visual check).

### 3.5 Modal / overlay

`.overlay` (scrim) + `.modal` with `.modal-head` / `.modal-body` / `.modal-foot`. This is the only
floating-panel pattern — `--elev-3`, `--r-xl`. **Centered on every viewport** (no bottom-sheet
variant — owner decision: todomate's value was its *button placement / framing*, not the sheet
form). Esc + scrim-click close; focus moves into the modal.

**Footer action placement (unified, applied).** Mental model: **dismiss bottom-left, commit
bottom-right.** The leading dismiss/secondary — a `.btn-ghost` that is not the only button — is
pushed to the far left (`.modal-foot > .btn-ghost:first-child:not(:only-child){margin-right:auto}`);
the `.btn-primary`/`.btn-danger` commit stays right. A lone button keeps its right alignment.
Button *order in markup stays* `[ghost dismiss …, primary commit]` so a 3-button footer reads
secondary-left / cancel+commit-right. One button system only: `.btn` + `.btn-ghost` /
`.btn-primary` / `.btn-danger` (the stray unstyled `.modal-btn` was removed).

**Confirm dialog is fit-to-purpose.** `openConfirmDialog(title, message, onConfirm, opts)` —
destructive by default (`btn-danger` "삭제", since legacy callers are deletes); pass
`{danger:false, confirmText:'…'}` for a neutral `btn-primary` confirm so the button language
matches the action. Prefer it over native `confirm()` (which breaks the unified look/brand).

**Icons inside dialogs use the app SVG line-icon set** (24-grid, ~1.8 stroke, `currentColor`) —
not text glyphs (`✓ ✕ ↗ ◈`), so every window reads as one family.

### 3.6 Toggle

`.toggle-wrap` / `.toggle-track` / `.toggle-thumb` — the single switch component. On = `--accent`
track. Don't substitute a checkbox where a toggle is the established control, or vice-versa
(consistency).

### 3.7 Quick-capture bar (`.capture-inner`) — DONE

The top-bar quick-capture composer (`homeCapture`, ids `capture-inp` / `capture-inbox-btn` /
`capture-task-btn` / `capture-send`). Shipped form:
- **Field:** rounded `--r-lg` (not a full pill), `1px --border-subtle`, `--bg-card`, a leading
  `.capture-lead` **+ icon** (SVG, `--fg-4`, turns accent on focus). Accent focus per §3.4. The
  input has **`min-width:0`** (without it the field won't shrink and overflows the action icons on
  mobile) and **no placeholder** (a long placeholder overflowed on mobile).
- **Mode selector:** Inbox/Task as one compact **segmented control** (`.capture-modes`, right
  side), active segment = `--bg-card` chip on a `--bg-raised` track.
- **Send button:** hidden at rest (`width:0;opacity:0`), **expands + fades in only while the field
  is active** (`:focus-within`), smooth transition; `onmousedown:preventDefault` keeps it from
  blurring the field mid-click.

### 3.8 Empty / first-use states — one calm pattern

Every card states its empty case rather than showing a blank box (Phase 6). The reusable shape is
`.hw-empty` (SVG icon + short message + optional CTA); the Home widgets (values/music), the
오늘 할일 all-empty prompt, and the 타임블록 empty (with a "밀린 할일 N개 오늘로" action) all follow
it. Use a muted accent glyph, one line of copy, at most one CTA. An empty state is part of the
product, not an afterthought.

### 3.9 Section-header icons (`.sec-ico`)

Every dashboard card header leads with a small **SVG line icon** (`.sec-ico`, 24-grid, ~1.7
stroke, `currentColor`) before its `.sec-label` title, so cards read as one family. No card header
is icon-less; no emoji/glyph headers.

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

**Top bar — DONE (Home redesign 5d).** The 14 `height:100vh` page-containers were wrapped in a
content column `.app-main` = `.app-topbar` (persistent, 60px desktop / 52px mobile) + `.page-stack`
(flex:1); `.page-container` height became `100%` so pages fit under the bar with no overflow, and
the mobile `100dvh` rule was reconciled the same way. Instead of shipping a non-functional search
box (원칙 13), the **search slot holds the quick-capture composer** (`.capture-bar`) — see its
shipped form in **§3.7**. The topbar background is `--bg-card` (white, matches content); the
installed-app titlebar (`theme-color` meta) is a **lightened** tint of the accent, not the raw
accent. Right zone: notification/music/**settings** icon buttons. The sidebar **설정** tab was
removed; settings stays reachable via the gear and the sidebar profile button. Focus-mode hides
the bar like the sidebar (reveal on hover/focus).

Still logged for a later top-bar pass (not yet built): a real global search backend, a two-zone
per-page action layout (view controls | doc actions — 나기메모), clock, notifications,
long-press-to-edit stickers.

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

### 4.5 Two-column masonry with equal-height fill (Home) — DONE

Chrome has no `grid masonry`, so a dashboard that must avoid per-card gaps uses **two independent
flex-column stacks** inside a 2-col grid (`align-items:stretch`, both columns `grid-row:1`), routed
by JS (`normalizeHomeLayoutOrder` → `#home-col-l` / `#home-col-r`); on mobile they collapse via
`display:contents` + `order`. The **last card of each column** flexes to equalize the two column
bottoms with the full-width row below. Use **`flex:1 1 0`** (not `1 1 auto`) on a last card whose
own content is tall/scrollable (e.g. the 타임블록 timeline) so its intrinsic height does **not**
drive the column (which balloons it and breaks alignment); the scroll body then `flex:1;
min-height:0; overflow:auto` fills the card and its grid `align-items:stretch` + `min-height`
extends downward instead of leaving empty space. A fixed `max-height` cap on the last card only
aligns by coincidence — don't.

---

## 5. Page-by-page application notes

Per page: **keep** (structure the user validated — don't touch) / **fix** (surface cleanup) /
**refs** (which reference informs it). Detailed control lists live in
`docs/UI_FUNCTION_INVENTORY.md`; this is the intent layer. **나/Home is built (§5.1); the rest are
intent.**

### 5.1 나/Home — SHIPPED (reference implementation for the other tabs)

The first fully-redesigned tab; it's the worked example the §7 playbook is drawn from. What landed:
- **Layout:** two-column masonry with equal-height fill (§4.5) — left = 날짜 → 배너 → 오늘 할일 →
  타임블록; right = 오늘 상황 → 오늘 습관 → 처리 필요 → 빠른 메모; full-width 타임그리드 below.
  Both columns' last cards align to the timegrid with no gaps.
- **Surfaces:** white content canvas (`.home-page` = `--bg-card`), **flat borderless cards**
  (border dropped, `--elev-1` only) so it reads as an airy sheet, not a grid of boxes. Every card
  header has a `.sec-ico` (§3.9).
- **Cards:** 오늘 상황 (situation + signal pills + upcoming preview); 오늘 습관 with a per-habit
  **last-7-days mini-streak**; 오늘 할일 eisenhower quadrants with an **all-empty prompt + CTA**;
  빠른 메모 flex-widget (memo/values/photo/music) with a **hover-only type picker** and unified
  empty states (§3.8); 처리 필요 inbox list with per-item type icons; 타임블록 vertical scheduler
  with an **empty state that pulls overdue tasks (밀린 할일 오늘로)**; 타임그리드 canvas whose
  **legend colors match the pill `--task-pal-*` tokens** and which draws **same-row U-arcs and
  cross-row dashed connectors** for task↔deadline links (fixed first-paint via ResizeObserver).
- **Task links:** the modal now shows **reverse links** ("연결된 할일" — which tasks point at this
  item), since the link is stored one-way.
- **Chrome:** redesigned quick-capture bar (§3.7); white topbar; lightened titlebar.
- **Modals/dialogs:** unified footer + confirm + SVG icons (§3.5).
- Everything verified headlessly (14 pages 0 overflow/errors, light+dark), inventory 0 lost.

### 5.2 할일/Tasks — SHIPPED (second tab; applied the §7 playbook)

Structure kept intact (category sidebar, calendar, view-switcher, recurring rules — rated above
refs). Audit + backlog in `docs/tasks-tab-audit.md` (T1–T10). What landed, by priority:
- **P0 — chrome icons → SVG:** calendar controls (콤팩트/마감 뷰/시간표/완료 숨김) and list-header
  buttons (선택/검색/추가/더보기) moved from emoji/glyphs to line SVGs. Toggle labels update via a
  `.ctrl-label`/`.ctrl-label`-span so the SVG persists across `renderCal` re-renders.
- **P1 — surface + states + identity:** `.list-panel` → flat white canvas (`--bg-card`, matches
  §5.1). Category **filter chips gain a color swatch**
  (`.cat-chip-swatch` = `normalizeTaskCatColor(cat.color)`) for at-a-glance ID while keeping the
  user emoji. (검색/필터 row was already a modal — `openTaskSearchModal` — inline row is `display:none` legacy.)
- **P2 — chip/dialog polish:** quick-add chips → **color dots** (priority level color, category
  color) + calendar SVG for deadline (`.add-chip-dot`/`.add-chip-ico`; `updateAddChips` only
  rewrites `.add-chip-label` so icons survive). Bulk-action bar → line SVGs, delete = danger.
  Destructive `confirm()` (bulkDelete/bulkDeleteDone/openNameDelete/single-delete) → `openConfirmDialog`
  danger dialog with a `confirm()` fallback.
- Verified headlessly (chips/bulk render, dots colored, 0 pageerrors), `npm test` green, inventory
  0 hooks lost (removed tokens = retired emoji labels only). Remaining: 취미탭 `confirm()` deferred
  to the Hobby pass.

**활성 규칙 (active-rule) system — clearer + multi-period.**
- Dropped the per-row `규칙`/`반복` type badge (the section header already labels them); ops-row
  edit/delete are now line SVGs.
- **Rules can have multiple active periods.** New model field `rule.dateRanges` = `[{start,end}]`;
  `ruleDateRanges(rule)` reads it with a legacy `startDate`/`endDate` fallback, and `ruleDateInRange`
  returns true if the date is in **any** range (empty = always active). The generation path
  (`buildExpectedGeneratedMap` weekday loop) now iterates the whole horizon and lets `ruleDateInRange`
  gate, so one or many periods work; `reconcileGeneratedTasks` prunes tasks that fall outside.
- **`taskCreateRangePicker(mount, ranges)`** — reusable mini-calendar: tap start→end to add a period,
  periods show as removable chips and highlight on the grid (`.mrp*` styles). Exposed to
  `openFormDialog` as a new `type:'dateranges'` field; `openFormDialog` also gained inline `help`
  text under any field's label. The rule editor now uses plain-language labels + help + the picker.
- Ops-row meta shows `기간 05.07~06.07` for one period or `기간 N개` for several (`opsFmtRange`).
- **반복 할일 editor gets the same treatment.** Plain-language labels + help ("얼마나 자주?",
  "무슨 요일에?", "매월 며칠에?", "활성 기간") and a **single-window** calendar picker
  (`taskCreateRangePicker(..., {single:true})` via the `single` field flag) for the repeat's active
  window, mapped to the existing `startDate`/`endDate` (empty = 계속 반복). Repeat ops-row meta shows
  `기간 …` to match rules.
- **Task edit modal → SVG icons.** The 할일 편집 modal's 14 row icons (`.mr-icon`) were emoji
  (📆⏱️📅⭐🔁⚡🔗🗂️🏷️🔥🗓️🚶🧳) in colored tint chips; converted all to SVG line icons
  (`.mr-icon svg` uses `currentColor` so the `ic-*` tints still color them). The footer **작업대**
  button's `🖥` (which rendered as a broken glyph) → an SVG monitor icon (`.btn svg` sizing added);
  삭제 gets a subtle danger hover; `.foot-tag` no longer wraps.

**Reusable patterns this pass added** (available to later tabs): `.cat-chip-swatch`/`.add-chip-dot`
color-dot on a chip for category/priority identity; the "icon in a leading span, JS updates only the
label span" rule for any chip/button whose text is re-rendered (prevents wiping SVG).

**Category bars stay visible + calendar left-aligned (revision).** Per the owner, every category
bar renders even with 0 items (empty categories no longer collapse to a single prompt, and the
`.cat-empty` header keeps full opacity — only its count reads muted) so adding via each bar's `+`
is always one tap away. Separately, the Tasks **calendar column is aligned to the capture bar AND balanced**, to match how
Home reads (Home content sits at the capture-bar's left edge with symmetric padding). The narrow
296px panel couldn't do both, so the panel was widened to **376px** and given **symmetric**
horizontal padding (`clamp(16px,3vw,40px)` on both sides of `.cal-header`/`.cal-grid-outer`): the
grid's left edge lands on the capture bar (256≈256) while left/right margins stay equal (~40/40).
The view controls (콤팩트/마감 뷰/시간표/완료 숨김) were compacted (`.ctrl-btn` padding `--sp-3`,
`.cal-controls` gap `--sp-1`) so they fit on **one row** in the wider panel instead of wrapping.

**Follow-up refinement (task row + menus):**
- **Task item priority** no longer uses a left-border bracket (the curved stripe read as clunky
  against the flat sheet). Priority is now the **checkbox ring color** via a `--ck-ring` CSS var set
  on the row (`.task-item.pri-*` and Home `.ti-*`): high=`--danger`, mid=`--warning`, low=`--success`,
  none=`--border-strong`; done stays a solid filled check. `.task-check` reads
  `box-shadow:0 0 0 1.5px var(--ck-ring,var(--border-strong))`, so hover/done override cleanly with
  no specificity fight. This keeps the circle/dot language consistent with the chips and applies to
  **both** the Tasks list and the Home 오늘 할일 list (same `.task-item`).
- **Dropdown menu** (`.menu-pop`/`.menu-item`/`.menu-sep`) — reusable popover: rounded card,
  SVG line icons in a muted `--fg-4`, `danger` variant tints red on hover (`--d-50`), a `.menu-sep`
  divider to group destructive actions apart from safe ones. First applied to the Tasks 더보기 menu.
- **Top breathing room / density.** The Tasks headers used the same `--sp-8` top padding as the
  content, so the dense `.cal-header`/`.list-header` (with their `border-bottom`) sat only ~16px
  under the white topbar and read as a cramped echo of it — versus Home, where content floats airily
  on the canvas. Bumped both headers' top padding to `--sp-12` (16→24px), enlarged the `.list-date`
  "오늘" heading (`--text-lg`→`--text-xl`, with a `20px` fallback since `--text-xl` is theme-only),
  relaxed the header internal spacing, and gave `.list-scroll` a small top padding so the first
  section clears the header line. Result: a clearer, calmer separation from the topbar.
- **활성 규칙 · 반복 할일 panel → on-demand modal.** The rule/repeat management widget no longer
  sits permanently at the bottom of the task list (it's occasional-config, not daily-glance). Its
  seed `.rules-box` was relocated into a hidden `#ops-overlay` modal; `ensureHomeOpsPanel()` builds
  `#home-ops-section` inside the modal body (same code, same ids/handlers), and a new 더보기 menu
  item (`openOpsModal`/`closeOpsModal`) pulls it up when needed. `.ops-modal` flattens the wrapped
  card (transparent, no shadow) and hides the panel's duplicate `.sec-label`. NB: the inventory
  scanner is page-boundary based, so moving `home-rule-btn`/`home-repeat-btn`/`rule-card-btn` out of
  `#page-tasks` into the top-level overlay reads as "lost from the tasks page" — the ids and their
  listeners are unchanged and still bind; nothing is functionally removed.

### 5.3 루틴/Routine — SHIPPED (structural "do-first" redesign)

The old tab read like an admin spreadsheet (every row packed with 편집·삭제·선택▼·×·↑↓·▶, completion
via a slow `선택 ▼` dropdown, intensity hidden, library eating half the screen). Rebuilt around
*doing today's routine* (owner-confirmed direction + tap-to-complete). Full audit:
`docs/routine-tab-audit.md`.
- **Do-first header**: date + **overall progress ring** ("오늘 N/M") + prominent **Mini·Plus·Max
  intensity segment** (was hidden). Management (새 습관/새 묶음/오늘 초기화/습관 보관함) moved to a
  `⋯` menu (`.menu-pop`), so the daily surface stays clean.
- **Bundle do-cards**: header = bundle emoji inside a **progress ring** + slot + ▶ 루틴 시작 (timer
  preserved) + `⋯` (습관 추가/순서/편집/삭제). Habit rows = **round tap-checkbox** (done↔none, like
  Tasks) + title + selected-intensity plan; 건너뜀/쉼 live in a per-row `⋯` popover. done/skip strike
  through; rest = periwinkle dash.
- **습관 보관함 → modal** (opened from `⋯`), so it doesn't compete with the daily view.
- **Weekly → heatmap**: 7-day cells with intensity levels (`.rt-week-cell.lv1/2/3`) + stats
  (오늘 완료 / 연속 달성 streak / 쉼).
- Implemented as **final render overrides** (`renderRoutineHeader/Conditions/Bundles/Stats/Routine`)
  that reuse every existing helper (timer/play, difficulty, CRUD, logs, Notion, Home quick-routine),
  so all functionality is preserved; the flat white canvas (`--bg-card`) matches §5.1/§5.2.
- **Header polish + single-column + compact stats (owner course-correction).** The 2-column
  "잔디밭" gamification was rejected as cliché/over-built; gamification dropped. Now: **single centered
  column** (`.routine-shell` `max-width:720px; margin:0 auto`) — balanced, not lopsided. Title sized
  to the scale (`.rt-title` → `--text-xl`, was `--text-2xl` — the oversize was the design-system
  slip the owner flagged). The header's progress + intensity are grouped in a **composed `.rt-status`
  panel** (soft `--bg-raised`, rounded) so it reads finished, not sparse. Stats collapse to **one
  tidy card**: 오늘 완료 / 연속 기록 / 이번 주 % + a single **compact aggregate heatmap** (`renderRoutineBoards`
  → `#rt-boards.rt-heat`, 10px GitHub-style cells, `--accent`, "최근 기록" label) — small and cute, no
  per-routine colored boards, no 🔥 streak-as-game.
- **Alignment + per-habit intensity (refinement).** The content column is left-aligned to the capture
  bar (`clamp(16px,3vw,40px)` inset, `.routine-shell` `max-width:860px;margin:0`) so its left edge
  matches the search bar (256=256), unified with Home/Tasks. Each habit row shows an **intensity
  chip** (`.rt-plan-chip`) that displays the *custom level name* the user set (e.g. "물 한 컵 마시기")
  plus a Mini/Plus/Max tag — not just "Mini"; tapping opens `.rt-diff-menu` listing every level by
  its custom name. Effective level = per-habit override (`log.difficulty`) → today's global 오늘 강도
  → first defined (`rtEffectiveDiff`), so the top segment is a quick "set all" default and the chip
  is the per-habit override.
- **Unified time-of-day icons + richer heatmap + menu-flash fix (refinement).**
  - **모닝/오후/저녁 line icons.** Time-of-day bundles now render a cohesive **line SVG** in the ring
    instead of a stray emoji: `rtSlotIcon(bundle)` matches the title/slot (아침·모닝·오전 → sunrise,
    오후·점심·낮 → sun, 저녁·밤·취침 → moon, Feather-style) and returns `.rt-slot-ic` (`currentColor`
    stroke, `--fg-2`); non-time bundles keep their custom emoji. Uniform with the app's §3.9 icon set.
  - **Heatmap bigger + more legible.** The aggregate `#rt-boards` grew from 10px bare cells to a small
    **calendar heatmap**: 13px cells, **month labels** (`.rt-heat-months`), **weekday labels** (월·수·금,
    `.rt-heat-days`), a **적음→많음 legend** (`#rt-heat-legend`), and a per-day **tooltip** (`M월 D일 · N/M 완료`).
    16 weeks, scrolls horizontally, scrollbar hidden. Still one tidy card — informative, not gamified.
  - **Menu open-flash fixed (app-wide).** `.menu-pop` played `menu-in` without a fill-mode, so a menu
    switched `display:none→block` painted one frame at full opacity **before** the animation's `from`
    (opacity:0) applied — a visible flash-then-fade ("깜박 한두번"). Added `animation-fill-mode:backwards`;
    headless trace confirms opacity now starts at 0 (no opaque first frame). Fixes every `.menu-pop`.
- **Cleaner surface + on-demand stats + row interactions + timer polish (owner course-correction).**
  - **No black stat numbers.** The 오늘 완료/연속 기록/이번 주 numeric tiles (`#routine-stats`) were removed
    from the surface; the heatmap is the statistic. The timer toast header dropped its `· N/M` counter.
  - **Stats on demand (2-column slide-in).** The shell is now left-aligned to the capture/search bar
    (`.routine-shell` `flex-direction:row; margin:0`, `.rt-left` `max-width:720px`) — verified 254=254.
    Stats are hidden by default; a header 통계 toggle (`#rt-stats-btn`, bar-chart icon) adds `.stats-open`,
    revealing an `.rt-side` (300px) that **slides in from the right** (`@keyframes rt-side-in`), making a
    2-column layout. ≤900px it wraps below. The heatmap + legend live inside `.rt-side`.
  - **Habit-row interactions.** Removed the per-row `⋯` state button. The right slot is now a **drag
    handle** (`.rt-drag`, reveals on hover, always faintly visible on touch) that **reorders habits within
    a bundle** via pointer drag (`rtStartHabitDrag`, mouse+touch, commits to `bundle.habitIds`). State is
    now chosen by **long-pressing the left check** (tap = 완료 toggle, ~420ms hold = state menu); each menu
    item (완료/건너뜀/쉼/선택 안 함) gained a leading line **icon** (check / arrow / coffee / no-symbol).
  - **Timer compact fix + movable window.** The compact (small-window) timer overflowed its card; added
    `max-height` + `overflow-y:auto` and `width:100%` on inner fixed-width rows so it stays contained. The
    non-functional 🔇 mute icon was replaced with a **move** control (`#routine-timer-move`).
- **Free-drag mini window + labeled levels + right-column photo banner (owner course-correction).**
  - **Compact timer = free drag.** The corner-cycle read as "위치 조절 안 됨"; replaced with **pointer
    drag** on the move handle (`rtApplyTimerPos` + `routineTimerPos`), clamped to the viewport and
    reapplied across re-renders (the 1s tick only repaints the clock, so a drag isn't interrupted).
  - **Mini/Plus/Max are identifiable in the timer.** `routineTimerDifficultyControls` chips now show the
    level's **custom plan text** under the label (`.rt-diff-chip` → `.rtc-lv` + `.rtc-tx`), so you can tell
    what each level is from the mini window, not just "Mini/Plus/Max".
  - **Right column always populated.** The layout is now always 2-column: `.rt-side` shows a
    **photo-attachable banner** (`#rt-banner`, `renderRoutineBanner`) by default and the stats panel when
    통계 is toggled. The banner stretches to the left column's height (`align-self:stretch` + `flex:1`;
    verified 398=398), reuses the home-banner media pipeline (`fileToBannerDataUrl` →
    `returnMediaStoreDataUrl` → `returnMediaResolveUrlWithFallback`), stores `routine_banner_v1`
    (added to `DATA_KEYS` + `RETURN_DATA_MAP.banners`; `syncDataUrl` inline ≤180KB), with 사진 추가 /
    변경 / 삭제 controls.
- **Timer view bugfixes + vertical month-calendar heatmap + softer surfaces (owner course-correction).**
  - **Mini-timer freeze / broken fullscreen fixed.** Returning to fullscreen after dragging left the
    dragged inline `left/top` on the element, so the overlay wasn't full — now the full branch clears the
    inline position. And `renderRoutineTimerToast` **self-heals** the tick interval (re-arms it if
    `startedAt` is set but `timer` is null), so a lost interval on view-switch/sync-rehydrate no longer
    freezes the clock.
  - **Heatmap → stacked month calendars.** Replaced the horizontal week-column grid with **vertical
    monthly calendars** (`rtMonthCells` + `renderRoutineBoards`): the last 3 months stack top→bottom
    (records flow down), each with a full **월~일 weekday header** (Monday-start) and week rows of day
    cells (numbered, colored by completion, today ringed). Panel scrolls internally (`max-height`).
  - **Softer surfaces (less "raw"/pointy).** Timer difficulty chips (`.rt-diff-chip`) went from bordered
    stadium pills to soft tinted **rounded rectangles** (label + custom text), and the state buttons
    (`.routine-timer-state-big`) dropped their hard 1px border for a filled `--bg-raised` fill with a
    rounder radius — removing the boxy/edgy read.

- **Shared stamina slider — 오늘 강도 ↔ 지금 에너지 (one value across pages).** The routine `오늘 강도`
  (Mini/Plus/Max) and the 충전 check-in `지금 에너지 수준` (방전 직전…충전 완료) are now the **same
  confirmed slim slider** (시안 C) bound to **one per-day value** (`stamina_level_v1`, 0–100). Routine
  reads it as 3 bands → `routineCondition`; check-in reads it as 5 bands → `currentEnergy` + suggestion.
  **Adjusting it anywhere reflects everywhere** (`staminaStore` derives both + `staminaPaintAll` repaints
  every mounted `[data-stamina-bar]`). The fill/knob track the finger **1:1** during drag (`.drag` kills
  the transition). **The bar is identical in both tabs** — same fill, same knob — the *only* difference
  is the top-right interpretation label (`.stm-cur`: 루틴 = Mini/Plus/Max, 충전 = 에너지 수준). The
  bottom tick labels were removed. One unified color ramp (`STAMINA_RAMP`, `staminaFill`): a rose that
  warms + brightens toward full (soft rose → coral → apricot → bright gold). The knob always shows the
  5-band emoji (🪫😴😐🙂⚡) or, if set, its **per-band photo**; the photo-attach UI lives in
  **Settings → 테마·외관 → 에너지 단계별 사진** (`#stamina-photo-settings`, `staminaRenderPhotos`), not on
  the check-in card. `stamina_level_v1` + `stamina_photos_v1` are in `DATA_KEYS` + `RETURN_DATA_MAP.stamina`.
  Built as `staminaBuild`/`staminaPaint`, mounted in `renderRoutineConditions` (routine) and
  `staminaMountEnergy` (check-in).

- **타이머/Timer — 한 화면 통합 + 진행 링 + 오늘의 집중 (owner-approved big redesign).** The
  타이머 console and 집중 기록 were two separate screens; they now share **one screen**. The top
  segment is `오늘`/`주간 기록` (`data-ft-view` hooks kept). **오늘** is a 2-column `.ftu-grid`:
  **left** = the full timer console (모드·소리·할일 연결·설정 all preserved), with the flat progress
  bar replaced by a **progress ring** wrapping the clock (`.ftu-ringwrap`/`#focus-timer-ring`,
  driven live by `focusTimerTick` via `stroke-dashoffset`; stopwatch shows the track only). **right**
  = an **오늘의 집중** card (`focusTodayHtml`/`focusTodayAggregate`, pure): today total · 세션/평균/
  포모 mini-stats · an **hour-grid timeline** of today's sessions (mode-colored blocks) · a **recent
  record list** (mode color dot + name + completed-time), tap-to-delete + `+ 직접 추가`
  (`#ft-today-add` → `focusTimerManualAdd`). **주간 기록** keeps the existing weekly grid. Mode palette
  softened + unified across today/weekly/records (`_ftModeColor`: `#E08A5B` 포모 / `#4FB0A6` 카운트다운
  / `#9B8CF0` 스톱워치; `--pom/--cd/--sw` on `#focus-timer-root`). Ref (subject stopwatch + record
  list + hour timeline) restated in Return terms; **task-linking kept** (no subject/category concept).
  See `docs/timer-tab-audit.md`. No functionality removed (§6.0); inventory diff = line-number churn only.

- **인박스/Inbox** — *keep* fast-capture intent + feed/board views. *fix* compose bar (§4.3),
  category chip consistency. *open* SNS framing (§4.3).
- **일기/Diary** — *keep* the 7 fixed sections + Notion sync. *fix* section headers/spacing,
  editability affordance, image block controls. *refs* nagi-memo toolbar grouping if rich text grows.
- **루틴/Routine** — SHIPPED (§5.3). Structural do-first redesign.
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

---

## 7. One-tab redesign playbook (distilled from the 나/Home pass)

The repeatable loop for redesigning the remaining tabs, as actually run on Home. It sits on top of
`docs/REDESIGN_WORKFLOW.md` (Phases 1–8) and §6 above (the engineering safety net); this is the
condensed operating procedure.

**A. Understand + functional-audit the tab first.** Read the real code in `index.html` (grep the
`render*`/`open*` functions for the tab) and its `docs/UI_FUNCTION_INVENTORY.md` section. List
every control, interaction, and stored/synced key. Nothing may silently disappear (§6.0/§6.4).

**B. UX audit (Phase 3).** Assume every existing decision is questionable. Hunt: needless clicks,
weak hierarchy, inconsistent interactions, poor discoverability, missing states, native
`confirm()`/glyph icons that break the unified language. Write it down (a per-tab audit doc, like
`docs/home-tab-audit.md`) with severity — it becomes the backlog.

**C. Decide the visual target against §2–§4**, not against the reference screenshot. Reuse the
shipped components (§3): `.btn` hierarchy, flat cards (§3.2), tint+ink chips (§3.3), accent focus
(§3.4), unified modal (§3.5), capture/compose bar (§3.7), empty states (§3.8), section icons
(§3.9), masonry (§4.5). A reference inspires a *principle*; restate it in Return's terms.

**D. Implement strangler-fig (§6.1–6.2).** Redesign markup/CSS while keeping every `id` /
`data-*` / `onclick`. One coherent change per commit/PR. Prefer read-chokepoint migrations for
saved/synced state (§6.3). **Don't guess in the sync/theme/timegrid footgun areas — reproduce a
bug headlessly before changing guard/merge logic** (CLAUDE.md); the Home timegrid link bug and the
dark-mode bug were both fixed only after a real repro.

**E. Design every state (Phase 6).** empty / first-use / loading / offline / overflow / long &
short text / single & zero & many items / destructive-confirm. Use the §3.8 pattern.

**F. Verify headlessly before every push.** Playwright render at desktop + mobile (and light +
dark for anything touching color): screenshot, and *measure* the specific thing you changed
(alignment px, overflow, computed tokens) — don't eyeball. Then `node
scripts/generate-ui-inventory.js` + diff (**0 functions lost**) and `npm test` green.

**G. Ship in small reviewable PRs and iterate on owner feedback (Phase 8).** Show a screenshot,
state what changed and how it was verified, let the owner react, refine. **Surface conflicts /
composition changes and get a yes before making them** — don't silently change the agreed layout
to solve a secondary problem.

**H. Reconcile this doc, both directions.** When the pass lands, update §3–§5 so the doc matches
what shipped (new component → add it here; "flagged" → "fixed"; intent → done-record). The doc and
the code must never drift — that reconciliation is itself a step, not optional.
