# Plan: ui-primitives

Input: change.md, research.md. Complexity: large.

## Goal

`@softure-ai/ui` exports, next to the FD-5 theme:

- `Button`, `ButtonLink` (with an injected `LinkComponent`), `IconButton`;
- icons (`ArrowLeftIcon` … `ChatIcon`), one frame, decorative;
- `FormError`, `Card`, `Stat`, `EmptyState`, `Hint`;
- `Field`, `FieldGroup`, `TextField`, `PasswordField`, `MoneyField`, `SelectField`, `Select`
  (ARIA listbox), `Switch`, `Checkbox`, `SegmentedControl`;
- `Modal`, `ModalBody`, `ModalFooter`, `ModalForm`, `ToastHost` + `announceToast`, `ActionForm`.

Every component takes typed `classNames` slots and `unstyled`; every visible or ARIA string it owns
comes from `messages` (`en`, `pl`) with `locale` and partial `messages` props. The FIRE behaviour
tests pass in the package, plus DOM tests for the keyboard and focus behaviour FIRE checks only in
Playwright. `styles.css` contains every class the components use and stays under 20 kB gzip.

**Out of scope:** FIRE domain components and props (research: Answers to unknowns), `StandingPanel`,
`SuggestedAmountField`, `ColorField`, layout checks that need a real browser (FD-7 e2e), publishing.

## Approach

**Starting point:** FD-5 left `getSlotClass`, per-call copy and the compiled CSS pipeline
(`foundation/ui/src/ui/class-names.ts:9`, `theme-switch.tsx:77`, `scripts/build-css.mjs`). FIRE
`src/components/{button,icons,feedback,ui,hint,switch,select,select-keys,form-fields,modal,toast,action-form}.tsx`
is the behaviour to port.

**Chosen:** port component by component into `src/ui/`, one file per FIRE file, rewriting copy into
`messages`, mapping FIRE roles onto `--sft-*` tokens and adding slots. Pure logic (focus cycle,
listbox keys, placements, toast visibility, amount parsing) stays in exported functions with unit
tests; interaction is tested in `happy-dom`.
Rejected: a UI-wide locale/link provider (context makes every primitive a client component);
wrapping a headless library (new runtime dependency, FIRE behaviour already exists and is tested).

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Copy | `locale` + `messages?: DeepPartial<UiMessages[group]>` per component | same as `ThemeSwitch`; server-safe | research |
| Links | `ButtonLink` takes `LinkComponent` (default `"a"`) | only primitive that renders a link; no `next/*` in `ui/` | research, docs/02 §5 |
| Role mapping | `debt`→`danger`, `line-strong`→`border-strong`, `accessible`→`success`, `locked`→`warning` | token contract names | research |
| Domain props | dropped (`accent`, `step`, `collapsible`, `ink*`, `zawijaj`→`wrap`) | not generic | research |
| Money input | `parseAmount(text, locale): Result<cents, "ui.amount_invalid" \| "ui.amount_out_of_range">` and `formatAmountInput(cents, locale)` | FIRE parser is Polish-only; the server action parses the same way | research |
| Field ids | `id` prop, else `useId()` | FIRE's `field-${name}` collides when a name repeats | plan |
| Tailwind theme | `STATIC_THEME` gains `--spacing: 0.25rem`, `--container-{md,3xl}`, `--leading-{snug,relaxed}`, `--animate-spin` with keyframes | utilities without a theme value emit nothing (research) | research |
| DOM tests | `happy-dom` + `@testing-library/react`, per-file docblock | measured to work; node stays the default | research |
| Copy guard | architecture test via the TypeScript AST: no JSX text with letters and no literal value of `aria-*`, `title`, `placeholder`, `alt`, `label` or `*Label` attributes in `src/ui/`; `next/*` stays with the existing ESLint rule | NFR-3 | prd, plan review W2/S1 |
| Translation | every ported line is written in English (comments, test names, identifiers such as FIRE's `data-modal-czesc`); FIRE Polish copy becomes `messages/pl.ts` entries; `npm run lint:language` before each commit | AGENTS.md, NFR-6 | plan review C1 |
| Class coverage | a styles test scans every `sft:` class in `src/ui/` and requires a selector for it in the compiled CSS | a missing theme value is silent | plan review C2 |
| Class mapping | `rounded-md/lg` → `rounded-control`, `rounded-xl` → `rounded-card`; FIRE `figure`/`tabular` → `tabular-nums` (+ `font-mono` for number inputs); `font-display` → `font-heading`; FIRE modal keyframes → `starting:` transitions; `text-[10px]` → `text-xs`; landing colours (`ink`, `graphite`, `paper`) dropped | token contract, no custom CSS | plan review C2 |
| Action result | `ActionResult = Result<undefined, ErrorCode> & { fieldErrors?: Record<string, ErrorCode> }`; `ActionForm` takes `getErrorMessage(code)`; the package's own codes (`ui.amount_*`) have `errors.*` copy and `getUiErrorMessage(code, locale)` | docs/02 §6: server errors are codes | plan review W1 |
| Peers | `react-dom` joins `react` in `peerDependencies` (Modal portal) | plan review W3 | plan review |
| ThemeSwitch | rendered by `SegmentedControl`, same slots and markup | one radio-group implementation | research |

**Critical details:**
- Server-safe files (`button`, `icons`, `feedback`, `card`) carry no hooks and no `"use client"`;
  client files start with `"use client"` (L-001 keeps it in `dist/`).
- Tailwind sees only literal class strings in `src/ui/`; no class name is assembled at runtime.

## Phase 1: Foundation, buttons, icons, static blocks

**Discipline:** test-after (port of tested code). **Files:** root `package.json`, `package-lock.json`,
`foundation/ui/scripts/build-css.mjs`, `foundation/ui/src/ui/{button,icons,feedback,card,hint}.tsx`,
`foundation/ui/src/ui/{class-names,copy}.ts`, `foundation/ui/src/messages/{en,pl}.ts`,
`foundation/ui/src/ui/index.ts`, `foundation/ui/package.json`,
`foundation/ui/tests/{button,icons,card,hint,architecture,styles}.test.ts(x)`.

1. Dev dependencies `happy-dom`, `@testing-library/react`, `@testing-library/dom`.
2. `STATIC_THEME` extended as decided.
3. `Button` (`variant`, `size`, `iconLeft`, `iconRight`, `fullWidth`, `wrap`, `pending`, slots
   `root`), `ButtonLink`, `IconButton` (`label`, `tone`, `size`, `bordered`).
4. Icons with `IconProps { size?, className? }`.
5. `FormError`, `Card` (`title`, `subtitle`, `hint`, `action`, `variant: boxed|flat|lead`, slots
   `root, header, title, subtitle, body`), `Stat` (`tone`, `size`, slots), `EmptyState`, `Hint`
   (+ `resolveBubblePlacement`).
6. Architecture test: copy guard. Styles test: every `sft:` class has a compiled selector.
7. DOM tests call `afterEach(cleanup)` (Vitest globals are off, so Testing Library cannot).

**Tests:** FIRE button, icons, hint and Card/Stat cases; slot and `unstyled` cases; DOM: hint opens on
focus, pins on click, closes on Escape.

**Done when:**
- Automated: the phase tests pass, including the class coverage test; gates green (typecheck, lint, test).

## Phase 2: Form controls

**Discipline:** test-after. **Files:** `foundation/ui/src/ui/{field,switch,select,amount,form-fields,form-context,theme-switch}.tsx`,
`foundation/ui/src/ui/select-keys.ts`, `foundation/ui/src/ui/index.ts`, `foundation/ui/src/messages/{en,pl}.ts`,
`foundation/ui/tests/{select,select-keys,switch,form-fields,amount}.test.ts(x)`.

1. `Field`, `FieldGroup`, input class constants.
2. `Switch`, `Checkbox`, `SegmentedControl`; `ThemeSwitch` renders `SegmentedControl`.
3. `Select` + `nextSelectState` + `resolveListPlacement` (typeahead lower-cases with `locale`).
4. `parseAmount`, `formatAmountInput`, `normalizeAmountInput` per locale.
5. `TextField`, `PasswordField`, `MoneyField`, `SelectField`, `CheckboxField`, reading the
   `ActionForm` replay context (context file created here, form in phase 3).

**Tests:** FIRE select, select-keys, switch and form-fields cases; amount parse and format per locale
(empty, boundary, invalid); DOM: listbox arrows plus Enter commit, Escape closes without change,
outside click closes; FD-5 theme switch tests unchanged.

**Done when:**
- Automated: the phase tests pass; gates green (typecheck, lint, test).

## Phase 3: Modal, toast, action form, docs

**Discipline:** test-after. **Files:** `foundation/ui/src/ui/{modal,toast,action-form}.tsx`,
`foundation/ui/src/ui/index.ts`, `foundation/ui/tests/{modal,toast,action-form}.test.tsx`,
`foundation/ui/README.md`, `docs/02-module-standard.md` (§5: the primitives list and the copy rule).

1. `Modal` (`title`, `subtitle`, `width: form|confirmation`, `onClose`, `isDismissible`), focus trap,
   `inert` background, scroll lock, focus return; `ModalBody`, `ModalFooter`, `ModalForm`.
2. `ToastHost`, `announceToast`, `isToastVisible`, `isAnnouncementNew`.
3. `ActionForm` (`action` returning `ActionResult`, page and modal layouts, value replay, field
   errors, success toast).
4. README: usage of every primitive, slots, copy and `LinkComponent`; docs/02 §5 names the
   primitives and points at the README.
5. Screenshots: a static page rendered with `renderToStaticMarkup` and the built `styles.css`,
   captured with the preinstalled Chromium (Playwright) in light and dark, saved under `reviews/`.

**Tests:** FIRE modal, toast and action-form cases; DOM: Tab cycles inside, Escape closes and returns
focus, background inert while open, not dismissible while pending; action form replays values and
shows field errors after a rejected submit.

**Done when:**
- Automated: the phase tests pass; `npm run build` prints the CSS size under budget; README links
  pass the link test; gates green (typecheck, lint, test).
- Manual: a page with the primitives renders in light and dark (agent screenshots in `reviews/`).

## Risks and rollback

- CSS gaps → styles test on representative classes. Rollback of any phase: revert its commit; the
  package has no consumers yet (FD-7 comes after).
- Lockfile conflict with FD-4 → take master's lockfile, `npm install`, commit.

## Decisions (auto)

- Complexity large, three phases by dependency.
- Key decisions above taken in auto mode from research evidence.
- Plan review (`reviews/plan-review.md`) applied: C1, C2, C3, W1, W2 (attribute part; a free-text
  literal scan is rejected as too noisy for class strings), W3, W4, W5, W6 (kept here with a
  harness instead of moving to FD-7), S1, S2.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Foundation, buttons, icons, static blocks

#### Automated
- [x] 1.1 The phase 1 tests pass, including the class coverage test — f951c85
- [x] 1.2 Gates green (typecheck, lint, test) — f951c85

### Phase 2: Form controls

#### Automated
- [x] 2.1 The phase 2 tests pass, FD-5 theme switch tests unchanged — 98480df
- [x] 2.2 Gates green (typecheck, lint, test) — 98480df

### Phase 3: Modal, toast, action form, docs

#### Automated
- [ ] 3.1 The phase 3 tests pass; `npm run build` prints the CSS size under budget
- [ ] 3.2 README and docs links pass the link test
- [ ] 3.3 Gates green (typecheck, lint, test)

#### Manual
- [ ] 3.4 A page with the primitives renders in light and dark (screenshots)
