# Plan review: ui-primitives

Reviewed: plan.md @ 2026-10-02. Mode: deep (auto). Verdict: ready after fixes (C1-C3 and the warnings below must be applied to plan.md first; the reviewer was asked not to edit plan.md).
Findings: 3 critical, 6 warning, 2 suggestion.
Grounding: 21/22 paths (FIRE `select-keys` is `.ts`, the plan globs it as `.tsx`), 8/9 symbols (`ActionResult` exists only in FIRE `src/components/action-form.tsx:51`, with string errors), 4/4 commands (`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, matching `context/workflow.json`)

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | FAIL (C2) |
| Slicing | PASS |
| Verifiability | WARN (W2, W6) |
| Data and migrations | PASS (no data) |
| Tests | WARN (W4) |
| Security | PASS |
| Lean | WARN (S1) |
| Fit | WARN (W1, W3) |
| Cost and defaults | PASS |
| Scope | PASS |
| Reuse | PASS |
| Lessons | PASS (L-001 followed: `"use client"` kept, `tsc` build unchanged) |
| Progress format | FAIL (C3) |
| Language gate / NFR-6 | FAIL (C1) |

## Findings

### C1 [CRITICAL] Every ported FIRE file and test is Polish; the plan has no translation step, and research.md already fails the gate
**Effort:** medium. **Lens:** Language gate (NFR-6, AGENTS.md). **Where:** Approach "Chosen"; all phases · `scripts/check-language.mjs` · `context/archive/2026-10-02-ui-primitives/research.md:133`
**Problem:** All 12 FIRE source files and all 11 test files the plan ports contain Polish (`grep` for diacritics hits every one): doc comments (`button.tsx:11-30`), test names (`button.test.tsx:50` and onward), literal Polish assertions, and Polish identifiers the gate cannot see (`data-modal-czesc="naglowek|tresc|stopka"` `modal.tsx:294,554,601`, CSS classes `modal-tlo`, keyframes `modal-wejscie*` in FIRE `app/globals.css:1639-1680`). The plan says only "rewriting copy into `messages`"; comments, test names and identifiers are not mentioned, so a file-by-file port fails `npm run lint` (`lint:language --all`) and the pre-commit hook. Separately, `node scripts/check-language.mjs context/archive/2026-10-02-ui-primitives/research.md` exits 1 today (`research.md:133`, a Polish diacritic in a quoted label; the gate checks diacritics before stripping Markdown code spans), so committing the change artifacts fails the hook.
**Fix:** add under "Critical details": "Port = translate. Every comment, doc comment, test name, identifier, data attribute value (`data-part="header|body|footer"`), CSS class and keyframe name is written in English; FIRE's Polish prose is not copied. Tests never contain Polish literals: Polish expectations read `uiMessages.pl.<group>.<key>` (as `tests/components.test.tsx` already does). `node scripts/check-language.mjs <files>` runs on each new file before the phase commit." Add to each phase's Done when: "`npm run lint:language` passes". In research.md line 133 replace the Polish strings with English descriptions (the close, cancel, saving, hint-trigger `{label}` and definition-trigger `{title}` labels).
**Decision:** Fix now (recommended, not applied: reviewer instructed not to edit plan.md)

### C2 [CRITICAL] The Tailwind theme and role mapping cover a fraction of the utilities FIRE uses; most primitives would compile unstyled, silently
**Effort:** medium. **Lens:** Coverage and end state. **Where:** Key decisions "Role mapping", "Tailwind theme"; Phase 1 step 2; Done when 1.1 · `foundation/ui/scripts/build-css.mjs:31-37` · `foundation/ui/src/theme/tokens.ts:5-54`
**Problem:** Research established that a utility without a theme value emits nothing. Beyond the plan's list, the generic (non-domain) FIRE classes need: `rounded-lg`/`rounded-md`/`rounded-xl` (every Button size `button.tsx:80-82`, IconButton `:277-283`, FormError `feedback.tsx:27`, input class `ui.tsx:612`, Select list `select.tsx:438,460`, SegmentedControl `switch.tsx:394,397`, toast `toast.tsx:69`); `tracking-tight|wider|normal` (`modal.tsx:304,523`); `font-display` (`modal.tsx:304`); role sizes `text-subsection|page|band` and `text-4xl` (Card title `ui.tsx:199-200`, Modal title `modal.tsx:451`, Stat `ui.tsx:325`); `max-w-measure` (`modal.tsx:455`); FIRE global classes `figure`, `tabular` (`app/globals.css:630,655`) and the modal entry animations `modal-tlo`/`modal-panel` (`globals.css:1639-1680`), which are not Tailwind utilities at all. The colour mapping also omits `graphite`. The styles test asserts only `.sft\:h-10` and `.sft\:animate-spin`, so every gap above passes all gates. docs/02 §5 also forbids raw sizes outside tokens, yet FIRE uses arbitrary values (`sm:w-[37.5rem]` `modal.tsx:539`, `max-w-[calc(100vw-1rem)]` `select.tsx:438`) with no rule in the plan.
**Fix A (Recommended):** (1) extend the "Role mapping" table: `rounded-md|lg`→`rounded-control`, `rounded-xl`→`rounded-card`, `font-display`→`font-heading`, `text-subsection`→`text-lg`, `text-page|band`→`text-2xl`, `text-4xl`→`text-3xl`, `graphite`→`foreground`/`muted`; add `--tracking-{tight,normal,wider}` and `--container-measure` (or `max-w-prose`-like static value) to `STATIC_THEME`; replace `figure`/`tabular` with `sft:tabular-nums` (+ `sft:font-mono` where needed); move the modal keyframes into `STATIC_THEME` as `--animate-modal-*` with English names; state that arbitrary `[...]` values are allowed only for viewport math (`calc(100vw-1rem)`, `dvh`) and listed. (2) Replace the representative-class criterion with a styles test that extracts every `sft:` class literal from `src/ui/*.tsx` and asserts each has a rule in the compiled `styles.css`. Strength: catches the whole class of silent gaps, now and for every later component. Trade-off: one more parser (a regex over string literals suffices because the plan already forbids runtime-assembled class names). Confidence: high, the gap list above comes from grepping the 11 FIRE files. Blind spot: variant-prefixed selectors (`sft:has-checked:...`) need escaping care in the assertion.
**Fix B:** keep the representative test, add one class per family above. Strength: smaller. Trade-off: the next missing namespace is again silent. Confidence: medium.
**Decision:** Fix now (recommended Fix A, not applied)

### C3 [CRITICAL] Progress does not mirror Done when; the README link criterion has no item
**Effort:** low. **Lens:** Progress format. **Where:** Phases 1-3 "Done when"; `## Progress` 1.1-3.3
**Problem:** Each phase writes Done when as one combined `- Automated: a; b; gates` bullet, while Progress splits it differently (`progress-format.md` rule 11: every Done-when bullet has exactly one item). Phase 3's "README links pass the link test" has no Progress item, so softure-implement can finish the phase without checking it. Phase 2 Done when lacks the "FD-5 theme switch tests unchanged" that Progress 2.1 adds.
**Fix:** rewrite each Done when as one plain `- ` bullet per criterion and mirror them 1:1, gates last. Phase 1: `- The phase 1 tests pass` / `- styles.css has a rule for every sft: class in src/ui (C2)` / `- npm run lint:language passes` / `- Gates green (typecheck, lint, test)`. Phase 2: tests pass / FD-5 `tests/components.test.tsx` ThemeSwitch cases pass unchanged / gates. Phase 3: tests pass / `npm run build` prints styles.css under 20 kB gzip / `tests/repo/links.test.ts` passes with the new README / gates; Manual 3.x as decided in W6.
**Decision:** Fix now (recommended, not applied)

### W1 [WARNING] `ActionResult` is undefined in this repo, and FIRE's carries translated strings, not error codes
**Effort:** medium. **Lens:** Fit. **Where:** Phase 3 step 3 · FIRE `action-form.tsx:51-62` · `docs/02-module-standard.md` §6 · `foundation/core/src/result.ts`
**Problem:** FIRE's `ActionResult` is `{ ok: false; error: string; fieldErrors?: Record<string,string> }` with Polish text produced by the server. docs/02 §6 says server errors are codes translated by the UI through `messages`. The plan names the type without a shape, so the implementer must guess, and `parseAmount` already returns codes (`ui.amount_invalid`) that need the same path.
**Fix:** add a key decision: `ActionResult = Result<undefined, ErrorCode> & { fieldErrors?: Record<string, ErrorCode> }` defined in `action-form.tsx` (or a shared `action-result.ts`), plus an `errorMessages?: Record<ErrorCode, string>` (or `translateError(code) => string`) prop on `ActionForm` so the app maps codes to copy; the package's own codes (`ui.amount_*`) get `en`/`pl` entries in `src/messages`. Add a test: a rejected submit with a code shows the mapped text and the field error.
**Decision:** Fix now (recommended, not applied)

### W2 [WARNING] The copy guard misses the ways FIRE actually inlines copy
**Effort:** low. **Lens:** Verifiability (NFR-3). **Where:** Key decision "Copy guard"; Phase 1 step 6
**Problem:** The guard covers JSX text and literal `aria-label`/`title`/`placeholder`/`alt`. FIRE inlines copy through other routes the guard would pass: `<IconButton label="...">` with a Polish literal (`modal.tsx:316,460`, a `label` prop that becomes `aria-label`), the constant `DEFAULT_PENDING_LABEL` with a Polish literal (`action-form.tsx:156`), and template strings for the hint trigger label (`{label}` interpolated into Polish text).
**Fix:** extend the guard: flag string-literal (and no-substitution template) values of JSX attributes named `aria-*`, `title`, `placeholder`, `alt`, `label` or ending in `Label`; flag any string literal in `src/ui/` containing a space-separated word sequence that is not a class string (does not start with `sft:` and is not an `sft:` class list) and not an allowlisted attribute value. Add the planted-violation case ("would catch a planted literal") as the existing architecture test does.
**Decision:** Fix now (recommended, not applied)

### W3 [WARNING] `react-dom` is used but not declared by `@softure-ai/ui`
**Effort:** low. **Lens:** Fit. **Where:** Phase 3 step 1 · FIRE `modal.tsx:12` (`createPortal`) · `foundation/ui/package.json` (`peerDependencies: { react }` only)
**Problem:** Modal imports `react-dom`; the package declares only `react`. It works in the monorepo (root devDependency) but the published package has an undeclared import.
**Fix:** Phase 3 Files add `foundation/ui/package.json`; step 1 adds `"react-dom": "^19.0.0"` to `peerDependencies` (check `tests/repo/packages.test.ts` release rules still pass).
**Decision:** Fix now (recommended, not applied)

### W4 [WARNING] Testing Library's automatic cleanup does not run in this Vitest setup
**Effort:** low. **Lens:** Tests. **Where:** Key decision "DOM tests"; Phases 1-3 DOM tests · `vitest.config.mts` (no `globals: true`, `sequence.shuffle: true`)
**Problem:** `@testing-library/react` unmounts after each test only when a global `afterEach` exists. Without globals, rendered trees accumulate across tests in a file; with shuffled order, `getByRole` queries find duplicates and fail intermittently, and portals (modal, toast) leak into later tests.
**Fix:** add to the DOM-test decision: "each DOM test file calls `afterEach(cleanup)` (imported from `@testing-library/react`) and resets the toast store; no change to the root config."
**Decision:** Fix now (recommended, not applied)

### W5 [WARNING] Phase file lists omit files the steps must change
**Effort:** low. **Lens:** Fit. **Where:** Phases 2-3 "Files"; Phase 1 step 1
**Problem:** Phases 2 and 3 export new components and add copy (`Close`, `Cancel`, `Saving…`, `ui.amount_*` errors, hint labels) but list neither `src/ui/index.ts` nor `src/messages/{en,pl}.ts`; phase 2 step 5 creates an unnamed "context file"; phase 3 lists `docs/02-module-standard.md` with no step that edits it; FIRE `select-keys` is `.ts`. Phase 1 step 1 adds dev dependencies that are already in the uncommitted `package.json` diff.
**Fix:** add `foundation/ui/src/ui/index.ts` and `foundation/ui/src/messages/{en,pl}.ts` to phases 2 and 3; name the context file `foundation/ui/src/ui/action-form-context.ts` (hooks `useFieldValue`, `useFieldError`, `useSubmitCount`); add a phase 3 step "docs/02 §5: link the primitives list to the README" or drop the file; change step 1.1 to "commit the dev dependencies already added (`happy-dom`, `@testing-library/react`, `@testing-library/dom`) with the lockfile".
**Decision:** Fix now (recommended, not applied)

### W6 [WARNING] The manual screenshot criterion has no harness
**Effort:** low. **Lens:** Verifiability. **Where:** Phase 3 Done when, Manual; Progress 3.3
**Problem:** There is no app to render the primitives in (`examples/` belongs to FD-7) and no browser dependency in the repo; "a page with the primitives renders in light and dark" names neither the page nor the tool.
**Fix:** either specify the harness (a throwaway HTML file in the scratchpad, built with `renderToStaticMarkup` plus `dist/styles.css`, with `data-theme="light|dark"`, screenshotted with any available headless browser; screenshots in `reviews/`) or move the visual check to FD-7 and keep it here as an owner check. Recommended: move to FD-7, where Playwright exists.
**Decision:** Fix now (recommended, not applied)

### S1 [SUGGESTION] The `next/` architecture test duplicates an existing ESLint rule
**Effort:** low. **Lens:** Lean. **Where:** Key decision "Copy guard"; Phase 1 step 6 · `eslint.config.mjs:27-34` · `tests/repo/packages.test.ts` ("import boundaries (NFR-3)")
**Problem:** `no-restricted-imports` already rejects `next` and `next/*` in `**/src/ui/**`, and a repository test proves it.
**Fix:** drop the `next/` part of the new test; reference the ESLint rule in the copy-guard comment.
**Decision:** Fix now (recommended, not applied)

### S2 [SUGGESTION] change.md is still `status: new`
**Effort:** low. **Lens:** Progress format (workflow state). **Where:** `context/archive/2026-10-02-ui-primitives/change.md` frontmatter
**Problem:** softure-plan-review requires `status: planned`; the plan exists but the status was not advanced.
**Fix:** set `status: planned` (then `plan_reviewed` once C1-C3 are applied) and `updated` to today.
**Decision:** Fix now (recommended, not applied)

## Triage summary
Fixed: none applied by the reviewer (instructed not to edit plan.md). Recommended for the author: C1, C2 (Fix A), C3, W1-W6, S1, S2. Accepted: -. Deferred: -. Dismissed: -.
Verdict before triage: not ready (3 critical open; all fixes are local to the plan, so not back to plan). After the recommended fixes: ready after fixes.

Author triage (2026-10-02, auto): applied to plan.md: C1, C2 (Fix A: class coverage test plus a
mapping table), C3, W1, W2 (attribute names `aria-*`, `title`, `placeholder`, `alt`, `label`,
`*Label`; the free-text literal scan is dismissed, it cannot tell copy from class strings without
an allowlist that would rot), W3, W4, W5, W6 (kept in this change with a Chromium harness), S1, S2.
Verdict after triage: ready.

## Decisions (auto)
- C1 Polish in ported files and research.md → Fix now, not applied (gate failure; clear fix).
- C2 Tailwind theme and role-mapping gaps → Fix now, Fix A, not applied (silent unstyled output; exhaustive styles test removes the class of problem).
- C3 Progress does not mirror Done when → Fix now, not applied (softure-implement resumes from Progress).
- W1 ActionResult shape → Fix now, not applied (docs/02 §6 requires codes).
- W2 Copy guard holes → Fix now, not applied (NFR-3 verification).
- W3 react-dom peer dependency → Fix now, not applied.
- W4 RTL cleanup → Fix now, not applied.
- W5 File lists → Fix now, not applied.
- W6 Screenshot harness → Fix now, not applied (recommend moving to FD-7).
- S1 Duplicate next/ guard → Fix now, not applied (cheap).
- S2 change.md status → Fix now, not applied (cheap).
