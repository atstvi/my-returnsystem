# UI Redesign Workflow

> The governing process for redesigning Return. Adopted verbatim from the owner's brief.
> It sits **above** the design system in authority for *how* a redesign is carried out; the
> design system (`docs/design-system.md`, the "DESIGN.md" below) governs *what* the design is.

Redesign an existing product while **preserving and improving its functionality**. The result
must be simultaneously: visually exceptional · highly usable · cognitively effortless · complete ·
faithful to the existing product. A successful redesign improves both aesthetics and usability —
never sacrifice one for the other.

---

## Source Priority

1. **`docs/design-system.md` (the "DESIGN.md", highest priority)** — design philosophy and
   constraints; the source of truth for all UI/UX decisions. Every decision must comply with it.
2. **`docs/UI_FUNCTION_INVENTORY.md`** — the functional source of truth. Every existing feature,
   control, interaction, shortcut, menu, and workflow must be accounted for. Nothing may disappear
   accidentally. Every inventory item maps to an equivalent or improved UI element. If something
   can't be mapped, **explain why before removing it** — and per DESIGN §6 step 0, **ask the owner
   first**. Never silently remove functionality.
3. **Reference materials** — inspire, don't copy. Extract principles (interaction patterns,
   hierarchy, layout, navigation, typography, spacing, motion, composition, density). Do not
   imitate screens. (Logged in `design-system.md` §0.)

---

## Workflow

**Phase 1 — Understand.** Before changing anything, understand the feature: primary goal,
secondary goals, required information, required actions, dependencies, edge cases. Don't redesign
what you don't fully understand.

**Phase 2 — Functional Audit.** Compare the current UI against `UI_FUNCTION_INVENTORY.md`. Build a
one-to-one mapping: *existing function → redesigned function*. Nothing disappears or becomes
inaccessible. If functionality changes, justify it (and ask first if anything is removed).

**Phase 3 — UX Audit.** Assume every existing decision is questionable until it proves value.
Hunt: unnecessary clicks, cognitive friction, inconsistent interactions, weak hierarchy, poor
discoverability, navigation problems, accessibility issues, confusing terminology, inefficient
workflows. Don't preserve poor UX just because it exists.

**Phase 4 — Visual Design Exploration.** Don't settle for "modern and clean." Commit to one
coherent visual language (here: *Calm Warm Minimal*, DESIGN §1.2). Intentional, memorable,
art-directed. Every type/space/color/icon/composition/rhythm decision reinforces the direction.
Beauty is a requirement — but never decoration to compensate for weak UX.

**Phase 5 — Redesign.** Improve IA, navigation, interaction flow, hierarchy, typography, spacing,
consistency, accessibility, discoverability, aesthetics. Question every click, element, and layout
decision. If it exists, it needs a reason.

**Phase 6 — Design Every State.** Never only the happy path. Design: loading, skeleton, empty,
first-use, onboarding, no-results, validation errors, server errors, offline, slow network,
disabled, success feedback, destructive confirmation, long/short text, overflow, single item,
zero items, very large datasets. Every state feels part of the product.

**Phase 7 — Validation.**
- *Functional:* every inventory function exists; every workflow still possible; nothing lost.
  (Run `node scripts/generate-ui-inventory.js` + diff `docs/ui-inventory.json`.)
- *UX:* reduces cognitive load, improves discoverability, simplifies navigation, removes needless
  interactions, improves hierarchy, increases consistency.
- *Visual:* distinctive identity, professionally designed, avoids generic AI layouts, hierarchy
  from type/space, intentional composition, polished at every level.

**Phase 8 — Self-Critique.** Review your own work: remaining weaknesses, compromises, assumptions,
opportunities. Revise. Don't stop at the first acceptable solution; iterate until UX and visuals
feel cohesive, intentional, production-ready.

---

## Final Rule

Never confuse "different" with "better." Every decision must improve at least one of: usability,
discoverability, cognitive load, interaction quality, information architecture, visual hierarchy,
accessibility, visual quality, emotional appeal, product identity. If it improves none, keep the
original. The result should read as the work of an experienced product design team — not an
AI-generated redesign.

---

## How this maps to Return's mandatory application process

This workflow is the *design* discipline; `design-system.md` §6 is the *engineering* safety net
that makes it non-destructive in this single-file, ~30k-line app. They run together:

- Phase 2 (functional audit) **is** the §6 inventory checklist — every `.tab-btn`/`id`/`data-*`/
  `onclick` in `UI_FUNCTION_INVENTORY.md` must survive.
- Phase 5 (redesign) follows §6: strangler-fig (one page at a time), keep the `id`/`data-*`
  binding contract, prefer read-chokepoint migrations for stored/synced state.
- Phase 7 (validation) = §6 steps 4–6: inventory diff (0 functions lost), `npm test`, headless
  render at desktop/tablet/mobile.
- Removing anything → DESIGN §6 step 0: **ask the owner first.**
