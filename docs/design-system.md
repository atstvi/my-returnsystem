# Return — Design System

> **Status: DRAFT — in progress.** Sections are filled in one at a time and reviewed before
> the next one starts. Do not treat an unfinished section as final.
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
5. **Theme Studio is a constraint, not a target.** Users already customize accent color, density,
   radius, skin, and intensity at runtime. The design system defines the *default* state Theme
   Studio starts from and the token names it hooks into — it must never require changing how
   Theme Studio itself works.
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

**Verified:** `npm test` 31/31; headless render confirms rose logo/button + soft ink, no
breakage; and a stale-`return_theme_color=#C2433D` boot still resolves `--accent` to `#A75F66`
(Theme Studio's later override wins and self-heals the stored value) — so no manual reset needed.
A user's *own* custom accent is still respected (not overridden).

**Deferred (needs its own careful pass — touches stored user data):** the task-category /
emotion / timetable color palettes (`taskCategoryColorInputValue` fallback, the category swatch
array at ~line 19772) still contain the old reds; softening these to the warm-pastel family must
be done per-system, not by blanket token swap.

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

### 2.3 Spacing & radius — no new tokens, usage guidance only

`--sp-*` and `--r-*` already cover reference 1's proportions (generous padding, `r-lg`/`r-xl`
cards, `r-full` pills). The gap isn't the scale, it's *which* value gets used where after
features accreted — that's a per-component/per-page fix (§3/§5), not a token change.

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

## 3. Components — _not started yet_

## 4. Patterns — _not started yet_

(This is where the sidebar-vs-bottom-nav shell question and the Matrix/Flow/Review idea land —
deliberately deferred until tokens are settled, per constitution §"structure before decoration"
applied to our own process: get the foundation agreed before the shell decision.)

## 5. Page-by-page application notes — _not started yet_

## 6. Application process (mandatory) — _not started yet_
