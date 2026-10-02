# Implementation review: ui-primitives

Scope: full · Date: 2026-10-02 · Commits: e738928..89482ba · Gates: typecheck ✓ lint ✓ test ✓ (553 tests, 2 skipped, after fixes) · build ✓ (styles.css 5.1 kB gzip of 20 kB)

## Verdict
Ready after fixes. Every primitive the plan names exists, with slots, `unstyled`, copy from
`messages` and the FIRE behaviour tests plus DOM tests. Two subagent passes (plan drift;
correctness and patterns) found five real defects, two reproduced with scratch tests: nested and
out-of-order modals broke Escape, scroll lock and inert; a hover-opened hint ignored Escape; a
rejected action tore the form down; switches all turned off replayed as their defaults. All are
fixed in 89482ba with a test each. Plan drift is small and now recorded in plan.md.

## Dimensions
| Dimension | Verdict | Findings |
|---|---|---|
| Plan adherence | WARNING | F6 (fixed: recorded), F7 (fixed) |
| Scope | PASS | |
| Progress honesty | PASS | |
| Correctness | FAIL → fixed | F1, F2, F4, F5 |
| Accessibility | WARNING → fixed | F3, F8 |
| Tests | PASS | F9 (fixed) |
| Data and migrations | n/a | no data |
| Security | PASS | no network, no secrets; copy guard and raw-colour guard in place |
| Architecture and patterns | PASS | F10 (fixed) |
| Lessons | PASS | L-001: client files keep `"use client"` in `dist/`, build stays `tsc` |

## Plan coverage
| Phase | Commit | Delivered | Notes |
|---|---|---|---|
| 1 Foundation, buttons, icons, static blocks | f951c85 | yes | `Button` gained a `spinner` slot |
| 2 Form controls | 98480df | yes | `SegmentedControl` in its own file; `getNextSelectState` naming |
| 3 Modal, toast, action form, docs | 7d3b2f8 | yes | README usage completed in F7 |

Files: planned and changed 44 · unplanned 1 (`src/ui/segmented-control.tsx`, explained in plan
Decisions) · planned, not changed 0.

## Findings

### F1 [WARNING] One Escape closed both dialogs of a nested pair
**Impact:** LOW · **Dimension:** Correctness · **Where:** foundation/ui/src/ui/modal.tsx:92
**What:** every open modal listened for Escape on `document`; none checked whether it was on top.
**Why it matters:** a confirmation opened from an edit form closes the form too, losing input.
**Evidence:** scratch test: outer and inner `onClose` both called once.
**Fix:** a module-level stack of open overlays; only the top one answers and prevents default.
**Decision:** fix now (89482ba); test "closes only the top dialog of a nested pair on Escape",
which fails with the check removed (verified).

### F2 [WARNING] Closing modals out of order left the page locked
**Impact:** LOW · **Dimension:** Correctness · **Where:** foundation/ui/src/ui/modal.tsx:101
**What:** each modal saved and restored `body.style.overflow` and its own inert list.
**Why it matters:** the page stays unscrollable for good, or loses `inert` under an open dialog.
**Evidence:** scratch test: `overflow "hidden"` after both closed.
**Fix:** shared scroll-lock counter and per-element inert hold counts.
**Decision:** fix now (89482ba); test "restores the page when two dialogs close out of order".

### F3 [WARNING] A hover-opened hint could not be dismissed with Escape
**Impact:** LOW · **Dimension:** Accessibility · **Where:** foundation/ui/src/ui/hint.tsx:174
**What:** the Escape listener existed only while pinned; the bubble stood 8 px off a 6 px hit area.
**Why it matters:** WCAG 1.4.13; inside a modal the Escape closed the dialog instead.
**Fix:** a captured Escape listener whenever the bubble shows; gap 6 px.
**Decision:** fix now (89482ba); test "closes a bubble opened by hover on Escape, without letting
the Escape through"; placement tests updated to the 6 px gap.

### F4 [WARNING] A rejected action tore down the form
**Impact:** LOW · **Dimension:** Correctness · **Where:** foundation/ui/src/ui/action-form.tsx:98
**What:** `await action(formData)` had no failure path; a network error reached the error boundary.
**Why it matters:** everything typed is lost on a flaky connection.
**Fix:** catch, log with `console.error`, return a form error from `actionForm.failed` with the
values replayed.
**Decision:** fix now (89482ba); test "turns a rejected action into a form error and keeps what was typed".

### F5 [WARNING] Switches all turned off replayed as their defaults
**Impact:** LOW · **Dimension:** Correctness · **Where:** foundation/ui/src/ui/form-context.tsx:47
**What:** "no replay" was inferred from empty values, and all-off checkboxes send nothing.
**Fix:** `FormReplay.hasReplay`, set after a rejected submit.
**Decision:** fix now (89482ba); test "replays switches all turned off as off, not as their defaults".

### F6 [WARNING] Unrecorded drift from the plan
**Impact:** LOW · **Dimension:** Plan adherence · **Where:** context/archive/2026-10-02-ui-primitives/plan.md
**What:** Card slots (`titleRow`, no `body`), `getAmountErrorMessage` instead of
`getUiErrorMessage`, `getNextSelectState`, the tighter `ActionResult`, Button `spinner` slot.
**Fix:** each kept and explained under plan Decisions (auto).
**Decision:** fix now (89482ba).

### F7 [SUGGESTION] README showed usage for only some primitives
**Impact:** LOW · **Dimension:** Plan adherence · **Where:** foundation/ui/README.md
**Decision:** fix now (89482ba): a "Surfaces, controls and feedback" section with examples.

### F8 [SUGGESTION] Focus trap counted every radio as a Tab stop
**Impact:** LOW · **Dimension:** Accessibility · **Where:** foundation/ui/src/ui/modal.tsx:296
**Decision:** fix now (89482ba): one stop per group (checked, else first); test added.
Also accepted, not fixed: focus return falls back to the first button with the same label when
the opener was replaced (FIRE behaviour; a `returnFocusRef` is a feature for later), and a
non-string `Switch` label without `hintLabel` names the hint "Hint: " (documented prop).

### F9 [SUGGESTION] Gaps in tests for the riskiest behaviour
**Impact:** LOW · **Dimension:** Tests
**Decision:** fix now (89482ba) for nested modals, hint Escape, action rejection, all-off replay,
amount one cent past the limit and no-break-space groups. Accepted: component-level typeahead and
Home/End in `Select` stay covered by the pure `getNextSelectState` tests.

### F10 [SUGGESTION] Small pattern and precision items
**Impact:** LOW · **Dimension:** Architecture and patterns
**What:** `ThemeSwitch` merged copy inline instead of `getCopy`; `formatAmountInput` divided a
float; `ActionForm` could not pass Cancel copy to its modal footer.
**Decision:** fix now (89482ba): `getCopy("themeSwitch")`, exact integer division, `modalMessages` prop.

## Progress audit
- 1.1, 1.2 (f951c85), 2.1, 2.2 (98480df), 3.1–3.3 (7d3b2f8): gates and phase tests re-run in this
  session, all green; build prints 5.1 kB gzip; the docs link test passes.
- 3.4 (Manual): `reviews/primitives-{light,dark,light-modal,dark-modal}.png`, rendered from the
  built `styles.css` in Chromium, verified by agent.

## Triage summary
Ten findings: five WARNINGs and five SUGGESTIONs, all `fix now` in 89482ba; two minor sub-items
accepted (F8, F9). Nothing deferred, nothing pending.

## Lessons proposed
None. The defects are component-specific; no rule repeats across changes.

## Decisions (auto)
- WARNINGs with a clear local fix: fix now.
- SUGGESTIONs under about ten lines and risk-free: fix now; the rest accepted with the reason above.
