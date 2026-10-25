---
change_id: theme-notion-test-suite-741
status: planned
---

# Plan: theme-notion test suite (issue #741)

## Goal

Every class string, export and behaviour of `@softure-ai/theme-notion` is pinned by a test, so a drift like #735
fails a gate before merge: layers 1–5 and 8 in `npm test`, 6–7 and the coverage threshold in a CI workflow for
`themes/`.

## Approach

**Chosen:** one shared list of gallery cases drives the render, parity, Tailwind and visual layers; the upstream
guard is data (replacements on pinned upstream text); the visual and axe layers run with Playwright Test in a
`themes.yml` workflow.
Rejected: per-component hand-written class assertions only - they miss what nobody thought to assert; a diff
library with hunk matching - replacements are exact and need no dependency.

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Upstream pin | `shadcn-ui/ui@617134d` new-york-v4 files committed as `tests/upstream/*.tsx.txt` | registry host blocked; a pin must not move | research |
| Parity source | fixture generated from the sources once #735 is merged, guarded by layer 3 | the design system's own files are not in this repository; upstream plus listed deltas is the reviewable truth | plan |
| Fixture update | `UPDATE_FIXTURES=1 npx vitest run themes/theme-notion/tests/parity.test.tsx` | same pattern as a snapshot, explicit diff in review | plan |
| Visual fonts | `@fontsource` sans and mono in the gallery only | host-independent rendering | research |
| Contrast | token test pins today's ratios as a floor; axe runs without `color-contrast` | Notion's own tokens miss AA; changing them is a design decision | research |

## Phase 1: upstream delta guard

**Discipline:** TDD. **Files:** `themes/theme-notion/tests/upstream/*.tsx.txt`, `tests/upstream/source.json`,
`tests/ui-deltas.ts`, `tests/upstream-guard.ts`, `tests/upstream.test.ts`.

1. Pinned upstream files for all `src/ui/*.tsx` (radio-group included once #736 lands), with repository, commit and
   path in `source.json`; `switch-thumb.ts` has no upstream and is listed as package-own.
2. `UI_DELTAS`: per file, ordered `{ upstream, ours, reason }`; `applyDeltas(upstream, deltas)` returns the result
   or an error naming the delta that did not match exactly once.
3. Test: every ui file equals its upstream with its deltas; every delta is used; every ui file has a pin.
4. Test: each of the four #735 drifts, re-introduced into the fixed source, fails the guard.

**Done when:** Automated: guard green on master's sources, red on each #735 drift; Gates green.

## Phase 2: gallery cases, render and parity

**Discipline:** test-after. **Files:** `tests/gallery/cases.tsx`, `tests/render.test.tsx`, `tests/parity.test.tsx`,
`tests/fixtures/notion-slots.json`.

1. `GALLERY_CASES`: one case per export and per `variant` × `size` of every `cva`, overlays open (dialog, sheet,
   alert-dialog, select, dropdown, popover, command dialog, tooltip, sonner toast), each with its expected root slot.
2. Render test (happy-dom): each case renders its root `data-slot`; every exported component appears in some case.
3. Parity test: per case, every `data-slot` with its sorted class list equals `notion-slots.json`; with
   `UPDATE_FIXTURES=1` it rewrites the fixture.

**Done when:** Automated: render and parity green; a changed class shows as a fixture diff; Gates green.

## Phase 3: behaviour

**Discipline:** test-after. **Files:** `tests/behaviour/*.test.tsx`.

Sidebar (`offcanvas`/`icon`/`none`, phone sheet without own close button and with `p-0`, controlled state without
cookie, uncontrolled with cookie, rail and trigger labels, keyboard shortcut); checkbox, switch, radio states and
keyboard; select, dropdown, command open and choose; dialog, sheet, alert-dialog close label, Escape, focus return;
tabs `line` default; every message-layer prop replaces its English default.

**Done when:** Automated: behaviour tests green; Gates green.

## Phase 4: Tailwind generation, inventory, contrast

**Discipline:** test-after. **Files:** `tests/tailwind-classes.test.ts`, `tests/inventory.test.ts`,
`tests/contrast.test.ts`.

1. Every class in `notion-slots.json` (plus the tone maps) generates CSS through Tailwind v4 `compile` with
   `theme.css`; marker classes allowed by pattern.
2. Inventory: barrel exports, files in `src/ui` and `src/notion`, the README component list and the gallery cases agree.
3. Contrast: text roles on their backgrounds, both schemes, at least their ratio today (4.5 where the design system
   meets AA, the measured value where it does not).

**Done when:** Automated: all three green; Gates green.

## Phase 5: visual regression and axe in CI

**Discipline:** test-after. **Files:** `themes/theme-notion/visual/*`, `playwright.config.ts`,
`.github/workflows/themes.yml`, package devDependencies.

1. Gallery build: esbuild bundles `cases.tsx` into a page; Tailwind CLI compiles `theme.css` plus the kit's
   `base.css`; fonts from `@fontsource`.
2. Playwright Test: gallery and each overlay at 1440 and 390, light and dark, `toHaveScreenshot` against committed
   baselines; axe (`@axe-core/playwright`) with no violations, `color-contrast` disabled with the reason in code.
3. `themes.yml` on pull requests touching `themes/**`: visual + axe job, and a coverage job
   (`@vitest/coverage-v8`, theme-notion `src` ≥ 90% statements and branches).

**Done when:** Automated: workflow green on the PR; baselines committed; coverage ≥ 90%; Gates green.

## Phase 6: docs

**Discipline:** test-after. **Files:** `README.md`, `CHANGELOG.md`.

README "Testing" section (layers, how to update the parity fixture, the upstream pin and the baselines); CHANGELOG
`Unreleased` entry.

**Done when:** Automated: links test green; Gates green.

## Risks and rollback

- Radix in happy-dom (pointer capture, `scrollIntoView`) → stub the missing DOM APIs in a test setup helper.
- Baselines differ between container and runner → same Chromium build, bundled fonts, `--font-render-hinting=none`,
  a small `maxDiffPixelRatio`; the job uploads the diffs as an artifact.
- Every phase only adds tests and CI; revert by removing its files.

## Decisions (auto)

- Parity fixture from the fixed sources, not from the design system's files → they are not in this repository;
  layer 3 ties every class to upstream plus a listed reason.
- Contrast below AA in the design system's tokens → kept, pinned as a floor, reported to the coordinator as a
  decision for the owner (tokens are the design system's).
- Finalise fixture, inventory and baselines after #735–#740 are on master → the coordinator's brief.
- No version bump → the coordinator releases in a batch.
- Owner's answer on contrast (2026-10-25): darken to WCAG AA. #756 changed the tokens and brought its own
  `tests/contrast.test.ts` (every rendered pair, AA 4.5 and 3:1 for the ring) → adopted in the merge instead of the
  floor test; axe `color-contrast` is on. Item 4.3 is met at AA, not at a floor.
- Two parts still below AA after #756 (inline Code red on secondary; a destructive Badge with a colour in dark) →
  filed as #763 (outside this change's scope); listed as known axe violations until it landed, then removed.
- #747 fixed ItemGroup and ScrollArea → their known violations are removed and their deltas listed.
- The four drag announcements of `SortableList` are checked in `tests/notion/Sortable.test.tsx` during a keyboard
  drag → the message-layer test lists them as checked elsewhere, like the phone sheet's copy.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: upstream delta guard

#### Automated
- [x] 1.1 Every `src/ui` file equals its pinned upstream with its listed deltas, and every delta is used — a1aa8f2
- [x] 1.2 Each of the four #735 drifts fails the guard — a1aa8f2
- [x] 1.3 Gates green (typecheck, lint, test) — a1aa8f2

### Phase 2: gallery cases, render and parity

#### Automated
- [x] 2.1 Every export and every cva variant × size renders its root slot — 46c22dc
- [x] 2.2 Every case's slot classes equal `notion-slots.json` — 46c22dc
- [x] 2.3 Gates green (typecheck, lint, test) — 46c22dc

### Phase 3: behaviour

#### Automated
- [x] 3.1 Sidebar, form controls, overlays, tabs and message props behave as specified — 7ca87b2
- [x] 3.2 Gates green (typecheck, lint, test) — 7ca87b2

### Phase 4: Tailwind generation, inventory, contrast

#### Automated
- [x] 4.1 Every fixture class generates CSS — cf8fd7c
- [x] 4.2 Exports, files, README list and cases agree — cf8fd7c
- [x] 4.3 Text contrast is at least today's ratio in both schemes — cf8fd7c
- [x] 4.4 Gates green (typecheck, lint, test) — cf8fd7c

### Phase 5: visual regression and axe in CI

#### Automated
- [x] 5.1 Visual baselines committed and matched in CI — 45f3e33
- [x] 5.2 axe finds no violations in either scheme — 45f3e33
- [x] 5.3 Coverage of theme-notion `src` ≥ 90% statements and branches — 45f3e33
- [x] 5.4 Gates green (typecheck, lint, test) — 45f3e33

### Phase 6: docs

#### Automated
- [x] 6.1 README Testing section and CHANGELOG entry present — 944125d
- [x] 6.2 Gates green (typecheck, lint, test) — 944125d
