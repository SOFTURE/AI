# Implementation review: mk-config-contract

Scope: full · Date: 2026-10-03 · Commits: e49cea4 (phases 1-3), 58eb620 (F1-F7) · Gates: typecheck ✓ lint ✓
test ✓ (2085 passed, 12 skipped) build ✓ · Render: `MARKETING_KIT_RENDER=1` fixture test passed locally before and
after the fixes (Chromium headless shell 1194 for hyperframes, Chromium 1194 for Playwright).

## Verdict

Ready after fixes. A project describes its films and brand in one `marketing.json`, checked by a zod schema that
is also published as `schema/marketing.schema.json` (a test fails when the two drift). The brand's nine colour
roles come inline, from the app's stylesheet or from a `design.json`; a role without a colour is an error with its
JSON path, never a default. The architecture test finds no FIRE constant in `src/`, and the fixture film renders
from its `marketing.json` with the logo, the end card and the captions in the configured colours. An independent
review pass found seven issues; all seven are fixed in 58eb620. One suggestion is deferred to the followups
roadmap (FU-14).

## Dimensions

| Dimension | Verdict | Findings |
| --- | --- | --- |
| Plan coverage and drift | PASS | F8 |
| Correctness | PASS after fixes | F1, F2, F5, F7 |
| Tests | PASS | — |
| Migrations | PASS (none) | — |
| Security | PASS after fixes | F3, F4, F6 |
| Patterns and lessons | PASS | F9 |

## Plan coverage

| Phase | Commit | Delivered | Notes |
| --- | --- | --- | --- |
| 1 The contract | e49cea4 | yes | schema, brand colours (inline, CSS, design.json), issues with JSON paths, `platforms.ts`, JSON Schema script |
| 2 The pipeline reads the contract | e49cea4 | yes | film, timeline geometry, compose (fonts, logo, sfx), record (browser settings), posts, voiceover language, CLI |
| 3 Fixture, docs and the render | e49cea4 | yes | fixture `marketing.json`, logo, scene module, README reference, docs, FU-14 |

Phases 1 and 2 share a commit: removing `validateFilm` and `marketing.config.json` breaks the typecheck of every
caller, and the pre-commit hook typechecks the tree, so the contract and its readers landed together (F8).

Faithfulness checks: `voiceoverKey` for `pl` still gives `619a27159288f1e1` (the cache stays valid); FIRE's
`globals.css` layout gives the colours read by hand from the fixture (`tests/brand.test.ts`); the fixture config
validates against the published JSON Schema with the expected resolved colours (`tests/schema.test.ts`).

## Findings

### F1 [WARNING] A themed `:root` rule was read as the plain `:root` block
**Impact:** MEDIUM · **Dimension:** Correctness · **Where:** `src/config/css-colors.ts`
**What:** the block finder compared the selector with `startsWith`, so `:root[data-theme="light"]` counted as
`:root`, and a minified `[data-theme=dark]` (no quotes) never matched the themed block.
**Fix:** top-level rules are listed once and compared by whole, normalized selectors (whitespace and quotes
dropped); `:root[…]` and `html[…]` theme blocks are accepted.
**Decision:** fixed (58eb620), tests for both shapes.

### F2 [WARNING] A missing theme fell back to `:root` silently
**Impact:** MEDIUM · **Dimension:** Correctness · **Where:** `src/config/css-colors.ts`
**What:** with `theme: "dark"` and a stylesheet holding only a light block, the film took `:root`'s colours.
**Fix:** a stylesheet with theme blocks but not the configured one is an error; one without any theme blocks still
reads `:root`.
**Decision:** fixed (58eb620), README updated.

### F3 [SUGGESTION] The last declaration of a block without `;` was not read
**Impact:** LOW · **Dimension:** Correctness · **Where:** `readDeclaration`
**Fix:** the value ends at `;` or at the end of the block.
**Decision:** fixed (58eb620).

### F4 [WARNING] Font files were HTML-escaped inside `<style>`
**Impact:** MEDIUM · **Dimension:** Security · **Where:** `src/compose/compose.ts`, `src/render/render.ts`
**What:** the font `src` went through `escapeHtml` inside a CSS `url("…")`, where entities are not decoded, and the
copied name kept the user's file name.
**Fix:** fonts are copied as `<n>.<ext>`, a name that needs no escaping, and the escaping is gone.
**Decision:** fixed (58eb620).

### F5 [SUGGESTION] The font extension was checked only at render
**Impact:** LOW · **Dimension:** Correctness · **Where:** `src/config/schema.ts`
**Fix:** the schema refuses a font path that is not `.woff2`, `.woff`, `.ttf` or `.otf`, with its JSON path.
**Decision:** fixed (58eb620).

### F6 [WARNING] Hidden selectors could break the recording's style tag
**Impact:** MEDIUM · **Dimension:** Security · **Where:** `src/config/schema.ts`, `src/record/record.ts`
**What:** a selector with `/*` or `\` passed the pattern and could swallow the rules after it.
**Fix:** the pattern also refuses `\` and `/*`; each selector gets its own style tag.
**Decision:** fixed (58eb620).

### F7 [SUGGESTION] Offsets and wrong-case zones passed the timezone check
**Impact:** LOW · **Dimension:** Correctness · **Where:** `isKnownTimezone`
**What:** `Intl.DateTimeFormat` accepts `+01:00` and `europe/london`.
**Fix:** a tz database name in its own spelling only.
**Decision:** fixed (58eb620). The README's "every command checks the scene module; render, preview and all also
check the brand files" replaces a sentence that promised more than `record` checks.

### F8 [SUGGESTION] Phases 1 and 2 in one commit
**Impact:** LOW · **Dimension:** Plan drift · **Where:** history
**Decision:** accept, see Plan coverage.

### F9 [SUGGESTION] The JSON Schema has no descriptions
**Impact:** LOW · **Dimension:** Patterns · **Where:** `schema/marketing.schema.json`
**What:** editors show field names and types but no help text; the README carries the reference.
**Decision:** defer: FU-14 (`marketing-kit-schema-docs`) in the followups roadmap.

## MK-1 handoff

MK-1's F2 (the core throws instead of returning results): the config, the brand colours and the stylesheet and
`design.json` readers return results with JSON paths; `validateFilm` is gone (the schema validates a film). The
composition's remaining throws (`getFontFormat`, timeline maths) guard inputs the schema has already checked.
