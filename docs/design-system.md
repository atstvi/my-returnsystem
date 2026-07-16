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

**Keep unchanged:** the accent scale (`--a-*`) and its Theme Studio binding, the semantic
success/warning/danger scale, the full dark-mode override block (`index.html:266-276`), and the
elevation shadow *values* (see §2.4 for usage guidance instead).

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

*Open question for you: this is a deliberately small, low-risk shift. If you want the mauve
mood to read more strongly than this, tell me and I'll push it further — but I'd rather
under-shoot and adjust than repeat the "everything broke" pattern with a bigger palette swing.*

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
